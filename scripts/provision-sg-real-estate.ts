/**
 * scripts/provision-sg-real-estate.ts
 *
 * Pre-launch provisioning + readiness check for the SG Real Estate
 * client tenant. SG goes live Friday — this script ensures their org
 * row, modules, branding, and integrations are in the same shape the
 * Telegraph Commons demo expects so /portal renders identically with
 * SG's REAL data.
 *
 * Behavior:
 *   1. Locate the SG org by slug / name. Aborts if not found (we do NOT
 *      auto-create — that's a manual decision so we don't wreck a paying
 *      customer's tenancy by typo).
 *   2. Set every module* flag to true EXCEPT moduleGoogleAds and
 *      moduleMetaAds (SG has no ad accounts connected).
 *   3. Detect any Telegraph / neutral-demo seed properties scoped to SG
 *      and WARN — never auto-delete. Adam confirms each one manually.
 *   4. Print identity (name, slug, domain, owner, brand, tier, trial).
 *   5. Print a pre-launch readiness report.
 *   6. Default to DRY RUN. Pass --apply to persist.
 *
 * Usage:
 *   set -a; source .env.local; set +a; \
 *     pnpm exec tsx scripts/provision-sg-real-estate.ts [--apply]
 *
 * Safe to re-run.
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });

import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;

// ---------------------------------------------------------------------------
// Prisma client
// ---------------------------------------------------------------------------

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set. Source .env.local first.");

const prisma = new PrismaClient({
  adapter: new PrismaNeonHttp(url, {} as HTTPQueryOptions<boolean, boolean>),
});

// ---------------------------------------------------------------------------
// Logger — tagged, predictable, easy to grep in CI logs
// ---------------------------------------------------------------------------

const log = {
  info: (msg: string) => console.log(`[provision-sg] ${msg}`),
  section: (title: string) =>
    console.log(`\n[provision-sg] === ${title} ===`),
  ok: (msg: string) => console.log(`[provision-sg]   ok  ${msg}`),
  warn: (msg: string) => console.log(`[provision-sg]   warn ${msg}`),
  todo: (msg: string) => console.log(`[provision-sg]   TODO ${msg}`),
  miss: (msg: string) => console.log(`[provision-sg]   --  ${msg}`),
  change: (msg: string) =>
    console.log(`[provision-sg]   ${DRY_RUN ? "WOULD" : "DID "} ${msg}`),
  fail: (msg: string) => console.error(`[provision-sg]   FAIL ${msg}`),
};

// ---------------------------------------------------------------------------
// Module map — single source of truth for what SG gets enabled.
// Mirrors prisma/schema.prisma:359-378 (Organization.module* booleans).
// moduleGoogleAds + moduleMetaAds intentionally OMITTED — SG has no
// ad accounts connected and we do not want to surface paid-ads UI that
// will read empty.
// ---------------------------------------------------------------------------

const TARGET_MODULES = {
  moduleWebsite: true,
  modulePixel: true,
  moduleChatbot: true,
  moduleSEO: true,
  moduleEmail: true,
  moduleOutboundEmail: true,
  moduleReferrals: true,
  moduleCreativeStudio: true,
  moduleLeadCapture: true,
  modulePopups: true,
  moduleVault: true,
  // Explicitly false — no ad accounts.
  moduleGoogleAds: false,
  moduleMetaAds: false,
} as const satisfies Partial<Prisma.OrganizationUpdateInput>;

// ---------------------------------------------------------------------------
// Demo-seed property name patterns to flag. Drawn from the showcase
// seeds (Telegraph + neutral-demo) so we can detect fake data scoped to
// SG by mistake.
// ---------------------------------------------------------------------------

const DEMO_NAME_PATTERNS: RegExp[] = [
  /^Telegraph Commons/i,
  /^The Rhodes/i,
  /^Westbrook Commons/i,
  /^Park & Pearl/i,
  /^Sage at Greenpoint/i,
];

const SG_LOOKUP_SLUGS = [
  "sg-real-estate",
  "sgrealestate",
  "sg",
  "sg-realty",
];
const SG_LOOKUP_NAMES = [
  "SG Real Estate",
  "SG Realty",
  "SG",
];

// ---------------------------------------------------------------------------
// Locator
// ---------------------------------------------------------------------------

async function findSgOrg() {
  // First pass: exact slug / name match.
  const exact = await prisma.organization.findFirst({
    where: {
      OR: [
        { slug: { in: SG_LOOKUP_SLUGS } },
        { name: { in: SG_LOOKUP_NAMES } },
      ],
    },
  });
  if (exact) return exact;

  // Second pass: fuzzy. "sg" prefixed slug or name starts with "SG ".
  const fuzzy = await prisma.organization.findFirst({
    where: {
      OR: [
        { slug: { startsWith: "sg-" } },
        { slug: { startsWith: "sg" } },
        { name: { startsWith: "SG " } },
        { name: { contains: "SG Real Estate" } },
      ],
    },
  });
  return fuzzy;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log.info(
    `starting (${DRY_RUN ? "DRY RUN — pass --apply to persist" : "APPLY MODE — writes enabled"})`,
  );

  // -----------------------------------------------------------------
  // 1) Locate SG
  // -----------------------------------------------------------------
  log.section("locate SG org");
  const org = await findSgOrg();
  if (!org) {
    log.fail(
      `Could not find SG org. Searched slugs=[${SG_LOOKUP_SLUGS.join(", ")}] and names=[${SG_LOOKUP_NAMES.join(", ")}].`,
    );
    log.fail(
      "Refusing to auto-create. Confirm the org exists in production, then re-run.",
    );
    await prisma.$disconnect();
    process.exit(1);
  }
  log.ok(`found org "${org.name}" (slug=${org.slug}, id=${org.id})`);
  if (
    org.name.toLowerCase().includes("sg") &&
    !SG_LOOKUP_SLUGS.includes(org.slug)
  ) {
    log.warn(
      `slug mismatch: org name is "${org.name}" but slug is "${org.slug}". ` +
        `This causes subdomain routing to land on a confusing host. ` +
        `Consider renaming slug to "sg-real-estate" before launch.`,
    );
  }

  // -----------------------------------------------------------------
  // 2) Identity snapshot + TODOs
  // -----------------------------------------------------------------
  log.section("identity check");

  const printField = (label: string, value: string | null | undefined) => {
    if (value && value.trim().length > 0) {
      log.ok(`${label}: ${value}`);
    } else {
      log.todo(`${label}: MISSING — fill in /portal/settings`);
    }
  };

  printField("name", org.name);
  printField("slug", org.slug);
  printField("orgType", org.orgType);
  printField("productLine", org.productLine);
  printField("primaryContactEmail", org.primaryContactEmail);
  printField("primaryContactName", org.primaryContactName);
  printField("primaryColor", org.primaryColor);
  printField("logoUrl", org.logoUrl);
  printField("subscriptionTier", org.subscriptionTier ?? null);
  printField("subscriptionStatus", org.subscriptionStatus ?? null);
  log.info(
    `  whiteLabel=${org.whiteLabel} bringYourOwnSite=${org.bringYourOwnSite} status=${org.status}`,
  );
  log.info(
    `  trialStartedAt=${org.trialStartedAt?.toISOString() ?? "(none)"} trialEndsAt=${org.trialEndsAt?.toISOString() ?? "(none)"}`,
  );

  // Primary domain
  const primaryDomain = await prisma.domainBinding.findFirst({
    where: { orgId: org.id, isPrimary: true },
  });
  if (primaryDomain) {
    log.ok(
      `primary domain: ${primaryDomain.hostname} (ssl=${primaryDomain.sslStatus ?? "unknown"}, dns=${primaryDomain.dnsConfigured})`,
    );
  } else {
    log.todo(
      "primary domain: NOT SET — add a DomainBinding with isPrimary=true",
    );
  }

  // -----------------------------------------------------------------
  // 3) Detect demo / seed data scoped to SG
  // -----------------------------------------------------------------
  log.section("demo data check");

  const allProperties = await prisma.property.findMany({
    where: { orgId: org.id },
    select: { id: true, name: true, lifecycle: true, launchStatus: true },
  });
  log.ok(`total properties on SG: ${allProperties.length}`);

  const demoMatches = allProperties.filter((p) =>
    DEMO_NAME_PATTERNS.some((rx) => rx.test(p.name)),
  );
  if (demoMatches.length === 0) {
    log.ok("no Telegraph / neutral-demo property names found scoped to SG");
  } else {
    log.warn(
      `found ${demoMatches.length} propert${demoMatches.length === 1 ? "y" : "ies"} matching demo patterns:`,
    );
    for (const p of demoMatches) {
      log.warn(`  - "${p.name}" (id=${p.id}, lifecycle=${p.lifecycle})`);
    }
    log.warn(
      "NOT auto-deleting. Confirm manually and delete via /portal/properties or a targeted SQL.",
    );
  }

  // -----------------------------------------------------------------
  // 4) Enable modules
  // -----------------------------------------------------------------
  log.section("module flags");

  const moduleChanges: Array<{ field: string; from: unknown; to: unknown }> =
    [];
  for (const [field, target] of Object.entries(TARGET_MODULES)) {
    const current = (org as unknown as Record<string, unknown>)[field];
    if (current !== target) {
      moduleChanges.push({ field, from: current, to: target });
    }
  }

  if (moduleChanges.length === 0) {
    log.ok("all module flags already match target — no changes");
  } else {
    for (const c of moduleChanges) {
      log.change(`set ${c.field}: ${c.from} → ${c.to}`);
    }
    if (APPLY) {
      await prisma.organization.update({
        where: { id: org.id },
        data: TARGET_MODULES,
      });
      log.ok(`persisted ${moduleChanges.length} module flag change(s)`);
    }
  }

  // -----------------------------------------------------------------
  // 5) Pre-launch readiness report
  // -----------------------------------------------------------------
  log.section("pre-launch checklist");

  // Properties by lifecycle
  const lifecycleCounts = await prisma.property.groupBy({
    by: ["lifecycle"],
    where: { orgId: org.id },
    _count: { _all: true },
  });
  const launchCounts = await prisma.property.groupBy({
    by: ["launchStatus"],
    where: { orgId: org.id },
    _count: { _all: true },
  });
  log.info(
    `  properties by lifecycle: ${lifecycleCounts
      .map((r) => `${r.lifecycle}=${r._count._all}`)
      .join(" ")}`,
  );
  log.info(
    `  properties by launchStatus: ${launchCounts
      .map((r) => `${r.launchStatus}=${r._count._all}`)
      .join(" ")}`,
  );

  // Leads
  const leadCount = await prisma.lead.count({ where: { orgId: org.id } });
  if (leadCount === 0) {
    log.miss("leads: 0 (expected on a fresh launch — verify capture forms wire up)");
  } else {
    log.ok(`leads: ${leadCount}`);
  }

  // SEO (GA4 + GSC)
  const seoIntegrations = await prisma.seoIntegration.findMany({
    where: { orgId: org.id },
    select: {
      provider: true,
      propertyIdentifier: true,
      status: true,
      lastSyncAt: true,
    },
  });
  const ga4 = seoIntegrations.find((s) => s.provider === "GA4");
  const gsc = seoIntegrations.find((s) => s.provider === "GSC");
  if (ga4) {
    log.ok(
      `GA4: id=${ga4.propertyIdentifier} status=${ga4.status} lastSyncAt=${ga4.lastSyncAt?.toISOString() ?? "(never)"}`,
    );
  } else {
    log.todo("GA4: NOT CONNECTED — /portal/settings/integrations → Connect GA4");
  }
  if (gsc) {
    log.ok(
      `GSC: id=${gsc.propertyIdentifier} status=${gsc.status} lastSyncAt=${gsc.lastSyncAt?.toISOString() ?? "(never)"}`,
    );
  } else {
    log.todo("GSC: NOT CONNECTED — /portal/settings/integrations → Connect GSC");
  }

  // AppFolio
  const appfolio = await prisma.appFolioIntegration.findUnique({
    where: { orgId: org.id },
    select: {
      instanceSubdomain: true,
      syncStatus: true,
      lastSyncAt: true,
      autoSyncEnabled: true,
    },
  });
  if (appfolio) {
    log.ok(
      `AppFolio: ${appfolio.instanceSubdomain} status=${appfolio.syncStatus ?? "(none)"} lastSyncAt=${appfolio.lastSyncAt?.toISOString() ?? "(never)"} autoSync=${appfolio.autoSyncEnabled}`,
    );
  } else {
    log.todo(
      "AppFolio: NOT CONFIGURED — if SG uses AppFolio, connect in /portal/settings/integrations",
    );
  }

  // Reputation sources — Google place id / Yelp / Reddit configured anywhere?
  const repProperties = await prisma.property.findMany({
    where: {
      orgId: org.id,
      OR: [
        { googlePlaceId: { not: null } },
        { yelpBusinessId: { not: null } },
        // redditSubreddits is Json — Prisma rejects { not: null } on
        // Json filters. We treat reddit as a "nice-to-have" tertiary
        // source and rely on the Google/Yelp checks to gate the TODO.
      ],
    },
    select: { name: true, googlePlaceId: true, yelpBusinessId: true },
  });
  if (repProperties.length === 0) {
    log.todo(
      "reputation: NO properties have googlePlaceId / yelpBusinessId / redditSubreddits set",
    );
  } else {
    log.ok(
      `reputation: ${repProperties.length} propert${repProperties.length === 1 ? "y" : "ies"} have at least one source configured`,
    );
  }
  const repScans = await prisma.reputationScan.count({
    where: { orgId: org.id },
  });
  log.info(`  reputation scans logged: ${repScans}`);

  // Chatbot config — lives on TenantSiteConfig.chatbotEnabled, plus
  // module flag.
  const siteConfig = await prisma.tenantSiteConfig.findUnique({
    where: { orgId: org.id },
    select: {
      chatbotEnabled: true,
      chatbotPersonaName: true,
      chatbotGreeting: true,
      ga4MeasurementId: true,
      enableChatbot: true,
      primaryCtaUrl: true,
      contactEmail: true,
      phoneNumber: true,
    },
  });
  if (!siteConfig) {
    log.todo(
      "TenantSiteConfig: ROW MISSING — visit /portal/settings/site to create it",
    );
  } else {
    if (siteConfig.chatbotEnabled && siteConfig.chatbotPersonaName) {
      log.ok(
        `chatbot config: enabled persona="${siteConfig.chatbotPersonaName}"`,
      );
    } else {
      log.todo(
        "chatbot config: persona/greeting incomplete — /portal/settings/chatbot",
      );
    }
    if (siteConfig.ga4MeasurementId) {
      log.ok(`tenant ga4 measurement id: ${siteConfig.ga4MeasurementId}`);
    } else {
      log.todo("ga4MeasurementId on TenantSiteConfig: not set");
    }
    if (siteConfig.primaryCtaUrl) {
      log.ok(`primary CTA / booking url: ${siteConfig.primaryCtaUrl}`);
    } else {
      log.todo(
        "primaryCtaUrl: NOT SET — point at SG's Cal.com or tour booking link",
      );
    }
  }

  // Popups
  const popupCount = await prisma.popupCampaign.count({
    where: { orgId: org.id },
  });
  const activePopups = await prisma.popupCampaign.count({
    where: { orgId: org.id, status: "ACTIVE" },
  });
  if (popupCount === 0) {
    log.todo("popups: 0 campaigns — create at least one in /portal/popups");
  } else {
    log.ok(`popups: ${popupCount} campaigns (${activePopups} ACTIVE)`);
  }

  // Cursive pixel installs
  const cursive = await prisma.cursiveIntegration.findMany({
    where: { orgId: org.id },
    select: {
      cursivePixelId: true,
      installedOnDomain: true,
      provisionedAt: true,
      lastEventAt: true,
    },
  });
  if (cursive.length === 0) {
    log.todo(
      "Cursive pixel: NO integrations — request via /portal/settings/integrations",
    );
  } else {
    log.ok(`Cursive pixel: ${cursive.length} integration row(s)`);
    for (const c of cursive) {
      log.info(
        `    pixel=${c.cursivePixelId ?? "(none)"} domain=${c.installedOnDomain ?? "(none)"} lastEventAt=${c.lastEventAt?.toISOString() ?? "(never)"}`,
      );
    }
  }

  // Admin user
  const adminUsers = await prisma.user.findMany({
    where: {
      orgId: org.id,
      role: { in: ["CLIENT_OWNER", "CLIENT_ADMIN", "AGENCY_OWNER", "AGENCY_ADMIN"] },
    },
    select: {
      email: true,
      role: true,
      clerkUserId: true,
      lastLoginAt: true,
    },
  });
  if (adminUsers.length === 0) {
    log.todo(
      "admins: NO admin-tier user scoped to SG — onboard one via scripts/onboard-client-user.ts",
    );
  } else {
    for (const u of adminUsers) {
      const hasClerk = u.clerkUserId && u.clerkUserId.length > 0;
      log.ok(
        `admin: ${u.email} role=${u.role} clerk=${hasClerk ? "linked" : "MISSING"} lastLoginAt=${u.lastLoginAt?.toISOString() ?? "(never)"}`,
      );
      if (!hasClerk) {
        log.todo(
          `  ${u.email}: clerkUserId is empty — user cannot log in until linked`,
        );
      }
    }
  }

  // -----------------------------------------------------------------
  // 6) Final action list
  // -----------------------------------------------------------------
  log.section("manual action list for Friday launch");

  const todos: string[] = [];
  if (!primaryDomain)
    todos.push("Add primary DomainBinding (SG's marketing domain).");
  if (!org.logoUrl) todos.push("Upload SG logo (/portal/settings/branding).");
  if (!org.primaryContactEmail)
    todos.push("Set primaryContactEmail on the org.");
  if (!ga4) todos.push("Connect GA4 in /portal/settings/integrations.");
  if (!gsc) todos.push("Connect GSC in /portal/settings/integrations.");
  if (!appfolio)
    todos.push(
      "If SG uses AppFolio, connect it (/portal/settings/integrations → AppFolio).",
    );
  if (cursive.length === 0)
    todos.push(
      "Provision the Cursive visitor pixel and install on SG's marketing site.",
    );
  if (!siteConfig || !siteConfig.chatbotEnabled)
    todos.push(
      "Configure chatbot persona + greeting in /portal/settings/chatbot, then install embed on the marketing site.",
    );
  if (!siteConfig?.primaryCtaUrl)
    todos.push("Set primary CTA URL (Cal.com or tour booking link).");
  if (popupCount === 0)
    todos.push(
      "Create at least one popup campaign and install the embed (/portal/popups).",
    );
  if (repProperties.length === 0)
    todos.push(
      "Set googlePlaceId (and ideally yelpBusinessId) on SG's flagship properties for reputation scans.",
    );
  if (adminUsers.length === 0)
    todos.push(
      "Onboard at least one CLIENT_ADMIN user with a linked Clerk id.",
    );
  if (demoMatches.length > 0)
    todos.push(
      `Review and delete ${demoMatches.length} demo-named propert${demoMatches.length === 1 ? "y" : "ies"} scoped to SG (see warnings above).`,
    );

  if (todos.length === 0) {
    log.ok("nothing outstanding — SG is launch-ready.");
  } else {
    for (let i = 0; i < todos.length; i++) {
      log.info(`  ${i + 1}. ${todos[i]}`);
    }
  }

  log.section("done");
  if (DRY_RUN) {
    log.info("DRY RUN — re-run with --apply to persist module flag changes.");
  } else {
    log.info("APPLY mode complete.");
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  log.fail(`fatal: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) console.error(err.stack);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
