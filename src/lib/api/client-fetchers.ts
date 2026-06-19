/**
 * Client-Side Live API Fetchers
 *
 * Browser-safe API callers for public APIs that support
 * CORS. These fetch data live when users visit pages
 * instead of relying solely on build-time JSON.
 *
 * Includes localStorage caching with configurable TTL
 * to avoid excessive API calls.
 */

// ─── Cache Layer ───────────────────────────────────

const CACHE_PREFIX = 'live_api_';
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(
      `${CACHE_PREFIX}${key}`,
    );
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > entry.ttl) {
      localStorage.removeItem(
        `${CACHE_PREFIX}${key}`,
      );
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCache<T>(
  key: string,
  data: T,
  ttl = DEFAULT_TTL_MS,
): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    localStorage.setItem(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify(entry),
    );
  } catch {
    // localStorage full or unavailable — ignore
  }
}

// ─── Generic Fetch Helper ──────────────────────────

async function fetchJsonClient<T>(
  url: string,
  options?: RequestInit,
  label?: string,
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...options?.headers,
      },
    });
    if (!res.ok) {
      console.warn(
        `[${label ?? 'API'}] ${res.status} for ${url}`,
      );
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(
      `[${label ?? 'API'}] Fetch error:`,
      err,
    );
    return null;
  }
}

// ─── AniList (Public GraphQL, CORS enabled) ────────

const ANILIST_URL = 'https://graphql.anilist.co';

const ANILIST_QUERY = `
query ($username: String) {
  MediaListCollection(
    userName: $username
    type: ANIME
    sort: UPDATED_TIME_DESC
  ) {
    lists {
      name
      status
      entries {
        media {
          title { english romaji }
          episodes
          averageScore
          genres
          coverImage { large }
          format
          status
          siteUrl
        }
        score(format: POINT_10)
        progress
        status
        updatedAt
      }
    }
  }
  mangaList: MediaListCollection(
    userName: $username
    type: MANGA
    sort: UPDATED_TIME_DESC
  ) {
    lists {
      name
      status
      entries {
        media {
          title { english romaji }
          chapters
          averageScore
          genres
          coverImage { large }
          format
          siteUrl
        }
        score(format: POINT_10)
        progress
        status
      }
    }
  }
}`;

export interface AniListEntry {
  title: string;
  episodes: number | null;
  score: number;
  progress: number;
  status: string;
  genres: string[];
  coverImage: string | null;
  format: string;
  siteUrl: string;
}

export interface AniListData {
  watching: AniListEntry[];
  completed: AniListEntry[];
  planToWatch: AniListEntry[];
  dropped: AniListEntry[];
  manga: AniListEntry[];
  stats: {
    totalAnime: number;
    totalManga: number;
    watching: number;
    completed: number;
    planToWatch: number;
  };
}

export async function fetchAniListLive(
  username = 'chirag127',
): Promise<AniListData | null> {
  const cached = getCached<AniListData>('anilist');
  if (cached) return cached;

  const res = await fetchJsonClient<{
    data: {
      MediaListCollection: { lists: any[] };
      mangaList: { lists: any[] };
    };
  }>(
    ANILIST_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: ANILIST_QUERY,
        variables: { username },
      }),
    },
    'AniList',
  );

  if (!res?.data) return null;

  const statusMap: Record<string, string> = {
    CURRENT: 'watching',
    COMPLETED: 'completed',
    PLANNING: 'planToWatch',
    DROPPED: 'dropped',
    PAUSED: 'paused',
    REPEATING: 'completed',
  };

  const mapEntries = (entries: any[]): AniListEntry[] =>
    entries.map((e) => ({
      title:
        e.media.title.english ||
        e.media.title.romaji,
      episodes: e.media.episodes,
      score: e.score,
      progress: e.progress,
      status: e.status,
      genres: e.media.genres || [],
      coverImage: e.media.coverImage?.large || null,
      format: e.media.format || 'TV',
      siteUrl: e.media.siteUrl || '',
    }));

  const watching: AniListEntry[] = [];
  const completed: AniListEntry[] = [];
  const planToWatch: AniListEntry[] = [];
  const dropped: AniListEntry[] = [];
  const manga: AniListEntry[] = [];

  for (const list of res.data.MediaListCollection
    .lists) {
    const mapped = mapEntries(list.entries);
    const cat = statusMap[list.status] || 'completed';
    if (cat === 'watching') watching.push(...mapped);
    else if (cat === 'completed')
      completed.push(...mapped);
    else if (cat === 'planToWatch')
      planToWatch.push(...mapped);
    else if (cat === 'dropped')
      dropped.push(...mapped);
  }

  for (const list of res.data.mangaList.lists) {
    manga.push(...mapEntries(list.entries));
  }

  const result: AniListData = {
    watching,
    completed,
    planToWatch,
    dropped,
    manga,
    stats: {
      totalAnime:
        watching.length +
        completed.length +
        planToWatch.length +
        dropped.length,
      totalManga: manga.length,
      watching: watching.length,
      completed: completed.length,
      planToWatch: planToWatch.length,
    },
  };

  setCache('anilist', result);
  return result;
}

