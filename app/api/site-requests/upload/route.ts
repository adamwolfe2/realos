import { NextResponse } from "next/server";
import { putPublic } from "@/lib/blob-public";

// ---------------------------------------------------------------------------
// POST /api/site-requests/upload
//
// Pre-submission asset upload endpoint. The intake form posts each file
// here as it's selected so the user gets immediate feedback (and the
// final POST /api/site-requests payload only carries blob URLs, never
// raw binary). We don't gate this with auth — uploads are short-lived
// and tied to a not-yet-created SiteRequest. A 50MB cap + mime allowlist
// keeps the abuse surface small.
//
// Returns: { ok, url, pathname, size, mimeType, filename }
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB per file
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf"];

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "Missing file field" },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: `File exceeds ${Math.round(MAX_BYTES / 1024 / 1024)}MB limit` },
      { status: 413 },
    );
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) {
    return NextResponse.json(
      { ok: false, error: `File type "${mimeType}" not allowed. Images and PDFs only.` },
      { status: 415 },
    );
  }

  // Random folder per upload so two intakes that both upload "logo.png"
  // don't collide. addRandomSuffix on the SDK side also helps but a
  // top-level partition keeps the blob store readable when browsing.
  const folder = `site-engine/intake/${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);

  try {
    const blob = await putPublic(`${folder}/${safeName}`, file, {
      addRandomSuffix: true,
    });
    return NextResponse.json({
      ok: true,
      url: blob.url,
      pathname: blob.pathname,
      size: file.size,
      mimeType,
      filename: file.name,
    });
  } catch (err) {
    console.error("[site-engine/upload] putPublic failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
