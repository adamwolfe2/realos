import "server-only";

// ---------------------------------------------------------------------------
// remove.bg API wrapper.
//
// Used by the property hero image upload route to auto-cut out the
// building so the dashboard hero treatment (drop-shadow, ground-shadow,
// spill-over-card) reads as a real 3D float instead of a flat photo.
//
// API docs: https://www.remove.bg/api
// Pricing: free tier 50/mo, paid $0.20/image OR $99/mo unlimited.
//
// Replicate fallback: if REPLICATE_API_TOKEN is set instead of (or in
// addition to) REMOVEBG_API_KEY, we use Replicate's u2net background
// removal model — ~$0.001/image, slower (~10s vs ~3s).
//
// IMPORTANT: this module is env-gated. If neither key is configured,
// `removeBackground` returns the original Buffer unchanged so the
// upload still works during dev / before the keys are wired.
// ---------------------------------------------------------------------------

const REMOVEBG_API_URL = "https://api.remove.bg/v1.0/removebg";
const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";
const REPLICATE_BG_MODEL_VERSION =
  // 851-labs/background-remover (u2net under the hood) — current stable
  // version hash. Pin so a model upgrade doesn't silently change output.
  "a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc";

export type RemoveBgResult =
  | { ok: true; buffer: Buffer; contentType: string; provider: "removebg" | "replicate" }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; error: string };

const TIMEOUT_MS = 30_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Strip the background from an image. Returns a PNG with alpha channel.
 * Falls through to the original buffer + `skipped: true` when no
 * provider is configured.
 *
 * Provider priority: REMOVEBG_API_KEY -> REPLICATE_API_TOKEN -> skip.
 */
export async function removeBackground(input: {
  buffer: Buffer;
  filename: string;
  contentType: string;
}): Promise<RemoveBgResult> {
  const { buffer, filename, contentType } = input;

  if (process.env.REMOVEBG_API_KEY) {
    return removeViaRemoveBg(buffer, filename, contentType);
  }
  if (process.env.REPLICATE_API_TOKEN) {
    return removeViaReplicate(buffer, contentType);
  }
  return {
    ok: false,
    skipped: true,
    reason:
      "Neither REMOVEBG_API_KEY nor REPLICATE_API_TOKEN configured. Upload proceeded without background removal.",
  };
}

async function removeViaRemoveBg(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<RemoveBgResult> {
  const form = new FormData();
  // Build a Blob from the buffer for FormData. Node 20+ supports this
  // natively via the global Blob constructor.
  const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
  form.append("image_file", blob, filename);
  // `auto` (default) usually wins for building exteriors. Override to
  // `product` if we see consistent failures on architectural shots —
  // it's tuned for sharper edge contrast on rectilinear subjects.
  form.append("size", "auto");
  // PNG preserves the alpha; remove.bg's "transparent" type is the
  // alpha-channel cut we need for the dashboard hero treatment.
  form.append("format", "png");
  // No bg color — pure transparency.
  form.append("type", "auto");

  let res: Response;
  try {
    res = await fetchWithTimeout(REMOVEBG_API_URL, {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.REMOVEBG_API_KEY!,
        // FormData sets its own boundary; don't override Content-Type.
      },
      body: form,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: `remove.bg request failed: ${message}` };
  }

  if (!res.ok) {
    let body = "";
    try {
      body = await res.text();
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: `remove.bg ${res.status}: ${body.slice(0, 200)}`,
    };
  }

  const arrayBuf = await res.arrayBuffer();
  return {
    ok: true,
    buffer: Buffer.from(arrayBuf),
    contentType: "image/png",
    provider: "removebg",
  };
}

async function removeViaReplicate(
  buffer: Buffer,
  contentType: string,
): Promise<RemoveBgResult> {
  // Replicate accepts data URIs for input. Base64-encode the buffer.
  const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;

  let createRes: Response;
  try {
    createRes = await fetchWithTimeout(REPLICATE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: REPLICATE_BG_MODEL_VERSION,
        input: { image: dataUri },
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: `Replicate request failed: ${message}` };
  }

  if (!createRes.ok) {
    let body = "";
    try {
      body = await createRes.text();
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: `Replicate create ${createRes.status}: ${body.slice(0, 200)}`,
    };
  }

  const prediction = (await createRes.json()) as {
    id: string;
    status: string;
    output: string | string[] | null;
    error: string | null;
    urls: { get: string };
  };

  // Poll for completion. Replicate's BG removal usually takes 4–10s.
  // Cap at 25s so we don't hit Vercel's 30s function timeout.
  const deadline = Date.now() + 25_000;
  let current = prediction;
  while (
    current.status !== "succeeded" &&
    current.status !== "failed" &&
    current.status !== "canceled" &&
    Date.now() < deadline
  ) {
    await new Promise((r) => setTimeout(r, 1200));
    try {
      const poll = await fetchWithTimeout(current.urls.get, {
        headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN!}` },
      });
      if (!poll.ok) {
        return { ok: false, error: `Replicate poll ${poll.status}` };
      }
      current = (await poll.json()) as typeof current;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      return { ok: false, error: `Replicate poll failed: ${message}` };
    }
  }

  if (current.status !== "succeeded") {
    return {
      ok: false,
      error: `Replicate prediction ${current.status}: ${current.error ?? "unknown"}`,
    };
  }

  const outputUrl =
    typeof current.output === "string"
      ? current.output
      : Array.isArray(current.output)
        ? current.output[0]
        : null;
  if (!outputUrl) {
    return { ok: false, error: "Replicate returned no output URL" };
  }

  // Fetch the resulting PNG so we can re-upload to our own blob store.
  let pngRes: Response;
  try {
    pngRes = await fetchWithTimeout(outputUrl, { method: "GET" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: `Replicate output fetch failed: ${message}` };
  }
  if (!pngRes.ok) {
    return {
      ok: false,
      error: `Replicate output fetch ${pngRes.status}`,
    };
  }
  const arr = await pngRes.arrayBuffer();
  return {
    ok: true,
    buffer: Buffer.from(arr),
    contentType: "image/png",
    provider: "replicate",
  };
}