// ─── Last.fm (Public API, CORS enabled) ────────────

const LASTFM_URL =
  'https://ws.audioscrobbler.com/2.0';
const LASTFM_API_KEY =
  'e15969debb132e5e0ed031b1a618fe53';

export interface LastFmArtist {
  name: string;
  playcount: string;
  url: string;
  image: string | null;
}

export interface LastFmTrack {
  name: string;
  artist: string;
  playcount: string;
  url: string;
  image: string | null;
}

export interface LastFmData {
  topArtists: LastFmArtist[];
  topTracks: LastFmTrack[];
  recentTracks: LastFmTrack[];
  totalScrobbles: number;
  stats: {
    totalArtists: number;
    totalTracks: number;
    totalScrobbles: number;
  };
}

export async function fetchLastFmLive(
  username = 'lastfmwhy',
): Promise<LastFmData | null> {
  const cached = getCached<LastFmData>('lastfm');
  if (cached) return cached;

  const base = `${LASTFM_URL}?api_key=${LASTFM_API_KEY}&format=json&user=${username}`;

  const [userInfo, artists, tracks, recent] =
    await Promise.all([
      fetchJsonClient<any>(
        `${base}&method=user.getinfo`,
        undefined,
        'Last.fm',
      ),
      fetchJsonClient<any>(
        `${base}&method=user.gettopartists&period=overall&limit=20`,
        undefined,
        'Last.fm',
      ),
      fetchJsonClient<any>(
        `${base}&method=user.gettoptracks&period=overall&limit=20`,
        undefined,
        'Last.fm',
      ),
      fetchJsonClient<any>(
        `${base}&method=user.getrecenttracks&limit=15`,
        undefined,
        'Last.fm',
      ),
    ]);

  const totalScrobbles = Number.parseInt(
    userInfo?.user?.playcount || '0',
    10,
  );

  const topArtists: LastFmArtist[] = (
    artists?.topartists?.artist || []
  ).map((a: any) => ({
    name: a.name,
    playcount: a.playcount,
    url: a.url,
    image:
      a.image?.find((i: any) => i.size === 'large')?.[
        '#text'
      ] || null,
  }));

  const topTracks: LastFmTrack[] = (
    tracks?.toptracks?.track || []
  ).map((t: any) => ({
    name: t.name,
    artist: t.artist?.name || '',
    playcount: t.playcount,
    url: t.url,
    image:
      t.image?.find((i: any) => i.size === 'large')?.[
        '#text'
      ] || null,
  }));

  const recentTracks: LastFmTrack[] = (
    recent?.recenttracks?.track || []
  ).map((t: any) => ({
    name: t.name,
    artist: t.artist?.['#text'] || '',
    playcount: '0',
    url: t.url,
    image:
      t.image?.find((i: any) => i.size === 'large')?.[
        '#text'
      ] || null,
  }));

  const result: LastFmData = {
    topArtists,
    topTracks,
    recentTracks,
    totalScrobbles,
    stats: {
      totalArtists: topArtists.length,
      totalTracks: topTracks.length,
      totalScrobbles,
    },
  };

  setCache('lastfm', result);
  return result;
}

// ─── OpenLibrary (Public API, CORS enabled) ────────

const OPENLIBRARY_URL =
  'https://openlibrary.org/people';

export interface OpenLibraryBook {
  title: string;
  author: string;
  coverId: number | null;
  coverUrl: string | null;
  key: string;
}

export interface OpenLibraryData {
  read: OpenLibraryBook[];
  reading: OpenLibraryBook[];
  wantToRead: OpenLibraryBook[];
  stats: {
    totalRead: number;
    totalReading: number;
    totalWantToRead: number;
  };
}

