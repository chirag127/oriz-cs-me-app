import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Load env vars
dotenv.config();

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  fetchAniListAnime,
  fetchAniListManga,
} from '../src/lib/api/anilist.js';
import { fetchBlueskyPosts } from '../src/lib/api/bluesky.js';
import { fetchCodewarsStats } from '../src/lib/api/codewars.js';
import { fetchDevToArticles } from '../src/lib/api/devto.js';
import {
  extractTopLanguages,
  fetchGitHubRepos,
  fetchGitHubUser,
} from '../src/lib/api/github-api.js';
import { fetchHackerNewsStats } from '../src/lib/api/hackernews.js';
import { fetchHolopinBadges } from '../src/lib/api/holopin.js';
import { fetchJikanStats } from '../src/lib/api/jikan.js';
import {
  fetchLastFmRecentTracks,
  fetchLastFmStats,
  fetchLastFmTopAlbums,
  fetchLastFmTopArtists,
  fetchLastFmTopTracks,
} from '../src/lib/api/lastfm.js';
import { fetchLeetCodeStats } from '../src/lib/api/leetcode.js';
// New API modules
import {
  fetchListenBrainzRecentListens,
  fetchListenBrainzStats,
  fetchListenBrainzTopArtists,
  fetchListenBrainzTopTracks,
} from '../src/lib/api/listenbrainz.js';
import {
  fetchMastodonAccount,
  fetchMastodonStatuses,
} from '../src/lib/api/mastodon.js';
import {
  fetchMixcloudCloudcasts,
  fetchMixcloudUser,
} from '../src/lib/api/mixcloud.js';
import { fetchNpmDownloads, fetchNpmUserPackages } from '../src/lib/api/npm.js';
import { fetchOpenLibraryBooks } from '../src/lib/api/openlibrary.js';
import {
  fetchRedditComments,
  fetchRedditPosts,
  fetchRedditUser,
} from '../src/lib/api/reddit.js';
import {
  fetchSpotifyTopArtists,
  fetchSpotifyTopTracks,
} from '../src/lib/api/spotify.js';
import {
  fetchStackOverflowTags,
  fetchStackOverflowUser,
} from '../src/lib/api/stackoverflow.js';
import {
  fetchLichessStats,
  fetchSteamGames,
  fetchSteamRecentGames,
} from '../src/lib/api/steam.js';
// Import API modules
import {
  fetchTraktRatings,
  fetchTraktShows,
  fetchTraktWatchedMovies,
  fetchTraktWatchlistMovies,
} from '../src/lib/api/trakt.js';
import { fetchWakaTimeStats } from '../src/lib/api/wakatime.js';
import {
  fetchYouTubeStats,
  fetchYouTubeVideos,
} from '../src/lib/api/youtube.js';
import {
  localImageExists,
  saveLocalImage,
  getLocalPosterUrl,
} from '../src/lib/api/local-storage.js';
import pLimit from 'p-limit';

// Concurrency limit for media operations to prevent rate-limiting/timeouts
const limit = pLimit(2);

/**
 * Resolves posters for a list of items (movies or shows).
 * 3-Tier Strategy:
 * 1. Local Storage (Check local posters directory - GitHub repo)
 * 2. TMDB API (Official Studio Source - Using Read Access Token)
 * 3. Zero-Auth Fallbacks (TVMaze for TV, Jikan for Anime)
 */
