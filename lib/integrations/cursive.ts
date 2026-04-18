import "server-only";

// ---------------------------------------------------------------------------
// AudienceLab SuperPixel integration.
// Cursive is an AudienceLab reseller — this module talks directly to AL's
// public pixel API. Auth is `X-Api-Key`, NOT Bearer. Request body is
// camelCase, response is snake_case. See:
//   POST   https://api.audiencelab.io/pixels           (create)
//   DELETE https://api.audiencelab.io/pixels/{id}      (archive, 204)
//
// We intentionally do NOT pull a visitor list — AL is push-only via the
// webhook receiver at /api/webhooks/cursive.
// ---------------------------------------------------------------------------

const CURSIVE_BASE =
  process.env.CURSIVE_API_URL ?? "https://api.audiencelab.io";

function authHeaders(): HeadersInit {
  const key = process.env.CURSIVE_API_KEY;
  if (!key) throw new Error("CURSIVE_API_KEY not configured");
  return {
    "X-Api-Key": key,
    "Content-Type": "application/json",
  };
}

export type CursiveProvisionResponse = {
  pixelId: string;
  installUrl: string;
  scriptSnippet: string;
};

export async function provisionCursivePixel(params: {
  websiteName: string;
  websiteUrl: string;
  webhookUrl: string;
}): Promise<CursiveProvisionResponse> {
  const res = await fetch(`${CURSIVE_BASE}/pixels`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      websiteName: params.websiteName,
      websiteUrl: params.websiteUrl,
      webhookUrl: params.webhookUrl,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AudienceLab provision failed, ${res.status}: ${body}`);
  }
  const raw = (await res.json()) as Record<string, unknown>;
  const pixelId = typeof raw.pixel_id === "string" ? raw.pixel_id : "";
  const installUrl = typeof raw.install_url === "string" ? raw.install_url : "";
  const scriptSnippet = typeof raw.script === "string" ? raw.script : "";
  if (!pixelId || !installUrl || !scriptSnippet) {
    throw new Error(
      "AudienceLab provision response missing pixel_id, install_url, or script."
    );
  }
  return { pixelId, installUrl, scriptSnippet };
}

export async function archiveCursivePixel(pixelId: string): Promise<void> {
  const res = await fetch(
    `${CURSIVE_BASE}/pixels/${encodeURIComponent(pixelId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );
  // 204 No Content on success, 404 if already gone.
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    throw new Error(`AudienceLab archive failed, ${res.status}: ${body}`);
  }
}
