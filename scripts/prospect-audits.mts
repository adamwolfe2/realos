// Pre-run a free /audit for every prospect in an outbound CSV and add an
// `audit_url` column, so the cold email can link the prospect to their own
// property's report ({AUDIT_URL} in EmailBison).
//
//   pnpm exec tsx scripts/prospect-audits.mts prospects.csv            # plan only, no spend
//   pnpm exec tsx scripts/prospect-audits.mts prospects.csv --run      # create + run audits
//   ... --env .env.production.local                                   # target prod
//
// The CSV needs a `website` or `domain` column. Reuses a READY audit for the
// same domain from the last 14 days (same rule as /api/audit/start), else
// creates a QUEUED row and fires /api/audit/run/[id] with CRON_SECRET, 3 at a
// time. Each new audit costs real DataForSEO + LLM spend. Writes
// <input>.with-audits.csv.
import * as dotenv from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const envIdx = args.indexOf("--env");
dotenv.config({ path: envIdx >= 0 ? args[envIdx + 1] : ".env.local", override: false });

const { PrismaClient, ProspectAuditStatus } = await import("@prisma/client");
const { PrismaNeon } = await import("@prisma/adapter-neon");
const { generateShareToken, normalizeDomain } = await import("../lib/audit/token");
const { COMPUTE_VERSION } = await import("../lib/signals/types");

const input = args.find((a) => a.endsWith(".csv"));
const RUN = args.includes("--run");
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://leasestack.co").replace(/\/$/, "");
const CRON_SECRET = process.env.CRON_SECRET;
if (!input) throw new Error("usage: tsx scripts/prospect-audits.mts <file.csv> [--run] [--env <file>]");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
if (RUN && !CRON_SECRET) throw new Error("CRON_SECRET missing; needed to trigger audit runs");

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

// Minimal RFC 4180 parser: quoted fields, "" escapes, commas/newlines in quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim()));
}

const csvField = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

async function findReusable(domain: string) {
  return prisma.prospectAudit.findFirst({
    where: {
      domain,
      status: ProspectAuditStatus.READY,
      createdAt: { gt: new Date(Date.now() - 14 * 864e5) },
      snapshots: { some: { computeVersion: COMPUTE_VERSION } },
    },
    orderBy: { createdAt: "desc" },
    select: { shareToken: true },
  });
}

async function createAndRun(domain: string): Promise<{ token: string; status: string }> {
  const audit = await prisma.prospectAudit.create({
    data: {
      shareToken: generateShareToken(),
      urlInput: domain,
      domain,
      status: ProspectAuditStatus.QUEUED,
      expiresAt: new Date(Date.now() + 90 * 864e5),
      userAgent: "scripts/prospect-audits",
    },
    select: { id: true, shareToken: true },
  });
  // The run route does the whole scan inside its own request (maxDuration 60).
  const res = await fetch(`${APP_URL}/api/audit/run/${audit.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-trigger": CRON_SECRET! },
    signal: AbortSignal.timeout(90_000),
  });
  const row = await prisma.prospectAudit.findUnique({
    where: { id: audit.id },
    select: { status: true },
  });
  return { token: audit.shareToken, status: res.ok ? (row?.status ?? "UNKNOWN") : `HTTP ${res.status}` };
}

const rows = parseCsv(readFileSync(input, "utf8"));
const header = rows[0].map((h) => h.trim().toLowerCase());
const col = header.findIndex((h) => h === "website" || h === "domain" || h === "company_website");
if (col < 0) throw new Error(`no website/domain column in ${input}; header: ${rows[0].join(", ")}`);

const byDomain = new Map<string, string>(); // domain -> audit url ("" = not created)
for (const r of rows.slice(1)) {
  const d = normalizeDomain(r[col] ?? "");
  if (d) byDomain.set(d, "");
}

let reused = 0, created = 0, failed = 0;
const pending: string[] = [];
for (const domain of byDomain.keys()) {
  const hit = await findReusable(domain);
  if (hit) { byDomain.set(domain, `${APP_URL}/audit/${hit.shareToken}`); reused++; }
  else pending.push(domain);
}
console.log(`${byDomain.size} domains: ${reused} reuse an existing audit, ${pending.length} need a new scan.`);

if (RUN) {
  // ponytail: fixed concurrency of 3, raise if the run route has headroom.
  for (let i = 0; i < pending.length; i += 3) {
    await Promise.all(
      pending.slice(i, i + 3).map(async (domain) => {
        try {
          const r = await createAndRun(domain);
          if (r.status === "READY") { byDomain.set(domain, `${APP_URL}/audit/${r.token}`); created++; }
          else { failed++; console.warn(`${domain}: ${r.status}`); }
        } catch (err) {
          failed++;
          console.error(`${domain}: audit failed`, err);
        }
      }),
    );
    console.log(`  ${Math.min(i + 3, pending.length)}/${pending.length}`);
  }
} else if (pending.length) {
  console.log("Plan only. Re-run with --run to create the new audits (real API spend).");
}

const out = [
  [...rows[0], "audit_url"],
  ...rows.slice(1).map((r) => [...r, byDomain.get(normalizeDomain(r[col] ?? "") ?? "") ?? ""]),
];
const outPath = input.replace(/\.csv$/, ".with-audits.csv");
writeFileSync(outPath, out.map((r) => r.map(csvField).join(",")).join("\n") + "\n");
console.log(`Wrote ${outPath} (${created} new, ${reused} reused, ${failed} failed).`);
await prisma.$disconnect();
