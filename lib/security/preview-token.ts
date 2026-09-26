import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Share tokens for the public draft previews (/preview/content/[id],
// /preview/neighborhood/[id]). The record CUID alone used to be the only
// access check (TOKEN-CUID): CUIDs are sortable and partly predictable, not a
// secret. The token is HMAC-SHA256(`${kind}:${id}`) under a dedicated
// PREVIEW_LINK_SECRET, so links stay stable (no DB column, no expiry) and
// rotating the secret revokes every link at once. No secret = fail closed.

export type PreviewKind = "content" | "neighborhood";

function sign(kind: PreviewKind, id: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${kind}:${id}`)
    .digest("base64url");
}

function secret(): string | null {
  return process.env.PREVIEW_LINK_SECRET?.trim() || null;
}

/** Relative preview URL with its token, or null when no secret is set. */
export function previewPath(kind: PreviewKind, id: string): string | null {
  const s = secret();
  if (!s) return null;
  return `/preview/${kind}/${id}?t=${sign(kind, id, s)}`;
}

export function verifyPreviewToken(
  kind: PreviewKind,
  id: string,
  token: string | string[] | undefined,
): boolean {
  const s = secret();
  if (!s || typeof token !== "string" || token.length === 0) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(sign(kind, id, s));
  return a.length === b.length && timingSafeEqual(a, b);
}
