import { NextRequest, NextResponse } from "next/server";

type MusicPlatform =
  | "SPOTIFY"
  | "YOUTUBE"
  | "YOUTUBE_MUSIC"
  | "SOUNDCLOUD"
  | "APPLE_MUSIC"
  | "DEEZER"
  | "AMAZON_MUSIC"
  | "AUDIO_FILE"
  | "OTHER";

const REQUEST_TIMEOUT_MS = 5000;

function normalizeUrl(rawUrl: string): string {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function looksLikeAudioFile(rawUrl: string): boolean {
  const lower = String(rawUrl || "").toLowerCase();
  return [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"].some((ext) => lower.includes(ext));
}

function inferPlatformFromUrl(rawUrl: string): MusicPlatform {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return "OTHER";

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return looksLikeAudioFile(normalized) ? "AUDIO_FILE" : "OTHER";
  }

  const host = parsed.hostname.toLowerCase();
  if (host.includes("open.spotify.com")) return "SPOTIFY";
  if (host.includes("music.youtube.com")) return "YOUTUBE_MUSIC";
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "YOUTUBE";
  if (host.includes("soundcloud.com") || host.includes("snd.sc")) return "SOUNDCLOUD";
  if (host.includes("music.apple.com")) return "APPLE_MUSIC";
  if (host.includes("deezer.com")) return "DEEZER";
  if (host.includes("music.amazon.")) return "AMAZON_MUSIC";
  if (looksLikeAudioFile(normalized)) return "AUDIO_FILE";

  return "OTHER";
}

function asNonEmptyString(value: unknown): string | null {
  const text = String(value || "").trim();
  return text ? text : null;
}

async function fetchOEmbedJson(url: string, signal: AbortSignal): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== "object") {
      return null;
    }

    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function resolveMetadata(
  normalizedUrl: string,
  platform: MusicPlatform,
  signal: AbortSignal
): Promise<{ playlistName: string | null; thumbnailUrl: string | null }> {
  const endpointByPlatform: Partial<Record<MusicPlatform, string>> = {
    SPOTIFY: `https://open.spotify.com/oembed?url=${encodeURIComponent(normalizedUrl)}`,
    YOUTUBE: `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`,
    YOUTUBE_MUSIC: `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`,
    SOUNDCLOUD: `https://soundcloud.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`,
  };

  const endpoint = endpointByPlatform[platform];
  if (!endpoint) {
    return { playlistName: null, thumbnailUrl: null };
  }

  const payload = await fetchOEmbedJson(endpoint, signal);
  if (!payload) {
    return { playlistName: null, thumbnailUrl: null };
  }

  const playlistName = asNonEmptyString(payload.title);
  const thumbnailUrl = asNonEmptyString(payload.thumbnail_url);

  return { playlistName, thumbnailUrl };
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url") || "";
  const normalizedUrl = normalizeUrl(rawUrl);

  if (!normalizedUrl) {
    return NextResponse.json({ ok: false, error: "Missing url" }, { status: 400 });
  }

  const platform = inferPlatformFromUrl(normalizedUrl);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const metadata = await resolveMetadata(normalizedUrl, platform, abortController.signal);

    return NextResponse.json({
      ok: true,
      platform,
      playlistName: metadata.playlistName,
      thumbnailUrl: metadata.thumbnailUrl,
    });
  } catch {
    return NextResponse.json({
      ok: true,
      platform,
      playlistName: null,
      thumbnailUrl: null,
    });
  } finally {
    clearTimeout(timeout);
  }
}
