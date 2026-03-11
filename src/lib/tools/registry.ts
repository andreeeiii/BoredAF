import { z } from "zod";

export const YouTubeVideoSchema = z.object({
  title: z.string(),
  videoId: z.string(),
  publishedAt: z.string(),
  thumbnail: z.string(),
  channelTitle: z.string(),
  url: z.string(),
});

export const YouTubeResultSchema = z.object({
  videos: z.array(YouTubeVideoSchema),
  error: z.string().nullable(),
});

export const ChessResultSchema = z.object({
  currentElo: z.number().nullable(),
  dailyPuzzleUrl: z.string().nullable(),
  dailyPuzzleTitle: z.string().nullable(),
  error: z.string().nullable(),
});

export type YouTubeVideo = z.infer<typeof YouTubeVideoSchema>;
export type YouTubeResult = z.infer<typeof YouTubeResultSchema>;
export type ChessResult = z.infer<typeof ChessResultSchema>;

const DEFAULT_RESCUES = [
  "Go drink water and do 10 pushups. You'll thank me.",
  "Open your window. Breathe. Come back a new person.",
  "Text someone you haven't talked to in 6 months.",
  "Make the fanciest drink possible with what's in your kitchen.",
  "Put on your favorite album and just vibe for 15 min.",
  "Learn one magic trick on YouTube right now.",
  "Write 3 things you're grateful for. Seriously, do it.",
  "Reorganize your desk. Chaos to clarity in 5 min.",
  "Do a 5-min stretch routine. Your back will love you.",
  "Go for a walk. No phone. Just vibes.",
];

export function getDefaultRescue(exclude: string[] = []): string {
  const available = DEFAULT_RESCUES.filter(
    (r) => !exclude.some((e) => r.toLowerCase().includes(e.toLowerCase()))
  );
  const pool = available.length > 0 ? available : DEFAULT_RESCUES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function fetchYouTubeVideos(
  channelIds: string[]
): Promise<YouTubeResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return { videos: [], error: "YouTube API key not configured" };
  }

  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString();

    const allVideos: YouTubeVideo[] = [];

    const fetches = channelIds.slice(0, 3).map(async (channelId) => {
      const params = new URLSearchParams({
        key: apiKey,
        channelId,
        part: "snippet",
        order: "date",
        maxResults: "3",
        type: "video",
        publishedAfter: twentyFourHoursAgo,
      });

      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${params}`,
        { next: { revalidate: 300 } }
      );

      if (!res.ok) return;

      const data = await res.json();

      for (const item of data.items ?? []) {
        allVideos.push({
          title: item.snippet.title,
          videoId: item.id.videoId,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          thumbnail:
            item.snippet.thumbnails?.medium?.url ??
            item.snippet.thumbnails?.default?.url ??
            "",
          url: `https://youtube.com/watch?v=${item.id.videoId}`,
        });
      }
    });

    await Promise.all(fetches);

    return YouTubeResultSchema.parse({ videos: allVideos, error: null });
  } catch (err) {
    return {
      videos: [],
      error: err instanceof Error ? err.message : "YouTube fetch failed",
    };
  }
}

export interface YouTubeChannelStats {
  handle: string;
  subscriberCount: number;
  exists: boolean;
}

/**
 * Validate YouTube channels by checking real subscriber counts.
 * Uses the channels.list endpoint with forHandle parameter (1 unit per call).
 * Returns a map of handle → { subscriberCount, exists }.
 */
export async function validateYouTubeChannels(
  handles: string[]
): Promise<Map<string, YouTubeChannelStats>> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const results = new Map<string, YouTubeChannelStats>();

  if (!apiKey || handles.length === 0) {
    return results;
  }

  const fetches = handles.slice(0, 20).map(async (handle) => {
    const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;
    try {
      const params = new URLSearchParams({
        key: apiKey,
        forHandle: cleanHandle,
        part: "statistics",
      });

      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?${params}`,
        { next: { revalidate: 3600 } }
      );

      if (!res.ok) {
        results.set(handle.toLowerCase(), { handle, subscriberCount: 0, exists: false });
        return;
      }

      const data = await res.json();
      const channel = (data.items ?? [])[0];

      if (!channel) {
        results.set(handle.toLowerCase(), { handle, subscriberCount: 0, exists: false });
        return;
      }

      const subs = parseInt(channel.statistics?.subscriberCount ?? "0", 10);
      results.set(handle.toLowerCase(), { handle, subscriberCount: subs, exists: true });
    } catch {
      results.set(handle.toLowerCase(), { handle, subscriberCount: 0, exists: false });
    }
  });

  await Promise.all(fetches);
  return results;
}

/**
 * Extract YouTube handle from a URL.
 * Supports: youtube.com/@Handle, youtube.com/c/Handle, youtube.com/channel/UCxxx
 */
export function extractYouTubeHandle(url: string): string | null {
  const handleMatch = url.match(/youtube\.com\/@([^/?]+)/);
  if (handleMatch) return handleMatch[1];

  const customMatch = url.match(/youtube\.com\/c\/([^/?]+)/);
  if (customMatch) return customMatch[1];

  return null;
}

export async function fetchChessData(
  username?: string
): Promise<ChessResult> {
  try {
    const [statsRes, puzzleRes] = await Promise.all([
      username
        ? fetch(`https://api.chess.com/pub/player/${username}/stats`, {
            next: { revalidate: 300 },
          })
        : Promise.resolve(null),
      fetch("https://api.chess.com/pub/puzzle", {
        next: { revalidate: 3600 },
      }),
    ]);

    let currentElo: number | null = null;
    if (statsRes?.ok) {
      const stats = await statsRes.json();
      currentElo =
        stats.chess_blitz?.last?.rating ??
        stats.chess_rapid?.last?.rating ??
        null;
    }

    let dailyPuzzleUrl: string | null = null;
    let dailyPuzzleTitle: string | null = null;
    if (puzzleRes.ok) {
      const puzzle = await puzzleRes.json();
      dailyPuzzleUrl = puzzle.url ?? null;
      dailyPuzzleTitle = puzzle.title ?? null;
    }

    return ChessResultSchema.parse({
      currentElo,
      dailyPuzzleUrl,
      dailyPuzzleTitle,
      error: null,
    });
  } catch (err) {
    return {
      currentElo: null,
      dailyPuzzleUrl: null,
      dailyPuzzleTitle: null,
      error: err instanceof Error ? err.message : "Chess fetch failed",
    };
  }
}
