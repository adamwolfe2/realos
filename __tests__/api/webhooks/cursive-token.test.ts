import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import {
  createCursivePrismaMock,
  type CursivePrismaMock,
} from "../../helpers/cursive-prisma-mock";

// Tests for /api/webhooks/cursive/[token] — the per-tenant path-token
// receiver used by AudienceLab's per-pixel webhook UI. The URL path is
// the auth, no shared secret or HMAC required. The token is looked up
// against CursiveIntegration.webhookToken, and a malformed token must
// 404 before any DB lookup.

const PIXEL_ID = "00000000-0000-0000-0000-000000000001";
const ORG_ID = "org-tc-1";
const TOKEN = "abcdef0123456789abcdef0123456789"; // 32-char lowercase hex

let mock: CursivePrismaMock;

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mock.prisma;
  },
}));

const { POST } = await import(
  "@/app/api/webhooks/cursive/[token]/route"
);

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function enrichedPageView(overrides: Record<string, unknown> = {}) {
  return {
    pixel_id: PIXEL_ID,
    profile_id: "profile-001",
    uid: "uid-001",
    hem_sha256: sha256("jane@example.com"),
    event: "page_view",
    event_timestamp: "2026-04-17T12:00:30Z",
    page_url: "https://telegraphcommons.com/floor-plans",
    resolution: {
      FIRST_NAME: "Jane",
      LAST_NAME: "Doe",
      PERSONAL_EMAILS: "jane@gmail.com",
      PERSONAL_EMAIL_VALIDATION_STATUS: "Valid (esp)",
      MOBILE_PHONE: "+15551234567",
      COMPANY_DOMAIN: "acme.com",
    },
    ...overrides,
  };
}

function makeRequest(
  body: unknown,
  opts: { rawBody?: string } = {},
): NextRequest {
  const raw =
    opts.rawBody ?? (typeof body === "string" ? body : JSON.stringify(body));
  return new NextRequest(`http://localhost/api/webhooks/cursive/${TOKEN}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw,
  });
}

async function post(req: NextRequest, token: string) {
  const res = await POST(req, { params: Promise.resolve({ token }) });
  const json = (await res.json()) as {
    ok?: boolean;
    duplicate?: boolean;
    error?: string;
    events?: number;
    processed?: Array<{
      visitorId: string | null;
      leadId: string | null;
      skipped?: string;
    }>;
  };
  return { status: res.status, json };
}

beforeEach(() => {
  mock = createCursivePrismaMock();
});

describe("Cursive path-token webhook receiver", () => {
  it("404s on malformed token without touching the DB", async () => {
    const req = makeRequest(enrichedPageView());
    const { status, json } = await post(req, "not-hex");
    expect(status).toBe(404);
    expect(json.error).toBe("Not found");
    expect(mock.prisma.cursiveIntegration.findUnique).not.toHaveBeenCalled();
  });

  it("404s on unknown token", async () => {
    const req = makeRequest(enrichedPageView());
    const { status, json } = await post(req, TOKEN);
    expect(status).toBe(404);
    expect(json.error).toBe("Not found");
  });

  it("processes a resolved page_view via valid token", async () => {
    mock.seedIntegration({
      orgId: ORG_ID,
      cursivePixelId: PIXEL_ID,
      webhookToken: TOKEN,
      installedOnDomain: "telegraphcommons.com",
    });
    const req = makeRequest(enrichedPageView());
    const { status, json } = await post(req, TOKEN);
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.processed?.[0].visitorId).toBeTruthy();
    expect(mock.store.visitors).toHaveLength(1);
    expect(mock.store.visitors[0].orgId).toBe(ORG_ID);
  });

  it("rejects events whose pixel_id does not match the token's tenant", async () => {
    mock.seedIntegration({
      orgId: ORG_ID,
      cursivePixelId: PIXEL_ID,
      webhookToken: TOKEN,
    });
    const ev = enrichedPageView({ pixel_id: "different-pixel" });
    const { json } = await post(makeRequest(ev), TOKEN);
    expect(json.processed?.[0].skipped).toBe("pixel_id mismatch");
    expect(mock.store.visitors).toHaveLength(0);
  });

  it("dedupes byte-identical retries via body hash", async () => {
    mock.seedIntegration({
      orgId: ORG_ID,
      cursivePixelId: PIXEL_ID,
      webhookToken: TOKEN,
    });
    const ev = enrichedPageView();
    await post(makeRequest(ev), TOKEN);
    const { json } = await post(makeRequest(ev), TOKEN);
    expect(json.duplicate).toBe(true);
  });

  it("requires no auth header on a valid token", async () => {
    mock.seedIntegration({
      orgId: ORG_ID,
      cursivePixelId: PIXEL_ID,
      webhookToken: TOKEN,
    });
    // Build the request with no auth headers whatsoever — this is the
    // exact scenario AL's per-pixel webhook UI produces.
    const raw = JSON.stringify(enrichedPageView());
    const req = new NextRequest(
      `http://localhost/api/webhooks/cursive/${TOKEN}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: raw,
      },
    );
    const { status } = await post(req, TOKEN);
    expect(status).toBe(200);
  });
});
