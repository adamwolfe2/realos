import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getScope } from "@/lib/tenancy/scope";
import { getSiteUrl } from "@/lib/brand";
import { intakeFormSchema } from "@/lib/site-engine/intake-schema";
import { generateUniqueSiteRequestSlug } from "@/lib/site-engine/slug";
import { issueStatusToken, buildStatusUrl } from "@/lib/site-engine/status-token";
import {
  sendSiteRequestConfirmation,
  sendSiteRequestOpsAlert,
} from "@/lib/email/site-engine-emails";
import { notifySiteRequestSubmitted } from "@/lib/notifications/slack";
import {
  SiteRequestTier,
  type Prisma,
  type SiteRequestAssetType,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// POST /api/site-requests
//
// Creates a SiteRequest + IntakeResponse + asset records from a single
// payload. Same endpoint handles both the public form and the logged-in
// portal form — when a Clerk session is present we link the row to the
// caller's org; otherwise we leave orgId null (the public submitter can
// claim the row later via magic link / signed status URL).
//
// Side effects (best-effort — failures don't roll back the submission):
//   - Confirmation email to submitter
//   - Ops alert email to Adam / agency inbox
//   - Slack DM to the configured channel
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = intakeFormSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Optional session — public form doesn't require one.
  const scope = await getScope().catch(() => null);
  const linkedOrgId = scope && !scope.isAgency ? scope.orgId : null;

  // Capture request metadata for attribution / forensics.
  const h = await headers();
  const ipAddress =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  const userAgent = h.get("user-agent") ?? null;
  const referrer = data.referrer ?? h.get("referer") ?? null;

  const slug = await generateUniqueSiteRequestSlug();

  // Build the IntakeResponse data atomically with the SiteRequest.
  const vd = data.visualDirection ?? {};
  const intakeData: Prisma.IntakeResponseCreateWithoutSiteRequestInput = {
    identityType: data.identityType,
    brandName: data.brandName,
    tagline: data.tagline,
    brandColorHex: data.brandColorHex,
    vertical: data.vertical,
    licenseNumber: data.licenseNumber,
    brokerageName: data.brokerageName,
    licenseState: data.licenseState,
    serviceAreas: data.serviceAreas,
    hqCity: data.hqCity,
    hqState: data.hqState,
    currentSiteUrl: data.currentSiteUrl,
    domain: data.domain,
    domainNeeded: data.domainNeeded,
    dnsAccess: data.dnsAccess,
    inspirationUrls: data.inspirationUrls,
    presetChoice: data.presetChoice,
    // Multi-modal visual direction picker (new in May 2026).
    chosenPresetSlug: vd.chosenPresetSlug ?? data.presetChoice ?? undefined,
    chosenDesignLanguageSlug: vd.chosenDesignLanguageSlug,
    chosenPaletteSlug: vd.chosenPaletteSlug,
    negativeInputs: vd.negativeInputs,
    voiceSample: data.voiceSample,
    bio: data.bio,
    services: data.services as Prisma.InputJsonValue,
    testimonials: data.testimonials as Prisma.InputJsonValue,
    keyStats: data.keyStats as Prisma.InputJsonValue,
    calendlyUrl: data.calendlyUrl,
    crmChoice: data.crmChoice,
    mlsPreference: data.mlsPreference,
    ga4Id: data.ga4Id,
    timelineExpectation: data.timelineExpectation,
    budgetConfirmed: data.budgetConfirmed,
    budgetTier: data.budgetTier,
    anythingElse: data.anythingElse,
    raw: data as unknown as Prisma.InputJsonValue,
  };

  const created = await prisma.siteRequest.create({
    data: {
      slug,
      orgId: linkedOrgId,
      submittedByName: data.submittedByName,
      submittedByEmail: data.submittedByEmail.toLowerCase(),
      submittedByPhone: data.submittedByPhone,
      submittedByCompany: data.submittedByCompany,
      tier: data.tier as SiteRequestTier,
      source: data.source,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      referrer,
      ipAddress,
      userAgent,
      intake: { create: intakeData },
      assets: data.assets.length
        ? {
            create: data.assets.map((a) => ({
              type: a.type as SiteRequestAssetType,
              filename: a.filename,
              mimeType: a.mimeType,
              size: a.size,
              blobUrl: a.blobUrl,
              pathname: a.pathname,
              label: a.label,
            })),
          }
        : undefined,
      events: {
        create: {
          kind: "status_change",
          toStatus: "SUBMITTED",
          message: linkedOrgId
            ? "Submitted via portal (logged-in customer)"
            : `Submitted via public form${data.source ? ` (source: ${data.source})` : ""}`,
        },
      },
    },
    select: { id: true, slug: true },
  });

  // Issue a status link for the submitter. Logged-in submitters get a
  // plain unsigned link (their Clerk session does the auth); public
  // submitters get an HMAC-signed token that gates the status page.
  const appUrl = getSiteUrl();
  let statusUrl: string;
  if (linkedOrgId) {
    statusUrl = `${appUrl.replace(/\/+$/, "")}/portal/sites/${encodeURIComponent(created.slug)}`;
  } else {
    const { token } = issueStatusToken(created.slug);
    statusUrl = buildStatusUrl(appUrl, created.slug, token);
  }

  // Fire side-effects in parallel; failures are non-fatal — we always
  // want the SiteRequest to land even if email/slack are misconfigured.
  await Promise.allSettled([
    sendSiteRequestConfirmation({
      to: data.submittedByEmail,
      submitterName: data.submittedByName,
      brandName: data.brandName,
      slug: created.slug,
      statusUrl,
      magicLinkUrl: linkedOrgId ? null : statusUrl,
    }),
    sendSiteRequestOpsAlert({
      brandName: data.brandName,
      submitterName: data.submittedByName,
      submitterEmail: data.submittedByEmail,
      tier: data.tier,
      source: data.source ?? null,
      siteRequestId: created.id,
      inspirationUrls: data.inspirationUrls,
    }),
    notifySiteRequestSubmitted({
      brandName: data.brandName,
      submitterName: data.submittedByName,
      submitterEmail: data.submittedByEmail,
      tier: data.tier,
      source: data.source ?? null,
      identityType: data.identityType ?? null,
      timeline: data.timelineExpectation ?? null,
      adminUrl: `${appUrl.replace(/\/+$/, "")}/admin/site-engine/${created.id}`,
    }),
  ]);

  return NextResponse.json({
    ok: true,
    slug: created.slug,
    id: created.id,
    statusUrl,
  });
}
