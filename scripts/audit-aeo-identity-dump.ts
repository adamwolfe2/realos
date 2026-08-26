// Step 0 of .claude/specs/2026-08-26-aeo-report-generator-handoff.md.
// Read-only: dumps what identity the last N prospect audits actually
// asserted, plus the 5 prompt strings those values produced. Ranks the
// five root causes by observed frequency instead of by my read of the code.
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { buildProspectPrompts } from "../lib/signals/compute";
import { brandNameFromDomain } from "../lib/audit/reputation-prospect";

const prisma = new PrismaClient({
  adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any),
});
const ARG = process.argv[2] || "15";
const AGGREGATE = ARG === "all";
const LIMIT = AGGREGATE ? undefined : Number(ARG);

/** Rows split by how identity arrived, because the two paths fail
 * differently: the forms supply a name, the /audit quiz never does. */
function pathOf(r: { quizAnswers: unknown; brandName: string | null }) {
  if (r.quizAnswers) return "quiz";
  return r.brandName?.trim() ? "form" : "url-only";
}

const DISCOVERY_SHIPPED = new Date("2026-08-13T00:00:00Z");

type Tally = Record<string, number>;
const newTally = (): Tally => ({
  n: 0, derivedName: 0, noCity: 0, thinLocale: 0,
  apartments: 0, categoryMismatch: 0, urlDrift: 0, noDiscovery: 0, failed: 0,
});
const groups = new Map<string, Tally>();
const bump = (key: string, field: string) => {
  const t = groups.get(key) ?? newTally();
  t[field]++;
  groups.set(key, t);
};

(async () => {
  const rows = await prisma.prospectAudit.findMany({
    where: AGGREGATE ? {} : { status: "READY" },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
    select: {
      id: true, createdAt: true, urlInput: true, domain: true, status: true,
      brandName: true, quizAnswers: true, findings: true,
    },
  });

  for (const r of rows) {
    const f = (r.findings ?? {}) as any;
    const locale = f.aeoLocale ?? null;
    const guess = brandNameFromDomain(r.domain);
    const supplied = r.brandName?.trim();
    const brand = supplied || guess;
    // Either nothing was supplied, or what was stored IS the domain guess —
    // the run route persists the resolved name back onto the row.
    const derived = !supplied || supplied === guess;
    const quizType = (r.quizAnswers as any)?.property_type ?? null;
    const category = locale?.category ?? null;
    const prompts = buildProspectPrompts(brand, r.domain, locale);
    const era = r.createdAt >= DISCOVERY_SHIPPED ? "post-08-13" : "pre-08-13";
    const key = `${pathOf(r).padEnd(8)} ${era}`;

    bump(key, "n");
    if (r.status !== "READY") bump(key, "failed");
    if (derived) bump(key, "derivedName");
    if (!locale?.city) bump(key, "noCity");
    if (locale?.city && !locale?.neighborhood && !locale?.amenity) bump(key, "thinLocale");
    if ((category ?? "apartments") === "apartments") bump(key, "apartments");
    // Quiz said the asset is not conventional multifamily, prompts said it was.
    if (quizType && !["multifamily", "affordable"].includes(quizType) &&
        (category ?? "apartments") === "apartments") bump(key, "categoryMismatch");
    if (!r.urlInput.includes(r.domain)) bump(key, "urlDrift");
    if (f.aeoDiscoveryRan !== true) bump(key, "noDiscovery");

    if (AGGREGATE) continue;
    console.log("\n" + "=".repeat(78));
    console.log(`${r.createdAt.toISOString().slice(0, 16)}  ${r.domain}  [${r.status}]`);
    console.log(`  urlInput     ${r.urlInput}`);
    console.log(`  brandName    ${r.brandName ?? "(null)"}  ->  "${brand}"${derived ? "  [= DOMAIN GUESS]" : ""}`);
    console.log(`  quiz type    ${quizType ?? "(none)"}`);
    console.log(`  locale       ${locale ? JSON.stringify(locale) : "(null)"}`);
    console.log(`  discoveryRan ${f.aeoDiscoveryRan === true}`);
    prompts.forEach((p, i) => console.log(`   ${i + 1}. [${p.kind}] ${p.text}`));
  }

  console.log("\n" + "=".repeat(78));
  console.log(`${rows.length} rows, grouped by entry path x era\n`);
  const fields = Object.keys(newTally()).filter((k) => k !== "n");
  console.log("group".padEnd(20) + "n".padStart(4) + fields.map((f) => f.slice(0, 9).padStart(11)).join(""));
  for (const [key, t] of [...groups.entries()].sort()) {
    const pct = (v: number) => `${v} (${Math.round((v / t.n) * 100)}%)`.padStart(11);
    console.log(key.padEnd(20) + String(t.n).padStart(4) + fields.map((f) => pct(t[f])).join(""));
  }
  await prisma.$disconnect();
})();