async function resolvePosters(items: any[]) {
  const TMDB_TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;
  console.log(`[Media] Resolving posters for ${items.length} items (Slow Mode + Retries)...`);
  
  const tasks = items.map((item) => limit(async () => {
    if (!item.imdbId && !item.tmdbId) return item;

    const filename = `${item.imdbId || item.tmdbId}.jpg`;
    
    // Tier 1: Check Local Storage (GitHub repo)
    const localExists = await localImageExists(filename);
    if (localExists) {
      return { ...item, posterUrl: getLocalPosterUrl(filename) };
    }
    
    const fetchWithRetry = async (url: string, options = {}, retries = 3): Promise<Response | null> => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch(url, options);
          if (res.ok) return res;
        } catch (err) {}
        await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Exponential backoff
      }
      return null;
    };

    let buffer: Buffer | null = null;
    try {
      // Tier 2: Official TMDB (High Quality)
      if (TMDB_TOKEN) {
        const id = item.tmdbId || item.imdbId;
        const type = item.episodesWatched !== undefined ? 'tv' : 'movie';
        const tmdbUrl = `https://api.themoviedb.org/3/${type}/${id}?append_to_response=images`;
        
        const tmdbRes = await fetchWithRetry(tmdbUrl, {
          headers: {
            'Authorization': `Bearer ${TMDB_TOKEN}`,
            'accept': 'application/json'
          }
        });

        if (tmdbRes) {
          const data: any = await tmdbRes.json();
          if (data.poster_path) {
            const imgRes = await fetchWithRetry(`https://image.tmdb.org/t/p/w500${data.poster_path}`);
            if (imgRes) {
              buffer = Buffer.from(await imgRes.arrayBuffer());
              console.log(`[TMDB] Resolved: ${item.title}`);
            }
          }
        }
      }

      // Tier 3: Zero-Auth Fallbacks
      if (!buffer) {
        // Fallback A: TVMaze (For TV Shows)
        if (item.traktId && item.episodesWatched !== undefined) {
          const mazeRes = await fetchWithRetry(`https://api.tvmaze.com/lookup/shows?trakt=${item.traktId}`);
          if (mazeRes) {
            const mazeData: any = await mazeRes.json();
            if (mazeData.image?.original) {
              const imgRes = await fetchWithRetry(mazeData.image.original);
              if (imgRes) {
                buffer = Buffer.from(await imgRes.arrayBuffer());
                console.log(`[TVMaze] Resolved: ${item.title}`);
              }
            }
          }
        }

        // Fallback B: Jikan/MyAnimeList (For Anime)
        const isAnime = item.genres?.some((g: string) => g.toLowerCase() === 'anime' || g.toLowerCase() === 'donghua');
        if (!buffer && isAnime && item.tmdbId) {
          const animeRes = await fetchWithRetry(`https://api.jikan.moe/v4/anime/${item.tmdbId}`);
          if (animeRes) {
            const animeData: any = await animeRes.json();
            const poster = animeData.data?.images?.jpg?.large_image_url;
            if (poster) {
              const imgRes = await fetchWithRetry(poster);
              if (imgRes) {
                buffer = Buffer.from(await imgRes.arrayBuffer());
                console.log(`[Jikan] Resolved: ${item.title}`);
              }
            }
          }
        }
      }

      // If resolved, save to local storage (GitHub repo)
      if (buffer) {
        const localUrl = await saveLocalImage(filename, buffer);
        
        // Small delay to prevent rate-limiting
        await new Promise(r => setTimeout(r, 500));
        return { ...item, posterUrl: localUrl };
      }
    } catch (err: any) {
      console.warn(`[Media] Error on ${item.title}:`, err.message);
    }

    return item;
  }));

  return Promise.all(tasks);
}

// Setup directories
const GENERATED_DIR = path.resolve(__dirname, '../src/data/generated');
const PUBLIC_DATA_DIR = path.resolve(__dirname, '../public/data');

// Initialize Firebase Admin (Only if credentials exist - safe fallback for local dev)
let db: FirebaseFirestore.Firestore | null = null;
try {
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    const formattedKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedKey,
      }),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    db = getFirestore();
    console.log('[Firestore] Admin SDK initialized.');
  } else {
    console.warn(
      '[Firestore] Admin SDK missing credentials, skipping Firestore push.',
    );
  }
} catch (e: any) {
  if (e?.code === 5 || e?.message?.includes('NOT_FOUND')) {
    console.warn(
      '[Firestore] Database not found. Create a Firestore database at https://console.firebase.google.com/project/' +
        (process.env.FIREBASE_PROJECT_ID || '') +
        '/firestore',
    );
  } else {
    console.error('[Firestore] Initialization failed:', e);
  }
}

async function ensureDir() {
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.mkdir(PUBLIC_DATA_DIR, { recursive: true });
}

async function writeJson(filename: string, data: any) {
  const filePath = path.join(GENERATED_DIR, filename);
  const publicPath = path.join(PUBLIC_DATA_DIR, filename);
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, content);
  await fs.writeFile(publicPath, content);
  console.log(
    `[Cache] Wrote ${filename} (${content.length} bytes) → generated/ + public/data/`,
  );
}

async function pushToFirestore(collection: string, doc: string, data: any) {
  if (!db) return;
  try {
    await db.collection(collection).doc(doc).set(data, { merge: true });
    console.log(`[Firestore] Updated ${collection}/${doc}`);
  } catch (error: any) {
    if (error?.code === 5 || error?.message?.includes('NOT_FOUND')) {
      console.warn(
        `[Firestore] Database not found. Create Firestore DB at: https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID}/firestore`,
      );
      db = null; // Stop trying further pushes
    } else {
      console.error(
        `[Firestore] Failed to update ${collection}/${doc}:`,
        error?.message || error,
      );
    }
  }
}

