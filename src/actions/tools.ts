import { z } from "zod";

export const YouTubeVideoSchema = z.object({
  title: z.string(),
  videoId: z.string(),
  channelTitle: z.string(),
  publishedAt: z.string(),
  url: z.string(),
});

export const YouTubeResultSchema = z.object({
  videos: z.array(YouTubeVideoSchema),
  error: z.string().nullable(),
});

export const ChessResultSchema = z.object({
  elo: z.number().nullable(),
  dailyPuzzleUrl: z.string().nullable(),
  dailyPuzzleTitle: z.string().nullable(),
  error: z.string().nullable(),
});

export type YouTubeVideo = z.infer<typeof YouTubeVideoSchema>;
export type YouTubeResult = z.infer<typeof YouTubeResultSchema>;
export type ChessResult = z.infer<typeof ChessResultSchema>;

const FALLBACK_SUGGESTIONS = [
  "Go for a 5-min walk and get some fresh air",
  "Do 10 push-ups — you'll feel like a new person",
  "Make yourself the fanciest drink you can with what's in the kitchen",
  "Text someone you haven't talked to in a while",
  "Put on your favorite album and just vibe for 15 minutes",
  "Learn a magic trick on YouTube — impress yourself",
  "Write down 3 things you're grateful for right now",
  "Reorganize your desk — chaos to clarity in 5 minutes",
];

export function getFallbackSuggestion(): string {
  return FALLBACK_SUGGESTIONS[
    Math.floor(Math.random() * FALLBACK_SUGGESTIONS.length)
  ];
}

export async function fetchYouTubeVideos(
  channelIds: string[]
): Promise<YouTubeResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return { videos: [], error: "YouTube API key not configured" };
  }

  try {
    const allVideos: YouTubeVideo[] = [];

    for (const channelId of channelIds.slice(0, 3)) {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?` +
          `key=${apiKey}&channelId=${channelId}&part=snippet` +
          `&order=date&maxResults=3&type=video`,
        { next: { revalidate: 300 } }
      );

      if (!res.ok) continue;

      const data = await res.json();

      for (const item of data.items ?? []) {
        allVideos.push({
          title: item.snippet.title,
          videoId: item.id.videoId,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          url: `https://youtube.com/watch?v=${item.id.videoId}`,
        });
      }
    }

    return YouTubeResultSchema.parse({ videos: allVideos, error: null });
  } catch (err) {
    return {
      videos: [],
      error: err instanceof Error ? err.message : "YouTube fetch failed",
    };
  }
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

    let elo: number | null = null;
    if (statsRes?.ok) {
      const stats = await statsRes.json();
      elo =
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
      elo,
      dailyPuzzleUrl,
      dailyPuzzleTitle,
      error: null,
    });
  } catch (err) {
    return {
      elo: null,
      dailyPuzzleUrl: null,
      dailyPuzzleTitle: null,
      error: err instanceof Error ? err.message : "Chess fetch failed",
    };
  }
}
