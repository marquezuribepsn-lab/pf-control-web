import { NextRequest } from "next/server";

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

async function fetchOEmbedThumbnail(
  normalizedUrl: string,
  platform: MusicPlatform,
  signal: AbortSignal
): Promise<string | null> {
  const endpointByPlatform: Partial<Record<MusicPlatform, string>> = {
    SPOTIFY: `https://open.spotify.com/oembed?url=${encodeURIComponent(normalizedUrl)}`,
    YOUTUBE: `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`,
    YOUTUBE_MUSIC: `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`,
    SOUNDCLOUD: `https://soundcloud.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`,
  };

  const endpoint = endpointByPlatform[platform];
  if (!endpoint) return null;

  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as Record<string, unknown> | null;
    if (!payload || typeof payload !== "object") return null;
    return asNonEmptyString(payload.thumbnail_url);
  } catch {
    return null;
  }
}

/**
 * Proxy de portadas de playlists. Resuelve la miniatura via oEmbed y devuelve
 * los BYTES de la imagen desde nuestro propio servidor. Esto evita que el
 * navegador tenga que llamar al CDN de Spotify (que bloquea el hotlink por
 * referrer) y hace que el <img src="/api/musica/cover?url=..."> siempre cargue
 * desde el mismo dominio, incluso dentro del webview del alumno.
 */
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url") || "";
  const normalizedUrl = normalizeUrl(rawUrl);

  if (!normalizedUrl) {
    return new Response("Missing url", { status: 400 });
  }

  const platform = inferPlatformFromUrl(normalizedUrl);
  const lookupUrl = resolveLookupUrl(platform, normalizedUrl) || normalizedUrl;

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const thumbnailUrl = await fetchOEmbedThumbnail(lookupUrl, platform, abortController.signal);
    if (!thumbnailUrl) {
      return new Response("No cover", { status: 404 });
    }

    const imageResponse = await fetch(thumbnailUrl, {
      cache: "no-store",
      signal: abortController.signal,
      headers: {
        // Algunos CDNs devuelven 403 sin un user-agent de navegador.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    if (!imageResponse.ok || !imageResponse.body) {
      return new Response("Cover unavailable", { status: 404 });
    }

    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const buffer = await imageResponse.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Cache agresivo: la portada de una playlist casi no cambia.
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Cover error", { status: 404 });
  } finally {
    clearTimeout(timeout);
  }
}
