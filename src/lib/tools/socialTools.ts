import { z } from "zod";

export const TwitchStreamSchema = z.object({
  platform: z.literal("twitch"),
  username: z.string(),
  title: z.string(),
  url: z.string(),
  isLive: z.boolean(),
  viewerCount: z.number().nullable(),
  gameName: z.string().nullable(),
});

export const TwitchResultSchema = z.object({
  streams: z.array(TwitchStreamSchema),
  error: z.string().nullable(),
});

export const TikTokLinkSchema = z.object({
  platform: z.literal("tiktok"),
  username: z.string(),
  url: z.string(),
  displayName: z.string(),
});

export const TikTokResultSchema = z.object({
  links: z.array(TikTokLinkSchema),
  error: z.string().nullable(),
});

export type TwitchStream = z.infer<typeof TwitchStreamSchema>;
export type TwitchResult = z.infer<typeof TwitchResultSchema>;
export type TikTokLink = z.infer<typeof TikTokLinkSchema>;
export type TikTokResult = z.infer<typeof TikTokResultSchema>;

export async function fetchTwitchStreams(
  usernames: string[]
): Promise<TwitchResult> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const accessToken = process.env.TWITCH_ACCESS_TOKEN;

  if (!clientId || !accessToken) {
    const offlineStreams: TwitchStream[] = usernames.slice(0, 5).map((u) => ({
      platform: "twitch" as const,
      username: u,
      title: `${u}'s channel`,
      url: `https://twitch.tv/${u}`,
      isLive: false,
      viewerCount: null,
      gameName: null,
    }));

    return { streams: offlineStreams, error: "Twitch API keys not configured" };
  }

  try {
    const params = new URLSearchParams();
    for (const username of usernames.slice(0, 10)) {
      params.append("user_login", username);
    }

    const res = await fetch(
      `https://api.twitch.tv/helix/streams?${params}`,
      {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${accessToken}`,
        },
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) {
      throw new Error(`Twitch API ${res.status}`);
    }

    const data = await res.json();
    const liveUsernames = new Set(
      (data.data ?? []).map((s: { user_login: string }) =>
        s.user_login.toLowerCase()
      )
    );

    const streams: TwitchStream[] = usernames.map((username) => {
      const liveData = (data.data ?? []).find(
        (s: { user_login: string }) =>
          s.user_login.toLowerCase() === username.toLowerCase()
      );

      if (liveData) {
        return {
          platform: "twitch" as const,
          username,
          title: liveData.title,
          url: `https://twitch.tv/${username}`,
          isLive: true,
          viewerCount: liveData.viewer_count ?? null,
          gameName: liveData.game_name ?? null,
        };
      }

      return {
        platform: "twitch" as const,
        username,
        title: `${username}'s channel`,
        url: `https://twitch.tv/${username}`,
        isLive: liveUsernames.has(username.toLowerCase()),
        viewerCount: null,
        gameName: null,
      };
    });

    return TwitchResultSchema.parse({ streams, error: null });
  } catch (err) {
    const offlineStreams: TwitchStream[] = usernames.map((u) => ({
      platform: "twitch" as const,
      username: u,
      title: `${u}'s channel`,
      url: `https://twitch.tv/${u}`,
      isLive: false,
      viewerCount: null,
      gameName: null,
    }));

    return {
      streams: offlineStreams,
      error: err instanceof Error ? err.message : "Twitch fetch failed",
    };
  }
}

export const TwitchUserSchema = z.object({
  id: z.string(),
  login: z.string(),
  displayName: z.string(),
  broadcasterType: z.enum(["partner", "affiliate", ""]),
});

export type TwitchUser = z.infer<typeof TwitchUserSchema>;

/**
 * Fetch Twitch user profiles to check broadcaster_type.
 * - "partner" = established streamer (high bar)
 * - "affiliate" = at least 50 followers + streaming history
 * - "" = regular user (likely tiny account — 3 followers etc.)
 *
 * Returns only users that exist on Twitch. Missing usernames are omitted.
 */
export async function fetchTwitchUsers(
  usernames: string[]
): Promise<{ users: TwitchUser[]; error: string | null }> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const accessToken = process.env.TWITCH_ACCESS_TOKEN;

  if (!clientId || !accessToken) {
    return { users: [], error: "Twitch API keys not configured" };
  }

  try {
    const params = new URLSearchParams();
    for (const username of usernames.slice(0, 100)) {
      params.append("login", username);
    }

    const res = await fetch(
      `https://api.twitch.tv/helix/users?${params}`,
      {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${accessToken}`,
        },
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) {
      throw new Error(`Twitch Users API ${res.status}`);
    }

    const data = await res.json();
    const users: TwitchUser[] = (data.data ?? []).map(
      (u: { id: string; login: string; display_name: string; broadcaster_type: string }) => ({
        id: u.id,
        login: u.login.toLowerCase(),
        displayName: u.display_name,
        broadcasterType: u.broadcaster_type || "",
      })
    );

    return { users, error: null };
  } catch (err) {
    return {
      users: [],
      error: err instanceof Error ? err.message : "Twitch user fetch failed",
    };
  }
}

export function fetchTikTokLinks(usernames: string[]): TikTokResult {
  const links: TikTokLink[] = usernames.slice(0, 5).map((username) => ({
    platform: "tiktok" as const,
    username,
    url: `https://www.tiktok.com/@${username}`,
    displayName: `@${username}`,
  }));

  return TikTokResultSchema.parse({ links, error: null });
}
