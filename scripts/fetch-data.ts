import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

// Load env vars before importing anything that might read process.env at module init.
dotenv.config();

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
import {
  fetchListenBrainzRecentListens,
  fetchListenBrainzStats,
  fetchListenBrainzTopArtists,
  fetchListenBrainzTopTracks,
} from '../src/lib/api/listenbrainz.js';
import {
  localImageExists,
  saveLocalImage,
  getLocalPosterUrl,
} from '../src/lib/api/local-storage.js';
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

import { commitSection } from './lib/quality-gate.js';

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
        } catch (_err) {}
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

/**
 * Run a section's fetch + assembly in isolation. If anything throws, log
 * and pass `null` to commitSection — the quality gate will reject the
 * section and keep the previous good data.
 */
async function runSection(
  key: string,
  build: () => Promise<any>,
): Promise<void> {
  console.log(`\n--- Section: ${key} ---`);
  let payload: any = null;
  try {
    payload = await build();
  } catch (err: any) {
    console.error(`[Section ${key}] threw:`, err?.message || err);
  }
  await commitSection(key, payload);
}

async function main() {
  console.log('🚀 Starting Data Fetcher Orchestrator...');
  const timestamp = new Date().toISOString();

  // 1. Movies & Shows (serialized — Trakt rejects concurrent reqs)
  await runSection('movies', async () => {
    let traktWatched = await fetchTraktWatchedMovies();
    let traktWatchlist = await fetchTraktWatchlistMovies();
    const traktRatings = await fetchTraktRatings();
    let traktShows = await fetchTraktShows();

    // 1.1 Resolve Posters via local cache + TMDB/TVMaze/Jikan
    console.log('--- Caching Posters ---');
    traktWatched = await resolvePosters(traktWatched);
    traktWatchlist = await resolvePosters(traktWatchlist);
    traktShows = await resolvePosters(traktShows);

    return {
      watched: traktWatched.map((m: any) => ({
        ...m,
        rating: traktRatings[m.traktSlug]?.rating || null,
        ratedAt: traktRatings[m.traktSlug]?.ratedAt || null,
      })),
      watchlist: traktWatchlist.map((m: any) => ({
        ...m,
        rating: traktRatings[m.traktSlug]?.rating || null,
        ratedAt: traktRatings[m.traktSlug]?.ratedAt || null,
      })),
      rated: Object.entries(traktRatings)
        .map(([slug, r]: [string, any]) => {
          const movie = [...traktWatched, ...traktWatchlist].find(
            (m: any) => m.traktSlug === slug,
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
  });

  // 2. Books
  await runSection('books', async () => {
    const [read, reading, wantToRead] = await Promise.all([
      fetchOpenLibraryBooks('already-read'),
      fetchOpenLibraryBooks('currently-reading'),
      fetchOpenLibraryBooks('want-to-read'),
    ]);
    return { read, reading, wantToRead, lastUpdated: timestamp };
  });

  // 3. Music
  await runSection('music', async () => {
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

    const [lbStats, lbTopArtists, lbTopTracks, lbRecent] = await Promise.all([
      fetchListenBrainzStats().catch(() => null),
      fetchListenBrainzTopArtists(10).catch(() => []),
      fetchListenBrainzTopTracks(10).catch(() => []),
      fetchListenBrainzRecentListens(10).catch(() => []),
    ]);

    return {
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
  });

  // 4. Anime & Manga
  await runSection('anime', async () => {
    const [anime, manga, jikanStats] = await Promise.all([
      fetchAniListAnime(),
      fetchAniListManga(),
      fetchJikanStats(),
    ]);
    return { anime, manga, stats: jikanStats, lastUpdated: timestamp };
  });

  // 5. Gaming
  await runSection('gaming', async () => {
    const [steamGames, steamRecent, lichessStats] = await Promise.all([
      fetchSteamGames(),
      fetchSteamRecentGames(),
      fetchLichessStats(),
    ]);
    return { steamGames, steamRecent, lichessStats, lastUpdated: timestamp };
  });

  // 6. Coding
  await runSection('coding', async () => {
    const [githubUser, githubRepos, wakatime, leetcode, codewars] =
      await Promise.all([
        fetchGitHubUser(),
        fetchGitHubRepos(),
        fetchWakaTimeStats(),
        fetchLeetCodeStats(),
        fetchCodewarsStats(),
      ]);

    return {
      github: {
        user: githubUser,
        repos: githubRepos,
        topLanguages: extractTopLanguages(githubRepos),
      },
      wakatime,
      leetcode,
      codewars,
      lastUpdated: timestamp,
    };
  });

  // 7. Social & Content (devto, HN, bluesky, youtube)
  await runSection('social', async () => {
    const [devto, hackernews, bluesky, ytStats, ytVids] = await Promise.all([
      fetchDevToArticles(),
      fetchHackerNewsStats(),
      fetchBlueskyPosts(),
      fetchYouTubeStats(),
      fetchYouTubeVideos(),
    ]);
    return {
      devto,
      hackernews,
      bluesky,
      youtube: { stats: ytStats, videos: ytVids },
      lastUpdated: timestamp,
    };
  });

  // 8. Mastodon (was social/mastodon → now media/mastodon)
  await runSection('mastodon', async () => {
    const [account, statuses] = await Promise.all([
      fetchMastodonAccount().catch(() => null),
      fetchMastodonStatuses(20).catch(() => []),
    ]);
    return { account, statuses, lastUpdated: timestamp };
  });

  // 9. Reddit (was social/reddit → now media/reddit)
  await runSection('reddit', async () => {
    const [user, posts, comments] = await Promise.all([
      fetchRedditUser().catch(() => null),
      fetchRedditPosts(25).catch(() => []),
      fetchRedditComments(25).catch(() => []),
    ]);
    return { user, posts, comments, lastUpdated: timestamp };
  });

  // 10. Music platforms (Mixcloud) — was social/music-platforms
  await runSection('music-platforms', async () => {
    const [mixcloudUser, mixcloudCasts] = await Promise.all([
      fetchMixcloudUser().catch(() => null),
      fetchMixcloudCloudcasts(15).catch(() => []),
    ]);
    return {
      mixcloud: { user: mixcloudUser, cloudcasts: mixcloudCasts },
      lastUpdated: timestamp,
    };
  });

  // 11. Developer stats (NPM + StackOverflow + Holopin) — was social/dev-stats
  await runSection('dev-stats', async () => {
    const npmPackages = await fetchNpmUserPackages('chirag127').catch(() => []);
    const npmData = await Promise.all(
      npmPackages.map(async (pkg: any) => {
        const downloads = await fetchNpmDownloads(pkg.name).catch(() => null);
        return { ...pkg, downloads: downloads?.downloads || 0 };
      }),
    );

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

    return {
      npm: { packages: npmData },
      stackoverflow: { user: soUser, tags: soTags },
      holopin: holopinBadges,
      lastUpdated: timestamp,
    };
  });

  console.log('\n✅ Data Fetching Complete!');
}

main().catch((error) => {
  console.error('❌ Fatal Error in Data Fetcher:', error);
  process.exit(1);
});
