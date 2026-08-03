// Flip an org's module flags to a named preset.
//
// Context (2026-08-02 SG focus): the sellable unit is chatbot + lead inbox
// + source attribution + monthly proof report. Everything else stays hidden
// until it earns its place. Module flags drive the portal nav, so slimming
// the nav IS flipping these.
//
// Safety: bare invocation is ALWAYS a dry run — prints the current value,
// the target value, and the delta, and writes nothing. Persisting requires
// --write. The resolved DB host prints before any query runs.
//
//   pnpm exec tsx --env-file=.env.local scripts/set-org-modules.ts --org <slug> --preset <name>
//   ... --write
//
// Presets are declared here (not passed as free-form JSON) so a flag flip
// on a live client org is a reviewed code change, not a shell one-liner.

import { getPrisma } from "../lib/db";

type ModuleFlags = Record<string, boolean>;

// SG Real Estate: chatbot + leads + attribution + reports only.
//
// DELIBERATELY ABSENT from this preset:
//   moduleInsights — leaving it ON. It is a BILLED SKU ("Insights &
//     Reports", GROWTH tier) that bundles insights, briefings AND reports,
//     and the reports pages themselves call requireModule("moduleInsights").
//     Turning it off would 403 the monthly report — the one thing we most
//     want them to see. Hiding only the Insights nav row needs an
//     entitlement-independent nav preference; see the session notes.
//   moduleChatbot / moduleConversations / moduleAttribution /
//     moduleLeadCapture — the sellable unit, stay ON.
const PRESETS: Record<string, ModuleFlags> = {
  "sg-focus": {
    // Pixel is proof, not a product surface: hides the Visitors page from
    // nav. Ingest is unaffected (the webhook routes by pixel ID, no cron
    // gates on this flag, and integrations `onPlan` stays true via
    // moduleChatbot), so the report keeps citing identified visitors.
    modulePixel: false,
    // NOTE: also stops the aeo-scan cron for this org (it selects
    // `where: { moduleSEO: true }`), so SEO/AEO data stops refreshing.
    // Intended: we don't want to sell what we aren't presenting.
    moduleSEO: false,
    modulePopups: false,
    moduleReputation: false,
  },
};

async function main() {
  const args = process.argv;
  const write = args.includes("--write");
  const orgSlug = args[args.indexOf("--org") + 1];
  const presetName = args[args.indexOf("--preset") + 1];

  if (!args.includes("--org") || !args.includes("--preset")) {
    console.error(
      "usage: set-org-modules.ts --org <slug> --preset <name> [--write]",
    );
    process.exitCode = 1;
    return;
  }
  const preset = PRESETS[presetName];
  if (!preset) {
    console.error(
      `Unknown preset "${presetName}". Known: ${Object.keys(PRESETS).join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  let host = "(unparseable DATABASE_URL)";
  try {
    host = new URL(process.env.DATABASE_URL ?? "").host;
  } catch {
    // keep placeholder
  }
  console.log(`DB host: ${host}`);
  console.log(write ? "MODE: --write (persisting)" : "MODE: dry run (no writes)");

  const prisma = getPrisma();

  const keys = Object.keys(preset);
  const org = await prisma.organization.findFirst({
    where: { slug: orgSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      ...Object.fromEntries(keys.map((k) => [k, true])),
    } as never,
  });
  if (!org) {
    console.error(`No org with slug "${orgSlug}".`);
    process.exitCode = 1;
    return;
  }

  const current = org as unknown as Record<string, boolean | string>;
  console.log(`\nOrg: ${current.name} (${current.slug})  preset: ${presetName}`);

  const changes: ModuleFlags = {};
  for (const key of keys) {
    const from = current[key] as boolean;
    const to = preset[key];
    const mark = from === to ? "  (no change)" : "  <-- CHANGES";
    console.log(`  ${key}: ${from} -> ${to}${mark}`);
    if (from !== to) changes[key] = to;
  }

  if (Object.keys(changes).length === 0) {
    console.log("\nAlready matches the preset. Nothing to do.");
    return;
  }

  if (!write) {
    console.log(
      `\nWould change ${Object.keys(changes).length} flag(s). Re-run with --write to persist.`,
    );
    return;
  }

  await prisma.organization.update({
    where: { id: current.id as string },
    data: changes,
  });
  console.log(`\nAPPLIED: ${Object.keys(changes).join(", ")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    if ((globalThis as { prisma?: unknown }).prisma) {
      void getPrisma().$disconnect();
    }
  });
