import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import {
  createCursivePrismaMock,
  type CursivePrismaMock,
} from "../../helpers/cursive-prisma-mock";

/**
 * End-to-end tests for the AudienceLab SuperPixel webhook receiver.
 *
 * Drives the real POST handler at app/api/webhooks/cursive/route.ts with a
 * stateful in-memory Prisma mock, exercising:
 *   - auth (shared secret + HMAC, both header variants)
 *   - body size limits and wrapper shapes
 *   - tenant routing via pixel_id (top-level + resolution.pixel_id)
 *   - body-hash and event-fingerprint dedupe
 *   - identity cascade (auth → enriched page_view merging onto same Visitor)
 *   - lead deliverability gate (spec §10) and lead upsert
 *   - CursiveIntegration counter updates
 *
 * The receiver imports `prisma` from @/lib/db, so we vi.mock that module.
 * The mock is re-created in beforeEach to guarantee test isolation.
 */

const PIXEL_ID = "00000000-0000-0000-0000-000000000001";
const ORG_ID = "org-tc-1";
const SECRET = "test-webhook-secret";

let mock: CursivePrismaMock;

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mock.prisma;
  },
}));

// Import after vi.mock so the receiver picks up the proxied prisma.
const { POST } = await import("@/app/api/webhooks/cursive/route");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function authEvent(overrides: Record<string, unknown> = {}) {
  return {
    pixel_id: PIXEL_ID,
    cookie_id: "cookie-abc",
    event: "authentication",
    email_raw: "jane@example.com",
    hem: "d41d8cd98f00b204e9800998ecf8427e",
    ip: "192.0.2.1",
    user_agent: "Mozilla/5.0",
    event_timestamp: "2026-04-17T12:00:00Z",
    ...overrides,
  };
}

function enrichedPageView(overrides: Record<string, unknown> = {}) {
  return {
    pixel_id: PIXEL_ID,
    profile_id: "profile-001",
    uid: "uid-001",
    hem_sha256: sha256("jane@example.com"),
    event: "page_view",
    event_timestamp: "2026-04-17T12:00:30Z",
    ip_address: "192.0.2.1",
    page_url: "https://telegraphcommons.com/floor-plans",
    resolution: {
      FIRST_NAME: "Jane",
      LAST_NAME: "Doe",
      PERSONAL_EMAILS: "jane@gmail.com,jane.alt@gmail.com",
      BUSINESS_EMAIL: "jane@acme.com",
      PERSONAL_EMAIL_VALIDATION_STATUS: "Valid (esp)",
      MOBILE_PHONE: "+15551234567",
      COMPANY_NAME: "Acme Corp",
      COMPANY_DOMAIN: "acme.com",
      JOB_TITLE: "VP Marketing",
      PERSONAL_CITY: "Austin",
      STATE: "TX",
      ZIP: "78701",
    },
    ...overrides,
  };
}

