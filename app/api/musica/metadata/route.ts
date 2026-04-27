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

type MusicContentType = "SONG" | "PLAYLIST" | "OTHER";

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

function inferContentTypeFromUrl(platform: MusicPlatform, rawUrl: string): MusicContentType {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return "OTHER";

  if (platform === "AUDIO_FILE") return "SONG";

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return "OTHER";
  }

  const pathname = parsed.pathname.toLowerCase();

  if (platform === "SPOTIFY") {
    if (/\/(track|episode)\//i.test(pathname)) return "SONG";
    if (/\/(playlist|album|artist|show)\//i.test(pathname)) return "PLAYLIST";
    return "OTHER";
  }

  if (platform === "YOUTUBE" || platform === "YOUTUBE_MUSIC") {
    if (parsed.searchParams.get("list")) return "PLAYLIST";
    if (parsed.searchParams.get("v")) return "SONG";
    if (/\/(embed|shorts)\//i.test(pathname)) return "SONG";
    if (parsed.hostname.toLowerCase().includes("youtu.be")) return "SONG";
    return "OTHER";
  }

  if (platform === "SOUNDCLOUD") {
    if (pathname.includes("/sets/")) return "PLAYLIST";
    return "SONG";
  }

  if (platform === "APPLE_MUSIC") {
    if (parsed.searchParams.get("i")) return "SONG";
    if (/\/(song)\//i.test(pathname)) return "SONG";
    if (/\/(playlist|album)\//i.test(pathname)) return "PLAYLIST";
    return "OTHER";
  }

  if (platform === "DEEZER") {
    if (/\/(track)\//i.test(pathname)) return "SONG";
    if (/\/(playlist|album)\//i.test(pathname)) return "PLAYLIST";
    return "OTHER";
  }

  return "OTHER";
}

function resolveLookupUrl(platform: MusicPlatform, rawUrl: string): string {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return "";

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return normalized;
  }

  if (platform === "SPOTIFY") {
    const match = parsed.pathname.match(/\/(?:embed\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/i);
    if (match?.[1] && match?.[2]) {
      const kind = String(match[1]).toLowerCase();
      const id = String(match[2]).trim();
      if (kind && id) {
        return `https://open.spotify.com/${kind}/${id}`;
      }
    }
  }

  if (platform === "YOUTUBE" || platform === "YOUTUBE_MUSIC") {
    const embedMatch = parsed.pathname.match(/\/embed\/([^/?#]+)/i);
    if (embedMatch?.[1]) {
      return `https://www.youtube.com/watch?v=${embedMatch[1]}`;
    }

    const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?#]+)/i);
    if (shortsMatch?.[1]) {
      return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
    }

    if (parsed.hostname.toLowerCase().includes("youtu.be")) {
      const shortId = parsed.pathname.replace(/^\//, "").split("/")[0];
      if (shortId) {
        return `https://www.youtube.com/watch?v=${shortId}`;
      }
    }
  }

  return normalized;
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
  const lookupUrl = resolveLookupUrl(platform, normalizedUrl) || normalizedUrl;
  const contentType = inferContentTypeFromUrl(platform, lookupUrl);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const metadata = await resolveMetadata(lookupUrl, platform, abortController.signal);

    return NextResponse.json({
      ok: true,
      platform,
      contentType,
      playlistName: metadata.playlistName,
      thumbnailUrl: metadata.thumbnailUrl,
    });
  } catch {
    return NextResponse.json({
      ok: true,
      platform,
      contentType,
      playlistName: null,
      thumbnailUrl: null,
    });
  } finally {
    clearTimeout(timeout);
  }
}