async function main() {
  console.log('🚀 Starting Data Fetcher Orchestrator...');
  await ensureDir();

  const timestamp = new Date().toISOString();

  // 1. Movies & Shows (serialized — Trakt rejects concurrent reqs)
  console.log('\n--- Fetching Movies & Shows ---');
  let traktWatched = await fetchTraktWatchedMovies();
  let traktWatchlist = await fetchTraktWatchlistMovies();
  const traktRatings = await fetchTraktRatings();
  let traktShows = await fetchTraktShows();

  // 1.1 Resolve Posters through R2 Caching
  console.log('\n--- Caching Posters to R2 ---');
  traktWatched = await resolvePosters(traktWatched);
  traktWatchlist = await resolvePosters(traktWatchlist);
  traktShows = await resolvePosters(traktShows);

  // Merge ratings into movies
  const movies = {
    watched: traktWatched.map((m) => ({
      ...m,
      rating: traktRatings[m.traktSlug]?.rating || null,
      ratedAt: traktRatings[m.traktSlug]?.ratedAt || null,
    })),
    watchlist: traktWatchlist.map((m) => ({
      ...m,
      rating: traktRatings[m.traktSlug]?.rating || null,
      ratedAt: traktRatings[m.traktSlug]?.ratedAt || null,
    })),
    // Separate rated movies
    rated: Object.entries(traktRatings)
      .map(([slug, r]) => {
        const movie = [...traktWatched, ...traktWatchlist].find(
          (m) => m.traktSlug === slug,
        );
        return movie
          ? { ...movie, rating: r.rating, ratedAt: r.ratedAt }
          : {
              traktSlug: slug,
              rating: r.rating,
              ratedAt: r.ratedAt,
              title: '',
              year: 0,
              tmdbId: null,
              imdbId: null,
              watchedAt: null,
              posterUrl: null,
              genres: [],
              overview: null,
              runtime: null,
              category: 'watched' as const,
            };
      })
      .filter((m: any) => m.title),
    shows: traktShows,
    stats: {
      totalWatched: traktWatched.length,
      totalShows: traktShows.length,
      totalRated: Object.keys(traktRatings).length,
      totalWatchlist: traktWatchlist.length,
    },
    lastUpdated: timestamp,
  };
  await writeJson('movies.json', movies);
  await pushToFirestore('media', 'movies', movies);

  // 2. Books
  console.log('\n--- Fetching Books ---');
  const [read, reading, wantToRead] = await Promise.all([
    fetchOpenLibraryBooks('already-read'),
    fetchOpenLibraryBooks('currently-reading'),
    fetchOpenLibraryBooks('want-to-read'),
  ]);

  const books = { read, reading, wantToRead, lastUpdated: timestamp };
  await writeJson('books.json', books);
  await pushToFirestore('media', 'books', books);

  // 3. Music
  console.log('\n--- Fetching Music ---');
  const [
    lastFmStats,
    topArtists,
    topTracks,
    topAlbums,
    recentTracks,
    spotTopTracks,
    spotTopArtists,
  ] = await Promise.all([
    fetchLastFmStats(),
    fetchLastFmTopArtists(),
    fetchLastFmTopTracks(),
    fetchLastFmTopAlbums(),
    fetchLastFmRecentTracks(),
    fetchSpotifyTopTracks(),
    fetchSpotifyTopArtists(),
  ]);

  // Also fetch ListenBrainz data
  const [lbStats, lbTopArtists, lbTopTracks, lbRecent] = await Promise.all([
    fetchListenBrainzStats().catch(() => null),
    fetchListenBrainzTopArtists(10).catch(() => []),
    fetchListenBrainzTopTracks(10).catch(() => []),
    fetchListenBrainzRecentListens(10).catch(() => []),
  ]);

  const music = {
    lastfm: {
      stats: lastFmStats,
      topArtists,
      topTracks,
      topAlbums,
      recentTracks,
    },
    spotify: { topTracks: spotTopTracks, topArtists: spotTopArtists },
    listenbrainz: {
      stats: lbStats,
      topArtists: lbTopArtists,
      topTracks: lbTopTracks,
      recentListens: lbRecent,
    },
    lastUpdated: timestamp,
  };
  await writeJson('music.json', music);
  await pushToFirestore('media', 'music', music);

  // 4. Anime & Manga
  console.log('\n--- Fetching Anime ---');
  const [anime, manga, jikanStats] = await Promise.all([
    fetchAniListAnime(),
    fetchAniListManga(),
    fetchJikanStats(),
  ]);

  const animeData = { anime, manga, stats: jikanStats, lastUpdated: timestamp };
  await writeJson('anime.json', animeData);
  await pushToFirestore('media', 'anime', animeData);

  // 5. Gaming
  console.log('\n--- Fetching Gaming ---');
  const [steamGames, steamRecent, lichessStats] = await Promise.all([
    fetchSteamGames(),
    fetchSteamRecentGames(),
    fetchLichessStats(),
  ]);

  const gaming = {
    steamGames,
    steamRecent,
    lichessStats,
    lastUpdated: timestamp,
  };
  await writeJson('games.json', gaming);
  await pushToFirestore('media', 'gaming', gaming);

  // 6. Coding
  console.log('\n--- Fetching Coding ---');
  const [githubUser, githubRepos, wakatime, leetcode, codewars] =
    await Promise.all([
      fetchGitHubUser(),
      fetchGitHubRepos(),
      fetchWakaTimeStats(),
      fetchLeetCodeStats(),
      fetchCodewarsStats(),
    ]);

  const topLangs = extractTopLanguages(githubRepos);

  const coding = {
    github: { user: githubUser, repos: githubRepos, topLanguages: topLangs },
    wakatime,
    leetcode,
    codewars,
    lastUpdated: timestamp,
  };
  await writeJson('coding.json', coding);
  await pushToFirestore('media', 'coding', coding);

  // 7. Social & Content
  console.log('\n--- Fetching Social ---');
  const [devto, hackernews, bluesky, ytStats, ytVids] = await Promise.all([
    fetchDevToArticles(),
    fetchHackerNewsStats(),
    fetchBlueskyPosts(),
    fetchYouTubeStats(),
    fetchYouTubeVideos(),
  ]);

  const social = {
    devto,
    hackernews,
    bluesky,
    youtube: { stats: ytStats, videos: ytVids },
    lastUpdated: timestamp,
  };
  await writeJson('social.json', social);
  await pushToFirestore('media', 'social', social);

  // 8. Mastodon
  console.log('\n--- Fetching Mastodon ---');
  const [mastodonAccount, mastodonStatuses] = await Promise.all([
    fetchMastodonAccount().catch(() => null),
    fetchMastodonStatuses(20).catch(() => []),
  ]);
  const mastodon = {
    account: mastodonAccount,
    statuses: mastodonStatuses,
    lastUpdated: timestamp,
  };
  await writeJson('mastodon.json', mastodon);
  await pushToFirestore('social', 'mastodon', mastodon);

  // 9. Reddit
  console.log('\n--- Fetching Reddit ---');
  const [redditUser, redditPosts, redditComments] = await Promise.all([
    fetchRedditUser().catch(() => null),
    fetchRedditPosts(25).catch(() => []),
    fetchRedditComments(25).catch(() => []),
  ]);
  const reddit = {
    user: redditUser,
    posts: redditPosts,
    comments: redditComments,
    lastUpdated: timestamp,
  };
  await writeJson('reddit.json', reddit);
  await pushToFirestore('social', 'reddit', reddit);

  // 10. Music Platforms (Mixcloud)
  console.log('\n--- Fetching Music Platforms ---');
  const [mixcloudUser, mixcloudCasts] = await Promise.all([
    fetchMixcloudUser().catch(() => null),
    fetchMixcloudCloudcasts(15).catch(() => []),
  ]);
  const musicPlatforms = {
    mixcloud: { user: mixcloudUser, cloudcasts: mixcloudCasts },
    lastUpdated: timestamp,
  };
  await writeJson('music-platforms.json', musicPlatforms);
  await pushToFirestore('social', 'music-platforms', musicPlatforms);

  // 11. Developer Stats
  console.log('\n--- Fetching Developer Stats ---');
  // NPM packages - search by GitHub username
  const npmPackages = await fetchNpmUserPackages('chirag127').catch(() => []);
  const npmData = await Promise.all(
    npmPackages.map(async (pkg: any) => {
      const downloads = await fetchNpmDownloads(pkg.name).catch(() => null);
      return { ...pkg, downloads: downloads?.downloads || 0 };
    }),
  );

  // StackOverflow - we need to find the user ID
  let soUser = null;
  let soTags: any[] = [];
  try {
    const soData = await fetch(
      'https://api.stackexchange.com/2.3/users?order=desc&sort=reputation&inname=chirag127&site=stackoverflow',
    );
    const soJson: any = await soData.json();
    const soUserId = soJson?.items?.[0]?.user_id;
    if (soUserId) {
      soUser = await fetchStackOverflowUser(String(soUserId));
      soTags = await fetchStackOverflowTags(String(soUserId), 20);
    }
  } catch {
    /* skip */
  }

  const holopinBadges = await fetchHolopinBadges().catch(() => null);

  const devStats = {
    npm: { packages: npmData },
    stackoverflow: { user: soUser, tags: soTags },
    holopin: holopinBadges,
    lastUpdated: timestamp,
  };
  await writeJson('dev-stats.json', devStats);
  await pushToFirestore('social', 'dev-stats', devStats);

  console.log('\n✅ Data Fetching Complete!');
}

main().catch((error) => {
  console.error('❌ Fatal Error in Data Fetcher:', error);
  process.exit(1);
});