function anonymousPageView(overrides: Record<string, unknown> = {}) {
  return {
    pixel_id: PIXEL_ID,
    cookie_id: "cookie-anon",
    event: "page_view",
    event_timestamp: "2026-04-17T11:00:00Z",
    page_url: "https://telegraphcommons.com/",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function hmac(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function makeRequest(
  body: unknown,
  opts: {
    headers?: Record<string, string>;
    signWith?: "shared-secret" | "signature" | "signature-prefixed" |
      "alias-signature" | "bad-hmac" | "bad-shared" | "none";
    rawBody?: string;
  } = {}
): NextRequest {
  const raw =
    opts.rawBody ?? (typeof body === "string" ? body : JSON.stringify(body));
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(opts.headers ?? {}),
  };
  const mode = opts.signWith ?? "shared-secret";
  if (mode === "shared-secret") {
    headers["x-audiencelab-secret"] = SECRET;
  } else if (mode === "signature") {
    headers["x-audiencelab-signature"] = `sha256=${hmac(raw, SECRET)}`;
  } else if (mode === "signature-prefixed") {
    headers["x-audiencelab-signature"] = hmac(raw, SECRET);
  } else if (mode === "alias-signature") {
    headers["x-webhook-signature"] = `sha256=${hmac(raw, SECRET)}`;
  } else if (mode === "bad-hmac") {
    headers["x-audiencelab-signature"] = "sha256=deadbeef";
  } else if (mode === "bad-shared") {
    headers["x-audiencelab-secret"] = "wrong-secret";
  }
  return new NextRequest("http://localhost/api/webhooks/cursive", {
    method: "POST",
    headers,
    body: raw,
  });
}

async function post(req: NextRequest) {
  const res = await POST(req);
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mock = createCursivePrismaMock();
  process.env.CURSIVE_WEBHOOK_SECRET = SECRET;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Cursive/AudienceLab webhook receiver — auth", () => {
  it("rejects when CURSIVE_WEBHOOK_SECRET is not configured (500)", async () => {
    delete process.env.CURSIVE_WEBHOOK_SECRET;
    const req = makeRequest(authEvent(), { signWith: "none" });
    const { status, json } = await post(req);
    expect(status).toBe(500);
    expect(json.error).toBeTruthy();
  });

  it("rejects when neither auth header is present (401)", async () => {
    const req = makeRequest(authEvent(), { signWith: "none" });
    const { status, json } = await post(req);
    expect(status).toBe(401);
    expect(json.error).toBe("Invalid signature");
  });

  it("accepts shared-secret via x-audiencelab-secret", async () => {
    mock.seedIntegration({ orgId: ORG_ID, cursivePixelId: PIXEL_ID });
    const req = makeRequest(authEvent(), { signWith: "shared-secret" });
    const { status, json } = await post(req);
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("accepts x-audiencelab-signature with sha256= prefix", async () => {
    mock.seedIntegration({ orgId: ORG_ID, cursivePixelId: PIXEL_ID });
    const req = makeRequest(authEvent(), { signWith: "signature" });
    const { status, json } = await post(req);
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("accepts x-audiencelab-signature without sha256= prefix", async () => {
    mock.seedIntegration({ orgId: ORG_ID, cursivePixelId: PIXEL_ID });
    const req = makeRequest(authEvent(), { signWith: "signature-prefixed" });
    const { status, json } = await post(req);
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("accepts x-webhook-signature as a signature alias", async () => {
    mock.seedIntegration({ orgId: ORG_ID, cursivePixelId: PIXEL_ID });
    const req = makeRequest(authEvent(), { signWith: "alias-signature" });
    const { status, json } = await post(req);
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("rejects wrong shared-secret (401)", async () => {
    const req = makeRequest(authEvent(), { signWith: "bad-shared" });
    const { status } = await post(req);
    expect(status).toBe(401);
  });

  it("rejects bad HMAC signature (401)", async () => {
    const req = makeRequest(authEvent(), { signWith: "bad-hmac" });
    const { status } = await post(req);
    expect(status).toBe(401);
  });
});

describe("body limits", () => {
  it("rejects bodies larger than 3MB (413)", async () => {
    // Shared secret does NOT depend on body hash, so we can send junk.
    const huge = "x".repeat(3 * 1024 * 1024 + 16);
    const req = new NextRequest("http://localhost/api/webhooks/cursive", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-audiencelab-secret": SECRET,
      },
      body: huge,
    });
    const { status, json } = await post(req);
    expect(status).toBe(413);
    expect(json.error).toMatch(/too large/i);
  });
});

describe("payload shapes", () => {
  beforeEach(() => {
    mock.seedIntegration({ orgId: ORG_ID, cursivePixelId: PIXEL_ID });
  });

  it("processes a single event object", async () => {
    const req = makeRequest(authEvent());
    const { status, json } = await post(req);
    expect(status).toBe(200);
    expect(json.events).toBe(1);
    expect(json.processed).toHaveLength(1);
  });

  it("processes a bare array of events", async () => {
    const body = [
      authEvent({ event_timestamp: "2026-04-17T12:00:00Z" }),
      authEvent({
        event_timestamp: "2026-04-17T12:00:01Z",
        email_raw: "b@example.com",
      }),
      authEvent({
        event_timestamp: "2026-04-17T12:00:02Z",
        email_raw: "c@example.com",
      }),
    ];
    const req = makeRequest(body);
    const { status, json } = await post(req);
    expect(status).toBe(200);
    expect(json.events).toBe(3);
    expect(json.processed).toHaveLength(3);
  });

  it("processes the { result: [...] } wrapper", async () => {
    const body = {
      result: [
        enrichedPageView({ event_timestamp: "2026-04-17T12:00:00Z" }),
        enrichedPageView({
          event_timestamp: "2026-04-17T12:00:01Z",
          profile_id: "profile-002",
          uid: "uid-002",
        }),
      ],
    };
    const req = makeRequest(body);
    const { status, json } = await post(req);
    expect(status).toBe(200);
    expect(json.events).toBe(2);
  });

  it("rejects empty arrays (400)", async () => {
    const req = makeRequest([]);
    const { status, json } = await post(req);
    expect(status).toBe(400);
    expect(json.error).toBe("No events");
  });
});

describe("tenant routing via pixel_id", () => {
  it("skips events missing pixel_id at every level", async () => {
    mock.seedIntegration({ orgId: ORG_ID, cursivePixelId: PIXEL_ID });
    const ev = authEvent();
    delete (ev as Record<string, unknown>).pixel_id;
    const req = makeRequest(ev);
    const { status, json } = await post(req);
    expect(status).toBe(200);
    expect(json.processed?.[0].skipped).toBe("no pixel_id");
    expect(mock.store.visitors).toHaveLength(0);
  });

  it("skips events whose pixel_id has no CursiveIntegration", async () => {
    // no seedIntegration call — pixel is unknown
    const req = makeRequest(authEvent());
    const { status, json } = await post(req);
    expect(status).toBe(200);
    expect(json.processed?.[0].skipped).toBe("unknown pixel");
    expect(mock.store.visitors).toHaveLength(0);
  });

  it("routes via top-level pixel_id", async () => {
    mock.seedIntegration({ orgId: ORG_ID, cursivePixelId: PIXEL_ID });
    const req = makeRequest(authEvent());
    const { status, json } = await post(req);
    expect(status).toBe(200);
    expect(json.processed?.[0].visitorId).toBeTruthy();
    expect(mock.store.visitors[0].orgId).toBe(ORG_ID);
  });

  it("routes via resolution.pixel_id fallback", async () => {
    mock.seedIntegration({ orgId: ORG_ID, cursivePixelId: PIXEL_ID });
    const ev = enrichedPageView() as Record<string, unknown>;
    delete ev.pixel_id;
    (ev.resolution as Record<string, unknown>).pixel_id = PIXEL_ID;
    const req = makeRequest(ev);
    const { status, json } = await post(req);
    expect(status).toBe(200);
    expect(json.processed?.[0].visitorId).toBeTruthy();
  });
});

describe("dedupe", () => {
  beforeEach(() => {
    mock.seedIntegration({ orgId: ORG_ID, cursivePixelId: PIXEL_ID });
  });

  it("returns { duplicate: true } for byte-identical body retries", async () => {
    const body = enrichedPageView();
    const r1 = await post(makeRequest(body));
    expect(r1.status).toBe(200);
    expect(r1.json.ok).toBe(true);

    const before = mock.store.visitors.length;
    const r2 = await post(makeRequest(body));
    expect(r2.status).toBe(200);
    expect(r2.json.duplicate).toBe(true);
    // No additional visitor writes on dedupe
    expect(mock.store.visitors.length).toBe(before);
  });

  it("skips duplicate fingerprints across different bodies", async () => {
    // Same (pixel_id, profile_id, event_timestamp, event_type) but
    // wrapped differently so bodyHash differs.
    const ev = enrichedPageView();
    await post(makeRequest(ev));

    const wrapped = { result: [enrichedPageView()] };
    const r2 = await post(makeRequest(wrapped));
    expect(r2.status).toBe(200);
    expect(r2.json.duplicate).toBeUndefined();
    expect(r2.json.processed?.[0].skipped).toBe("duplicate event");
  });

  it("does not attempt fingerprint dedupe when profile_id is absent", async () => {
    // Two auth events with identical timestamp but no profile_id still
    // both process (bodies differ → no body-hash dedupe either).
    const a = authEvent({ email_raw: "a@x.com" });
    const b = authEvent({ email_raw: "b@x.com" });
    const r1 = await post(makeRequest(a));
    const r2 = await post(makeRequest(b));
    expect(r1.json.processed?.[0].skipped).toBeUndefined();
    expect(r2.json.processed?.[0].skipped).toBeUndefined();
    expect(mock.store.visitors.length).toBe(2);
  });
});

describe("identity cascade and enrichment merging", () => {
  beforeEach(() => {
    mock.seedIntegration({
      orgId: ORG_ID,
      cursivePixelId: PIXEL_ID,
      installedOnDomain: "telegraphcommons.com",
    });
  });

  it("auth event then enriched page_view merge onto the SAME Visitor", async () => {
    // Step 1: auth event — no profile_id/uid/hem_sha256. Receiver should
    // compute hem_sha256 from email_raw and store it as hashedEmail.
    const auth = authEvent({ email_raw: "jane@example.com" });
    const r1 = await post(makeRequest(auth));
    expect(r1.status).toBe(200);
    expect(mock.store.visitors).toHaveLength(1);
    const v1 = mock.store.visitors[0];
    expect(v1.hashedEmail).toBe(sha256("jane@example.com"));
    expect(v1.email).toBe("jane@example.com");

    // Step 2: enriched page_view ~30s later. Same email → same hem_sha256.
    const enriched = enrichedPageView({
      hem_sha256: sha256("jane@example.com"),
    });
    const r2 = await post(makeRequest(enriched));
    expect(r2.status).toBe(200);

    // Still just one visitor.
    expect(mock.store.visitors).toHaveLength(1);
    const v2 = mock.store.visitors[0];
    // cursiveVisitorId promoted to profile_id (highest priority identity)
    expect(v2.cursiveVisitorId).toBe("profile-001");
    // Enriched fields merged in
    expect(v2.firstName).toBe("Jane");
    expect(v2.lastName).toBe("Doe");
    expect(v2.phone).toBe("+15551234567");
    // status upgraded from ANONYMOUS → IDENTIFIED
    expect(v2.status).toBe("IDENTIFIED");
  });

  it("preserves existing fields when incoming values are null/absent", async () => {
    // Seed with enriched data first
    const enriched = enrichedPageView();
    await post(makeRequest(enriched));
    expect(mock.store.visitors).toHaveLength(1);
    const before = mock.store.visitors[0];
    expect(before.firstName).toBe("Jane");

    // Second enriched event with NO first name in resolution
    const partial = enrichedPageView({
      event_timestamp: "2026-04-17T12:10:00Z",
      resolution: {
        PERSONAL_EMAIL_VALIDATION_STATUS: "Valid (esp)",
        COMPANY_DOMAIN: "acme.com",
        MOBILE_PHONE: "+15551234567",
        LAST_NAME: "Doe",
        PERSONAL_EMAILS: "jane@gmail.com",
        // FIRST_NAME intentionally omitted
      },
    });
    await post(makeRequest(partial));

    const after = mock.store.visitors[0];
    expect(after.firstName).toBe("Jane"); // preserved, not wiped
    expect(after.lastName).toBe("Doe");
  });
});

describe("lead gate (spec §10)", () => {
  beforeEach(() => {
    mock.seedIntegration({
      orgId: ORG_ID,
      cursivePixelId: PIXEL_ID,
      installedOnDomain: "telegraphcommons.com",
    });
  });

  it("creates a Lead for identified + Valid (esp) + phone + company (score ≥ 60)", async () => {
    const req = makeRequest(enrichedPageView());
    const { status, json } = await post(req);
    expect(status).toBe(200);
    expect(json.processed?.[0].leadId).toBeTruthy();
    expect(mock.store.leads).toHaveLength(1);
    expect(mock.store.leads[0].source).toBe("PIXEL_OUTREACH");
    expect(mock.store.leads[0].email).toBe("jane@gmail.com"); // personal first
  });

  it("does NOT create a Lead for identified + Valid only (score = 30)", async () => {
    const ev = enrichedPageView({
      resolution: {
        FIRST_NAME: "Jane",
        LAST_NAME: "Doe",
        PERSONAL_EMAILS: "jane@gmail.com",
        PERSONAL_EMAIL_VALIDATION_STATUS: "Valid",
        // no phone, no company domain
      },
    });
    const { json } = await post(makeRequest(ev));
    expect(json.processed?.[0].leadId).toBeNull();
    expect(mock.store.leads).toHaveLength(0);
  });

  it("does NOT create a Lead for Catch-all + phone + company (score = 35)", async () => {
    const ev = enrichedPageView({
      resolution: {
        FIRST_NAME: "Jane",
        LAST_NAME: "Doe",
        PERSONAL_EMAILS: "jane@gmail.com",
        PERSONAL_EMAIL_VALIDATION_STATUS: "Catch-all",
        MOBILE_PHONE: "+15551234567",
        COMPANY_DOMAIN: "acme.com",
      },
    });
    const { json } = await post(makeRequest(ev));
    expect(json.processed?.[0].leadId).toBeNull();
    expect(mock.store.leads).toHaveLength(0);
  });

  it("skips anonymous page_view (resolution gate persists nothing)", async () => {
    const { json } = await post(makeRequest(anonymousPageView()));
    expect(json.processed?.[0].visitorId).toBeNull();
    expect(json.processed?.[0].leadId).toBeNull();
    expect(json.processed?.[0].skipped).toBe("unresolved event");
    expect(mock.store.visitors).toHaveLength(0);
    expect(mock.store.leads).toHaveLength(0);
  });

  it("does NOT create a Lead when last name is missing, even with Valid (esp)", async () => {
    const ev = enrichedPageView({
      resolution: {
        FIRST_NAME: "Jane",
        // no LAST_NAME
        PERSONAL_EMAILS: "jane@gmail.com",
        PERSONAL_EMAIL_VALIDATION_STATUS: "Valid (esp)",
        MOBILE_PHONE: "+15551234567",
        COMPANY_DOMAIN: "acme.com",
      },
    });
    const { json } = await post(makeRequest(ev));
    expect(json.processed?.[0].leadId).toBeNull();
    expect(mock.store.leads).toHaveLength(0);
  });
});

describe("lead dedupe", () => {
  beforeEach(() => {
    mock.seedIntegration({ orgId: ORG_ID, cursivePixelId: PIXEL_ID });
  });

  it("updates the existing Lead on a second event with the same (orgId, email)", async () => {
    const r1 = await post(makeRequest(enrichedPageView()));
    const leadId1 = r1.json.processed?.[0].leadId;
    expect(leadId1).toBeTruthy();
    expect(mock.store.leads).toHaveLength(1);

    // Second enriched event for same person (different timestamp to dodge
    // fingerprint dedupe)
    const r2 = await post(
      makeRequest(
        enrichedPageView({ event_timestamp: "2026-04-17T13:00:00Z" })
      )
    );
    const leadId2 = r2.json.processed?.[0].leadId;
    expect(leadId2).toBe(leadId1);
    expect(mock.store.leads).toHaveLength(1);
  });
});

describe("email parsing", () => {
  beforeEach(() => {
    mock.seedIntegration({ orgId: ORG_ID, cursivePixelId: PIXEL_ID });
  });

  it("picks the first email from comma-separated PERSONAL_EMAILS", async () => {
    const { json } = await post(makeRequest(enrichedPageView()));
    expect(json.processed?.[0].leadId).toBeTruthy();
    expect(mock.store.leads[0].email).toBe("jane@gmail.com");
  });

  it("picks the first email from array-form PERSONAL_EMAILS", async () => {
    const ev = enrichedPageView({
      resolution: {
        FIRST_NAME: "Jane",
        LAST_NAME: "Doe",
        PERSONAL_EMAILS: ["jane@gmail.com", "jane.alt@gmail.com"],
        PERSONAL_EMAIL_VALIDATION_STATUS: "Valid (esp)",
        MOBILE_PHONE: "+15551234567",
        COMPANY_DOMAIN: "acme.com",
      },
    });
    const { json } = await post(makeRequest(ev));
    expect(json.processed?.[0].leadId).toBeTruthy();
    expect(mock.store.leads[0].email).toBe("jane@gmail.com");
  });

  it("falls back to BUSINESS_EMAIL when PERSONAL_EMAILS is absent", async () => {
    const ev = enrichedPageView({
      resolution: {
        FIRST_NAME: "Jane",
        LAST_NAME: "Doe",
        BUSINESS_EMAIL: "jane@acme.com",
        PERSONAL_EMAIL_VALIDATION_STATUS: "Valid (esp)",
        MOBILE_PHONE: "+15551234567",
        COMPANY_DOMAIN: "acme.com",
      },
    });
    const { json } = await post(makeRequest(ev));
    expect(json.processed?.[0].leadId).toBeTruthy();
    expect(mock.store.leads[0].email).toBe("jane@acme.com");
  });
});

describe("CursiveIntegration counters", () => {
  it("updates lastEventAt and increments totalEventsCount per processed event", async () => {
    mock.seedIntegration({ orgId: ORG_ID, cursivePixelId: PIXEL_ID });
    await post(makeRequest(enrichedPageView()));
    await post(
      makeRequest(
        enrichedPageView({ event_timestamp: "2026-04-17T14:00:00Z" })
      )
    );
    const integ = mock.store.cursiveIntegrations[0];
    expect(integ.totalEventsCount).toBe(2);
    expect(integ.lastEventAt).toBeInstanceOf(Date);
  });

  it("does not bump counters when the event is skipped for unknown pixel", async () => {
    // No seedIntegration → pixel unknown
    await post(makeRequest(enrichedPageView()));
    expect(mock.store.cursiveIntegrations).toHaveLength(0);
  });
});