async function fetchOpenLibraryShelf(
  username: string,
  shelf: string,
): Promise<OpenLibraryBook[]> {
  const data = await fetchJsonClient<any>(
    `${OPENLIBRARY_URL}/${username}/books/${shelf}.json?limit=100`,
    undefined,
    'OpenLibrary',
  );
  if (!data?.reading_log_entries) return [];
  return data.reading_log_entries.map((e: any) => {
    const work = e.work || {};
    const coverId = work.cover_id || null;
    return {
      title: work.title || 'Unknown',
      author:
        work.author_names?.join(', ') ||
        'Unknown Author',
      coverId,
      coverUrl: coverId
        ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
        : null,
      key: work.key || '',
    };
  });
}

export async function fetchOpenLibraryLive(
  username = 'wilarchive',
): Promise<OpenLibraryData | null> {
  const cached =
    getCached<OpenLibraryData>('openlibrary');
  if (cached) return cached;

  const [read, reading, wantToRead] =
    await Promise.all([
      fetchOpenLibraryShelf(username, 'already-read'),
      fetchOpenLibraryShelf(
        username,
        'currently-reading',
      ),
      fetchOpenLibraryShelf(
        username,
        'want-to-read',
      ),
    ]);

  const result: OpenLibraryData = {
    read,
    reading,
    wantToRead,
    stats: {
      totalRead: read.length,
      totalReading: reading.length,
      totalWantToRead: wantToRead.length,
    },
  };

  setCache('openlibrary', result);
  return result;
}

// ─── Trakt (Needs OAuth — client ID only for public)

const TRAKT_URL = 'https://api.trakt.tv';
const TRAKT_CLIENT_ID =
  'dee5f20516bf476e67998b42aef045ff29a5bd5bee24f9a3e162a235fa5cc969';

export interface TraktMovieClient {
  title: string;
  year: number;
  slug: string;
  genres: string[];
  overview: string | null;
  runtime: number | null;
  rating: number | null;
  watchedAt: string | null;
}

export interface TraktShowClient {
  title: string;
  year: number;
  slug: string;
  genres: string[];
  overview: string | null;
  episodesWatched: number;
}

export interface TraktData {
  watched: TraktMovieClient[];
  watchlist: TraktMovieClient[];
  shows: TraktShowClient[];
  ratings: Record<
    string,
    { rating: number; ratedAt: string }
  >;
  stats: {
    totalWatched: number;
    totalShows: number;
    totalWatchlist: number;
    totalRated: number;
  };
}

async function fetchTraktClient<T>(
  endpoint: string,
): Promise<T | null> {
  return fetchJsonClient<T>(
    `${TRAKT_URL}${endpoint}`,
    {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': TRAKT_CLIENT_ID,
      },
    },
    'Trakt',
  );
}

export async function fetchTraktLive(
  username = 'chirag127',
): Promise<TraktData | null> {
  const cached = getCached<TraktData>('trakt');
  if (cached) return cached;

  const [watchedRaw, watchlistRaw, showsRaw, ratingsRaw] =
    await Promise.all([
      fetchTraktClient<any[]>(
        `/users/${username}/watched/movies?extended=full`,
      ),
      fetchTraktClient<any[]>(
        `/users/${username}/watchlist/movies?extended=full`,
      ),
      fetchTraktClient<any[]>(
        `/users/${username}/watched/shows?extended=full`,
      ),
      fetchTraktClient<any[]>(
        `/users/${username}/ratings/movies`,
      ),
    ]);

  const watched: TraktMovieClient[] = (
    watchedRaw || []
  ).map((item) => ({
    title: item.movie?.title || '',
    year: item.movie?.year || 0,
    slug: item.movie?.ids?.slug || '',
    genres: item.movie?.genres || [],
    overview: item.movie?.overview || null,
    runtime: item.movie?.runtime || null,
    rating: null,
    watchedAt: item.last_watched_at || null,
  }));

  const watchlist: TraktMovieClient[] = (
    watchlistRaw || []
  ).map((item) => ({
    title: item.movie?.title || '',
    year: item.movie?.year || 0,
    slug: item.movie?.ids?.slug || '',
    genres: item.movie?.genres || [],
    overview: item.movie?.overview || null,
    runtime: item.movie?.runtime || null,
    rating: null,
    watchedAt: null,
  }));

  const shows: TraktShowClient[] = (
    showsRaw || []
  ).map((item) => ({
    title: item.show?.title || '',
    year: item.show?.year || 0,
    slug: item.show?.ids?.slug || '',
    genres: item.show?.genres || [],
    overview: item.show?.overview || null,
    episodesWatched: item.plays || 0,
  }));

  const ratings: Record<
    string,
    { rating: number; ratedAt: string }
  > = {};
  for (const item of ratingsRaw || []) {
    if (item.movie?.ids?.slug) {
      ratings[item.movie.ids.slug] = {
        rating: item.rating,
        ratedAt: item.rated_at,
      };
    }
  }

  // Merge ratings into watched
  for (const m of watched) {
    if (ratings[m.slug]) {
      m.rating = ratings[m.slug]!.rating;
    }
  }

  const result: TraktData = {
    watched,
    watchlist,
    shows,
    ratings,
    stats: {
      totalWatched: watched.length,
      totalShows: shows.length,
      totalWatchlist: watchlist.length,
      totalRated: Object.keys(ratings).length,
    },
  };

  setCache('trakt', result);
  return result;
}

