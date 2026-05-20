/**
 * scripts/apply-telegraph-popup.ts
 *
 * Phase 1 design parity — Telegraph Commons swap script.
 *
 * Finds the Telegraph Commons org by slug, upserts a PopupCampaign seeded
 * from the `limited-availability` template, and prints the install snippet
 * Adam needs to paste on telegraphcommons.com to replace his custom popup.
 *
 * Default: DRY RUN — reports what would change without writing. Pass `--apply`
 * to persist. Pass `--activate` to additionally flip status to ACTIVE
 * (only do this once Adam has reviewed the result in the portal).
 *
 * Run:
 *   set -a; source .env.local; set +a; pnpm exec tsx scripts/apply-telegraph-popup.ts
 *   ./pnpm exec tsx scripts/apply-telegraph-popup.ts --apply
 *   ./pnpm exec tsx scripts/apply-telegraph-popup.ts --apply --activate
 */

import "dotenv/config";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: false });

import {
  PrismaClient,
  PopupPosition,
  PopupStatus,
  PopupTheme,
  PopupTrigger,
  Prisma,
} from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";
import { POPUP_TEMPLATES } from "../lib/popups/templates";

const ORG_SLUG = "telegraph-commons";
const TEMPLATE_ID = "limited-availability";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const ACTIVATE = args.has("--activate");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Source .env.local first.");
}

const adapter = new PrismaNeonHttp(
  process.env.DATABASE_URL,
  {} as HTTPQueryOptions<boolean, boolean>,
);
const prisma = new PrismaClient({ adapter });

function log(label: string, value: unknown) {
  // Single-line structured output so the script is greppable in CI logs.
  // (The repo's CLAUDE.md / hooks forbid stray console.log in production
  // code; scripts are exempt — they're tools, not shipping code.)
  // eslint-disable-next-line no-console
  console.log(`[telegraph-popup] ${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
}

async function main() {
  const template = POPUP_TEMPLATES.find((t) => t.id === TEMPLATE_ID);
  if (!template) throw new Error(`Template "${TEMPLATE_ID}" not found.`);
  log("mode", APPLY ? (ACTIVATE ? "APPLY+ACTIVATE" : "APPLY") : "DRY RUN");
  log("template", template.label);

  const org = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG },
    select: { id: true, name: true, slug: true, modulePopups: true },
  });
  if (!org) {
    throw new Error(
      `Organization with slug "${ORG_SLUG}" not found. Run prisma/seed first.`,
    );
  }
  log("org", `${org.name} (${org.id})`);

  if (!org.modulePopups) {
    log("warning", "modulePopups is OFF for this org — toggle it on in /admin/clients before going live");
  }

  // Use template label as the dedup key inside the org. Adam can rename
  // the popup later; this script is idempotent under the assumption that
  // no other campaign uses the exact name "Limited availability — Telegraph".
  const dedupName = `${template.label} — Telegraph`;
  const existing = await prisma.popupCampaign.findFirst({
    where: { orgId: org.id, name: dedupName },
    select: { id: true, name: true, status: true, template: true },
  });

  const defaults = template.defaults;
  // Build Prisma-shaped data inline. JSON columns get a `Prisma.JsonNull`
  // when we want the DB to store NULL — plain `null` won't compile against
  // Prisma's branded JSON input type.
  const data = {
    name: dedupName,
    headline: defaults.headline,
    body: defaults.body,
    ctaText: defaults.ctaText,
    ctaUrl: defaults.ctaUrl,
    offerCode: defaults.offerCode ?? null,
    secondaryText: defaults.secondaryText ?? null,
    trigger: defaults.trigger ?? PopupTrigger.TIME_ON_PAGE,
    triggerThreshold: defaults.triggerThreshold ?? 8,
    targetUrlPatterns: (defaults.targetUrlPatterns ?? []) as Prisma.InputJsonValue,
    frequency: defaults.frequency ?? "session",
    position: defaults.position ?? PopupPosition.CENTER,
    primaryColor: defaults.primaryColor,
    textColor: defaults.textColor,
    backgroundColor: defaults.backgroundColor,
    heroImageUrl: defaults.heroImageUrl ?? null,
    captureEmail: defaults.captureEmail,
    capturePhone: defaults.capturePhone,
    eyebrowText: defaults.eyebrowText ?? null,
    accentColor: defaults.accentColor ?? null,
    theme: defaults.theme ?? PopupTheme.DARK,
    template: TEMPLATE_ID,
    featuredLabel: defaults.featuredLabel ?? null,
    featuredValue: defaults.featuredValue ?? null,
    featuredUnit: defaults.featuredUnit ?? null,
    featuredCaption: defaults.featuredCaption ?? null,
    secondaryCtaText: defaults.secondaryCtaText ?? null,
    secondaryCtaUrl: defaults.secondaryCtaUrl ?? null,
    secondaryCtaIcon: defaults.secondaryCtaIcon ?? null,
    primaryCtaIcon: defaults.primaryCtaIcon ?? null,
    dismissText: defaults.dismissText ?? null,
    gradientColors: defaults.gradientColors
      ? (defaults.gradientColors as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    status: ACTIVATE ? PopupStatus.ACTIVE : PopupStatus.DRAFT,
  };

  if (existing) {
    log("action", `UPDATE existing campaign ${existing.id}`);
  } else {
    log("action", "CREATE new campaign");
  }

  if (!APPLY) {
    log("dry-run", "no writes performed. Re-run with --apply to persist.");
  } else {
    if (existing) {
      await prisma.popupCampaign.update({
        where: { id: existing.id },
        data,
      });
      log("wrote", `updated ${existing.id}`);
    } else {
      const created = await prisma.popupCampaign.create({
        data: { orgId: org.id, ...data },
        select: { id: true },
      });
      log("wrote", `created ${created.id}`);
    }
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://leasestack.co";
  const snippet = `<script async src="${siteUrl}/embed/popup.js" data-tenant="${org.slug}"></script>`;

  // Final instructions
  // eslint-disable-next-line no-console
  console.log(
    [
      "",
      "  ──────────────────────────────────────────────────────────────",
      "  TELEGRAPH POPUP — INSTALL SNIPPET",
      "  Paste this into the <head> of telegraphcommons.com to replace",
      "  the existing custom popup. Remove the old custom popup markup.",
      "  ──────────────────────────────────────────────────────────────",
      "",
      `  ${snippet}`,
      "",
      "  Next steps:",
      "    1. " + (APPLY ? "Open /portal/popups in the Telegraph org and review." : "Re-run with --apply to actually write the row."),
      "    2. Tweak headline / featured value / colors in the editor.",
      "    3. Click 'Publish live' (or re-run with --apply --activate).",
      "    4. Replace the existing custom popup on the Telegraph site",
      "       with the snippet above.",
      "",
    ].join("\n"),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[telegraph-popup] FATAL", err);
  process.exit(1);
});
