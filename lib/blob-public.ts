// ---------------------------------------------------------------------------
// Public-blob helper.
//
// Vercel Blob has two store types: PUBLIC (clean URLs accessible to anyone)
// and PRIVATE (requires signed URLs for reads). The default
// BLOB_READ_WRITE_TOKEN on the realestaite project happens to point at a
// PRIVATE store (`realestaite-blob`, store_1FUoGJOrXneOAwgT). That breaks
// any code that calls `put(..., { access: 'public' })` — the SDK errors
// with "Cannot use public access on a private store".
//
// We ALSO have a public store (`leasetasck-blob`, store_cAWUOTIZaAHwOS45)
// linked to the same project. Its token lives at
// `blob_leasestack_READ_WRITE_TOKEN`.
//
// Use the helpers here for any asset that needs to be publicly readable
// from the open web (chatbot avatars rendered on customer marketing
// sites, white-label logos, bug-report screenshots viewed by support, etc).
// Use the default @vercel/blob `put`/`del` directly for genuinely private
// assets (audit-trail uploads, exports, internal screenshots).
// ---------------------------------------------------------------------------

import { put, del, type PutCommandOptions, type PutBlobResult } from "@vercel/blob";

/** Token for the PUBLIC blob store. Always present at runtime; warn if not. */
function publicToken(): string {
  // Vercel's storage integration provisions env vars with the store-name
  // prefix in lowercase. Fall back to BLOB_READ_WRITE_TOKEN ONLY when the
  // public token is missing, so local dev against a fresh store still
  // works without manual env var fiddling.
  const t =
    process.env.blob_leasestack_READ_WRITE_TOKEN ||
    process.env.BLOB_PUBLIC_READ_WRITE_TOKEN ||
    process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) {
    throw new Error(
      "Public-blob token missing. Set blob_leasestack_READ_WRITE_TOKEN (or BLOB_PUBLIC_READ_WRITE_TOKEN) to a token from a PUBLIC Vercel Blob store.",
    );
  }
  return t;
}

/** Upload to the PUBLIC blob store. URL is reachable from any browser. */
export async function putPublic(
  pathname: string,
  body: Blob | File | ArrayBuffer | Buffer | string | ReadableStream,
  options: Omit<PutCommandOptions, "access" | "token"> = {},
): Promise<PutBlobResult> {
  return put(pathname, body, {
    ...options,
    access: "public",
    token: publicToken(),
  });
}

/**
 * Delete a blob from the PUBLIC store. Safe to call with a non-public URL —
 * it just no-ops with an error we swallow upstream.
 */
export async function delPublic(url: string | string[]): Promise<void> {
  return del(url, { token: publicToken() });
}