// ─── GitHub (Public API, CORS enabled) ─────────────

export interface GitHubRepo {
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  url: string;
  updatedAt: string;
}

export interface GitHubData {
  repos: GitHubRepo[];
  totalStars: number;
  totalRepos: number;
  topLanguages: Record<string, number>;
}

export async function fetchGitHubLive(
  username = 'chirag127',
): Promise<GitHubData | null> {
  const cached = getCached<GitHubData>('github');
  if (cached) return cached;

  const repos = await fetchJsonClient<any[]>(
    `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`,
    undefined,
    'GitHub',
  );

  if (!repos) return null;

  const mapped: GitHubRepo[] = repos.map((r) => ({
    name: r.name,
    description: r.description,
    stars: r.stargazers_count || 0,
    forks: r.forks_count || 0,
    language: r.language,
    url: r.html_url,
    updatedAt: r.updated_at,
  }));

  const topLanguages: Record<string, number> = {};
  for (const r of mapped) {
    if (r.language) {
      topLanguages[r.language] =
        (topLanguages[r.language] || 0) + 1;
    }
  }

  const result: GitHubData = {
    repos: mapped,
    totalStars: mapped.reduce(
      (s, r) => s + r.stars,
      0,
    ),
    totalRepos: mapped.length,
    topLanguages,
  };

  setCache('github', result, 30 * 60 * 1000); // 30m
  return result;
}

// ─── ListenBrainz (Public API, CORS enabled) ───────

export interface ListenBrainzData {
  recentListens: Array<{
    trackName: string;
    artistName: string;
    listenedAt: number;
  }>;
  totalListens: number;
}

export async function fetchListenBrainzLive(
  username = 'chirag127',
): Promise<ListenBrainzData | null> {
  const cached =
    getCached<ListenBrainzData>('listenbrainz');
  if (cached) return cached;

  const data = await fetchJsonClient<any>(
    `https://api.listenbrainz.org/1/user/${username}/listens?count=15`,
    undefined,
    'ListenBrainz',
  );

  if (!data?.payload) return null;

  const result: ListenBrainzData = {
    recentListens: (
      data.payload.listens || []
    ).map((l: any) => ({
      trackName:
        l.track_metadata?.track_name || 'Unknown',
      artistName:
        l.track_metadata?.artist_name || 'Unknown',
      listenedAt: l.listened_at || 0,
    })),
    totalListens: data.payload.count || 0,
  };

  setCache('listenbrainz', result);
  return result;
}

// ─── Aggregate Fetcher ─────────────────────────────

export interface AllLiveData {
  anilist: AniListData | null;
  lastfm: LastFmData | null;
  openlibrary: OpenLibraryData | null;
  trakt: TraktData | null;
  github: GitHubData | null;
  listenbrainz: ListenBrainzData | null;
}

/**
 * Fetch all live data from public APIs.
 * Results are cached in localStorage.
 * Returns partial data if some APIs fail.
 */
export async function fetchAllLiveData(): Promise<AllLiveData> {
  const [
    anilist,
    lastfm,
    openlibrary,
    trakt,
    github,
    listenbrainz,
  ] = await Promise.allSettled([
    fetchAniListLive(),
    fetchLastFmLive(),
    fetchOpenLibraryLive(),
    fetchTraktLive(),
    fetchGitHubLive(),
    fetchListenBrainzLive(),
  ]);

  return {
    anilist:
      anilist.status === 'fulfilled'
        ? anilist.value
        : null,
    lastfm:
      lastfm.status === 'fulfilled'
        ? lastfm.value
        : null,
    openlibrary:
      openlibrary.status === 'fulfilled'
        ? openlibrary.value
        : null,
    trakt:
      trakt.status === 'fulfilled'
        ? trakt.value
        : null,
    github:
      github.status === 'fulfilled'
        ? github.value
        : null,
    listenbrainz:
      listenbrainz.status === 'fulfilled'
        ? listenbrainz.value
        : null,
  };
}

