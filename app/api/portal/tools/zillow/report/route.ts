import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import {
  checkRateLimit,
  rateLimited,
  zillowReportLimiter,
} from "@/lib/rate-limit";
import { parseZillowUrl } from "@/lib/zillow/url";
import { scrapeZillowListing, type ScrapeError } from "@/lib/zillow/scrape";
import { computeCalculations } from "@/lib/zillow/calculations";

export const dynamic = "force-dynamic";
// Node runtime — cheerio + Buffer + dns lookups are not edge-safe.
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/portal/tools/zillow/report
// Body: { url: string, save?: boolean }
// Returns: { listing, calculations, saved?: { id } }
//
// Auth-gated via requireScope (any org type). Rate-limited 3/min/org.
// Validates the URL must be HTTPS, host must end in zillow.com, and the
// path must contain a numeric zpid. Scrapes server-side with SSRF guard.
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .max(2048, "URL is too long")
    .url("Must be a valid URL"),
  save: z.boolean().optional().default(false),
});

const ERROR_MESSAGES: Record<ScrapeError, string> = {
  INVALID_URL: "That doesn't look like a Zillow listing URL.",
  SSRF_BLOCKED: "URL failed safety checks.",
  FETCH_TIMEOUT: "Zillow took too long to respond. Try again in a moment.",
  FETCH_FAILED: "Couldn't fetch the listing from Zillow.",
  BLOCKED:
    "Zillow blocked the request. Wait a minute and try again, or paste a different listing.",
  EMPTY:
    "We fetched the page but couldn't find any listing data. The page may have changed or the link may be a search result instead of a property detail page.",
  TOO_LARGE: "Listing page was unexpectedly large.",
};

export async function POST(req: NextRequest) {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  // Parse body.
  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await req.json();
    body = bodySchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Invalid request body" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Defense-in-depth: re-validate the URL shape *before* we touch the
  // network. The Zod .url() check only validates URL parseability — this
  // enforces our actual Zillow rules.
  const parts = parseZillowUrl(body.url);
  if (!parts) {
    return NextResponse.json(
      {
        error:
          "URL must be an https Zillow detail page with a numeric zpid (e.g. /homedetails/.../12345_zpid/).",
      },
      { status: 400 },
    );
  }

  // Per-org rate limit. 10/min keeps a curious operator (or a browser
  // tab they left auto-clicking) from punching us through Zillow's bot
  // wall, while still letting a sales demo click through several
  // listings in a row. Runs AFTER URL validation so typos/invalid URLs
  // don't burn tokens — only real outbound scrapes count.
  const rl = await checkRateLimit(
    zillowReportLimiter,
    `zillow-report:${scope.orgId}`,
  );
  if (!rl.allowed) {
    return rateLimited(
      "Too many Zillow reports in the last minute. Try again shortly.",
      Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)),
    );
  }

  const result = await scrapeZillowListing(parts.url);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: ERROR_MESSAGES[result.error],
        code: result.error,
        ...(result.status ? { status: result.status } : {}),
      },
      { status: result.error === "BLOCKED" ? 502 : 422 },
    );
  }

  const listing = result.listing;
  const calculations = computeCalculations({
    listPrice: listing.listPrice ?? 0,
    rentZestimate: listing.rentZestimate,
  });

  let saved: { id: string } | undefined;
  if (body.save) {
    const row = await prisma.zillowReport.create({
      data: {
        orgId: scope.orgId,
        userId: scope.userId,
        zillowUrl: parts.url,
        zpid: parts.zpid,
        // Cast through `as never` matches the pattern used by clientReport
        // snapshot writes — Prisma's Json column accepts arbitrary
        // serializable data but the generated type wants InputJsonValue.
        payload: listing as object as never,
        calculations: calculations as object as never,
      },
      select: { id: true },
    });
    saved = row;
  }

  return NextResponse.json({ listing, calculations, saved });
}
