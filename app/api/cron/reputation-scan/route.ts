import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { orchestrateScan } from "@/lib/reputation/orchestrate";
import type { PropertySeed } from "@/lib/reputation/types";
import { recordCronRun } from "@/lib/health/cron-run";
import { trackCronDuration } from "@/lib/observability/cron-tracker";
import { verifyCronAuth } from "@/lib/cron/auth";
import { SubscriptionStatus } from "@prisma/client";

export const maxDuration = 300; // 5 min — Vercel Pro cap

// GET /api/cron/reputation-scan
//
// Weekly refresh of reputation data for every active/trialing tenant that
// has at least one property with `googlePlaceId` set. Without this cron,
// reputation only refreshes when an operator clicks "Scan now" (see
// docs/SG_LAUNCH_CHECKLIST.md §3b + docs/SG_HARDENING_PASS_2026-05-19.md §4).
// Tenants therefore ended up with frozen reputation forever.
//
// Schedule: 9 AM Monday UTC (weekly). Reuses the existing orchestrator
// (`lib/reputation/orchestrate.ts -> orchestrateScan`) per property so the
// dedupe, sentiment, and persistence paths stay identical to the on-demand
// scan triggered from /api/portal/reputation/scan.
//
// Failure isolation: a thrown error in one org's scan does NOT abort the
// loop — it's caught + logged + counted, the next org continues.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("reputation-scan", () =>
    trackCronDuration("reputation-scan", async () => {
      // Find orgs that:
      //   1. Have an active or trialing subscription
      //   2. Own at least one Property with googlePlaceId set
      // googlePlaceId is the cheapest signal that the operator has
      // actually configured reputation sources for the property — without
      // it, the orchestrator burns Tavily quota with no useful output.
      const orgs = await prisma.organization.findMany({
        where: {
          subscriptionStatus: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
          },
          properties: {
            some: { googlePlaceId: { not: null } },
          },
        },
        select: { id: true },
      });

      // Stable sentinel for cron-triggered scans so the audit trail
      // distinguishes them from user-triggered scans. `triggeredByUserId`
      // is a free-text String? (no FK), so this label is safe.
      const SYSTEM_USER_ID = "system-cron";

      let propertiesScanned = 0;
      let propertiesFailed = 0;
      const errors: Array<{ orgId: string; propertyId?: string; error: string }> = [];

      for (const org of orgs) {
        try {
          const properties = await prisma.property.findMany({
            where: {
              orgId: org.id,
              googlePlaceId: { not: null },
              lifecycle: "ACTIVE",
            },
            select: {
              id: true,
              orgId: true,
              name: true,
              addressLine1: true,
              city: true,
              state: true,
              postalCode: true,
              propertyType: true,
              residentialSubtype: true,
              googlePlaceId: true,
              googleReviewUrl: true,
              yelpBusinessId: true,
              redditSubreddits: true,
            },
          });

          for (const p of properties) {
            const seed: PropertySeed = {
              id: p.id,
              orgId: p.orgId,
              name: p.name,
              addressLine1: p.addressLine1,
              city: p.city,
              state: p.state,
              postalCode: p.postalCode,
              propertyType: p.propertyType,
              residentialSubtype: p.residentialSubtype,
              googlePlaceId: p.googlePlaceId,
              googleReviewUrl: p.googleReviewUrl,
              yelpBusinessId: p.yelpBusinessId,
              redditSubreddits: Array.isArray(p.redditSubreddits)
                ? (p.redditSubreddits as string[])
                : null,
            };
            try {
              // Drive the async generator to completion — we don't need
              // the SSE events here, just the side-effects (persisted
              // mentions + ReputationScan row).
              for await (const _evt of orchestrateScan({
                property: seed,
                triggeredByUserId: SYSTEM_USER_ID,
              })) {
                // intentional no-op
                void _evt;
              }
              propertiesScanned += 1;
            } catch (err) {
              propertiesFailed += 1;
              const message = err instanceof Error ? err.message : String(err);
              errors.push({ orgId: org.id, propertyId: p.id, error: message });
              // continue to next property
            }
          }
        } catch (err) {
          // Org-level failure (e.g. property query died). Log + continue.
          propertiesFailed += 1;
          const message = err instanceof Error ? err.message : String(err);
          errors.push({ orgId: org.id, error: message });
        }
      }

      return {
        result: NextResponse.json({
          ok: true,
          orgsConsidered: orgs.length,
          propertiesScanned,
          propertiesFailed,
          // Cap the error list so a catastrophic outage doesn't return a
          // 5 MB JSON body. The Sentry breadcrumb already has the count.
          errors: errors.slice(0, 25),
        }),
        recordsProcessed: propertiesScanned,
      };
    }),
  );
}