/**
 * Build a text summary of all live data for AI context.
 * This is used by the chat AI to have comprehensive,
 * up-to-date knowledge of all media libraries.
 */
export function buildLiveDataContext(
  data: AllLiveData,
): string {
  const sections: string[] = [];

  if (data.anilist) {
    const a = data.anilist;
    const topAnime = a.completed
      .sort((x, y) => y.score - x.score)
      .slice(0, 10)
      .map((e) => `${e.title} (${e.score}/10)`)
      .join(', ');
    const currentlyWatching = a.watching
      .map(
        (e) =>
          `${e.title} (${e.progress}/${e.episodes || '?'} eps)`,
      )
      .join(', ');
    sections.push(
      `## Live Anime Data (AniList)
Total anime: ${a.stats.totalAnime} | Watching: ${a.stats.watching} | Completed: ${a.stats.completed} | Plan to Watch: ${a.stats.planToWatch}
Total manga: ${a.stats.totalManga}
Currently watching: ${currentlyWatching || 'None'}
Top rated: ${topAnime || 'N/A'}
→ View full list: /library/anime`,
    );
  }

  if (data.lastfm) {
    const m = data.lastfm;
    const topArtists = m.topArtists
      .slice(0, 8)
      .map(
        (a) => `${a.name} (${a.playcount} plays)`,
      )
      .join(', ');
    const topTracks = m.topTracks
      .slice(0, 5)
      .map(
        (t) =>
          `"${t.name}" by ${t.artist} (${t.playcount} plays)`,
      )
      .join(', ');
    const recent = m.recentTracks
      .slice(0, 3)
      .map((t) => `"${t.name}" by ${t.artist}`)
      .join(', ');
    sections.push(
      `## Live Music Data (Last.fm)
Total scrobbles: ${m.totalScrobbles.toLocaleString()}
Top artists: ${topArtists}
Top tracks: ${topTracks}
Recently played: ${recent}
→ View full stats: /library/music`,
    );
  }

  if (data.openlibrary) {
    const b = data.openlibrary;
    const readBooks = b.read
      .slice(0, 8)
      .map((bk) => `"${bk.title}" by ${bk.author}`)
      .join(', ');
    const reading = b.reading
      .map((bk) => `"${bk.title}" by ${bk.author}`)
      .join(', ');
    sections.push(
      `## Live Books Data (OpenLibrary)
Books read: ${b.stats.totalRead} | Currently reading: ${b.stats.totalReading} | Want to read: ${b.stats.totalWantToRead}
Currently reading: ${reading || 'None'}
Recently read: ${readBooks || 'N/A'}
→ View full list: /library/books`,
    );
  }

  if (data.trakt && data.trakt.stats.totalWatched > 0) {
    const t = data.trakt;
    const recentMovies = t.watched
      .sort(
        (a, b) =>
          new Date(b.watchedAt || 0).getTime() -
          new Date(a.watchedAt || 0).getTime(),
      )
      .slice(0, 8)
      .map(
        (m) =>
          `${m.title} (${m.year})${m.rating ? ` ★${m.rating}` : ''}`,
      )
      .join(', ');
    const topRated = t.watched
      .filter((m) => m.rating)
      .sort(
        (a, b) => (b.rating || 0) - (a.rating || 0),
      )
      .slice(0, 5)
      .map(
        (m) => `${m.title} (★${m.rating}/10)`,
      )
      .join(', ');
    const showsList = t.shows
      .slice(0, 5)
      .map(
        (s) =>
          `${s.title} (${s.episodesWatched} eps)`,
      )
      .join(', ');
    sections.push(
      `## Live Movies & TV Data (Trakt)
Movies watched: ${t.stats.totalWatched} | Shows: ${t.stats.totalShows} | Watchlist: ${t.stats.totalWatchlist} | Rated: ${t.stats.totalRated}
Recently watched: ${recentMovies || 'N/A'}
Top rated: ${topRated || 'N/A'}
Shows: ${showsList || 'N/A'}
→ View full data: /library/movies`,
    );
  }

  if (data.github) {
    const g = data.github;
    const topRepos = g.repos
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 5)
      .map(
        (r) =>
          `${r.name} (★${r.stars}, ${r.language || 'misc'})`,
      )
      .join(', ');
    sections.push(
      `## Live GitHub Data
Total repos: ${g.totalRepos} | Total stars: ${g.totalStars}
Top repos: ${topRepos}
→ View repos: /code/repos`,
    );
  }

  return sections.join('\n\n');
}
