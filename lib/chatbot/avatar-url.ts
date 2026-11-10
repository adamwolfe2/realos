// Operator-uploaded chatbot avatars live in Vercel Blob at whatever size
// was uploaded (Telegraph Commons' was a 1.5 MB PNG), and the embed shows
// them at 28-60px on every page of every tenant site. Route Blob avatars
// through our own Next image optimizer at 128px (60px launcher @2x); it
// negotiates AVIF/WebP from the <img> Accept header and caches at the edge.
// Other URLs pass through untouched: they may not be in remotePatterns.
const AVATAR_WIDTH = 128;
const BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/;

export function optimizedAvatarUrl(raw: string | null | undefined, origin: string): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  if (url.protocol !== "https:" || !BLOB_HOST.test(url.hostname) || /\.svg$/i.test(url.pathname)) {
    return raw;
  }
  return `${origin}/_next/image?url=${encodeURIComponent(raw)}&w=${AVATAR_WIDTH}&q=75`;
}
