import { CONFIG } from '../config';
import { fetchGraphQL } from './fetcher';
import type { AniListEntry } from './types';

const ANILIST_API_URL = 'https://graphql.anilist.co';

const animeListQuery = `
  query ($userName: String) {
    MediaListCollection(userName: $userName, type: ANIME) {
      lists {
        name
        status
        entries {
          id
          progress
          score
          media {
            id
            title { romaji english }
            coverImage { large }
            bannerImage
            episodes
            status
            genres
            format
          }
        }
      }
    }
  }
`;

const mangaListQuery = `
  query ($userName: String) {
    MediaListCollection(userName: $userName, type: MANGA) {
      lists {
        name
        status
        entries {
          id
          progress
          score
          media {
            id
            title { romaji english }
            coverImage { large }
            bannerImage
            chapters
            status
            genres
            format
          }
        }
      }
    }
  }
`;

function mapEntry(entry: any, statusType: any, isManga = false): AniListEntry {
  const media = entry.media;
  return {
    id: media.id,
    title: media.title.english || media.title.romaji,
    titleEnglish: media.title.english,
    coverUrl: media.coverImage?.large || null,
    bannerUrl: media.bannerImage || null,
    score: entry.score || null,
    progress: entry.progress,
    episodes: isManga ? null : media.episodes,
    chapters: isManga ? media.chapters : null,
    status: statusType, // 'WATCHING', 'COMPLETED', etc.
    genres: media.genres || [],
    format: media.format,
    type: isManga ? 'MANGA' : 'ANIME',
  };
}

export async function fetchAniListAnime() {
  const data = await fetchGraphQL<any>(
    ANILIST_API_URL,
    animeListQuery,
    { userName: CONFIG.user.anilist },
    'AniList',
  );
  if (!data?.MediaListCollection?.lists)
    return {
      watching: [],
      completed: [],
      paused: [],
      dropped: [],
      planning: [],
    };

  const lists = data.MediaListCollection.lists;

  const result: Record<string, AniListEntry[]> = {
    watching: [],
    completed: [],
    paused: [],
    dropped: [],
    planning: [],
  };

  for (const list of lists) {
    const status = list.status; // CURRENT, COMPLETED, PAUSED, DROPPED, PLANNING
    const mapped = list.entries.map((e: any) => mapEntry(e, status));

    if (status === 'CURRENT') result.watching!.push(...mapped);
    if (status === 'COMPLETED') result.completed!.push(...mapped);
    if (status === 'PAUSED') result.paused!.push(...mapped);
    if (status === 'DROPPED') result.dropped!.push(...mapped);
    if (status === 'PLANNING') result.planning!.push(...mapped);
  }

  return result;
}

export async function fetchAniListManga(): Promise<AniListEntry[]> {
  const data = await fetchGraphQL<any>(
    ANILIST_API_URL,
    mangaListQuery,
    { userName: CONFIG.user.anilist },
    'AniList',
  );
  if (!data?.MediaListCollection?.lists) return [];

  const allManga: AniListEntry[] = [];
  data.MediaListCollection.lists.forEach((list: any) => {
    allManga.push(
      ...list.entries.map((e: any) => mapEntry(e, list.status, true)),
    );
  });

  return allManga;
}
