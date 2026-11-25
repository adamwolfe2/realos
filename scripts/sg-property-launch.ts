// Idempotent: bring one SG Real Estate building live in the SG org (slug telegraph-commons) with its own chatbot,
// knowledge base, pop-up and DomainBindings. Same shape as sg-200e-southgate-launch.ts, but one command per property.
//
// Writes (raw SQL against the real prod columns; this checkout's Prisma schema can lag prod):
//   Property            -> ACTIVE (OPERATOR) + name/slug/address/websiteUrl, excludeReason cleared
//   PropertyChatbotConfig -> upsert on propertyId (persona, greeting, colour, KB = facts file + live AppFolio listings)
//   DomainBinding       -> one row per host (exact hostnames; never moves a host bound to another org)
//   PopupCampaign       -> one branded pop-up, matched by name "Launch — <name>"
//   AppFolioIntegration -> backfillRequestedAt armed (requestAppfolioBackfill) so the next sync pulls history
// Never deletes, never calls Stripe (quantity sync only runs on createProperty), sets no lead-notify overrides
// (SG's org-level notify settings apply, same as 200E / Southgate).
//
// Per-property copy and facts live in scripts/sg-kb/<slug>.md (frontmatter + facts body, facts only).
//
// Run (dry run prints the diff; nothing is written):
//   npx tsx scripts/sg-property-launch.ts --slug the-shattuck --name "The Shattuck" --appfolio-id 1645 \
//     --hosts theshattuck.com,www.theshattuck.com,the-shattuck.vercel.app --assistant Ivy --color "#7f5a53"
// Optional: --ga-property <GA4 id> --ga-id G-XXXX --gsc sc-domain:<host> (per-property SeoIntegration rows + chatbot GA4 tag).
// Add --apply to write, --show-kb to print the full knowledge base. Re-run any time to refresh the KB's listings block.
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.production.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
// App code path (lazy prisma, reads DATABASE_URL at call time, after dotenv above).
import { requestAppfolioBackfill } from "@/lib/integrations/appfolio-backfill";
import { approvedBlocks } from "@/lib/self-improve/proposal";

const SG_ORG = "cmo402dwz0002c93lf3okkgi0";
const AF = "https://sgrealestate.appfolio.com";

const { values: args } = parseArgs({
  options: {
    slug: { type: "string" },
    name: { type: "string" },
    "appfolio-id": { type: "string" },
    hosts: { type: "string" },
    assistant: { type: "string" },
    color: { type: "string" },
    kb: { type: "string" },
    delay: { type: "string", default: "30" },
    apply: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    "show-kb": { type: "boolean", default: false },
    "ga-property": { type: "string" },
    "ga-id": { type: "string" },
    gsc: { type: "string" },
  },
});
const need = (k: keyof typeof args): string => {
  const v = args[k];
  if (typeof v !== "string" || !v.trim()) throw new Error(`--${k} is required`);
  return v.trim();
};
const SLUG = need("slug");
const NAME = need("name");
const APPFOLIO_ID = need("appfolio-id");
const HOSTS = need("hosts").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
const ASSISTANT = need("assistant");
const COLOR = need("color");
const APPLY = args.apply === true && args["dry-run"] !== true;
const DELAY = Number(args.delay);
if (!/^[a-z0-9-]+$/.test(SLUG)) throw new Error(`bad slug ${SLUG}`);
if (!/^#[0-9a-fA-F]{6}$/.test(COLOR)) throw new Error(`--color must be #rrggbb, got ${COLOR}`);
const GA_PROPERTY = args["ga-property"]?.trim();
const GA_ID = args["ga-id"]?.trim();
const GSC = args.gsc?.trim();
if (GA_PROPERTY && !/^\d+$/.test(GA_PROPERTY)) throw new Error(`--ga-property must be the numeric GA4 property id`);
if (GA_ID && !/^G-[A-Z0-9]+$/.test(GA_ID)) throw new Error(`--ga-id must look like G-XXXX`);
if (GSC && !/^(sc-domain:[a-z0-9.-]+|https:\/\/[^ ]+\/)$/.test(GSC)) throw new Error(`--gsc must be sc-domain:<host> or a URL-prefix property`);
if (!Number.isInteger(DELAY) || DELAY < 0) throw new Error(`bad --delay ${args.delay}`);
for (const h of HOSTS) if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)) throw new Error(`bad host ${h} (exact hostnames only, no scheme or path)`);

// ---- per-property file: frontmatter (key: value) + facts body ----
const kbPath = args.kb ?? `scripts/sg-kb/${SLUG}.md`;
const raw = readFileSync(kbPath, "utf8");
const fm = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!fm) throw new Error(`${kbPath}: missing --- frontmatter ---`);
const meta: Record<string, string> = Object.fromEntries(
  fm[1].split("\n").filter((l) => l.includes(":")).map((l) => [l.slice(0, l.indexOf(":")).trim(), l.slice(l.indexOf(":") + 1).trim()]),
);
const FACTS = fm[2].trim();
const m = (k: string): string => {
  if (!meta[k]) throw new Error(`${kbPath}: frontmatter "${k}" is required`);
  return meta[k];
};
const SITE = (meta.site ?? `https://${HOSTS[0]}`).replace(/\/$/, "");
const abs = (p: string) => (/^https?:\/\//.test(p) ? p : `${SITE}${p.startsWith("/") ? "" : "/"}${p}`);
const STREET = m("street");
const CITY = m("city");
const ZIP = m("zip");
const PHONE = m("phone");
const EMAIL = m("email");
const MATCH = new RegExp(m("match"), "i");
const SOURCE = m("source");
const AVAIL = abs(meta.availability ?? "/availability");
const TOUR = meta.tour ? abs(meta.tour) : null;

const RULES = `
HOW TO ANSWER:
- Prices: quote from AVAILABLE UNITS RIGHT NOW (synced from AppFolio every hour). The CURRENT PUBLIC LISTINGS block below is a dated snapshot kept for its tour links; when the two disagree on a unit or price, AVAILABLE UNITS RIGHT NOW wins. Say prices change daily and link the availability page. For a specific listing, share its tour link. Never invent a price, date, unit or promotion.
- The street address is public: always give it plainly when asked.
- For anything not written here or in the listings, say the leasing team will confirm, then offer a tour or ask for their name and email so leasing can follow up.
- Fair housing: never comment on who a building suits by age, race, religion, sex, family status, disability or national origin. Roommate matching is something leasing handles.
- Keep answers short, warm and specific. One question back at most. Never open with 'Great question' or similar filler.
- When you don't have a fact, say so in one line and give the leasing phone and email. Only say the team will follow up if the visitor has already shared their email or phone in this chat; otherwise invite them to share it.`;

// ---- live AppFolio listings for this building (public page, same filters the SG sites use) ----
const clean = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const field = (html: string, cls: string) => clean(html.match(new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</(?:div|span|dd|h2|p)>`))?.[1] ?? "");

function availLabel(s: string): string {
  const d = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!d) return "now";
  const iso = `${d[3].length === 2 ? `20${d[3]}` : d[3]}-${d[1].padStart(2, "0")}-${d[2].padStart(2, "0")}`;
  const t = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(t.getTime()) || t.getTime() < Date.now()) return "now";
  return t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function parseListings(html: string, match: RegExp, source: string): string[] {
  const out: { rent: number; line: string }[] = [];
  for (const item of html.split('class="listing-item result js-listing-item"').slice(1)) {
    const address = field(item, "js-listing-address");
    if (!match.test(address)) continue;
    const uid = item.match(/\/listings\/detail\/([a-f0-9-]{36})/i)?.[1];
    const title = field(item, "js-listing-title");
    if (!uid || !title || /lease takeover|application use only|parking only/i.test(title)) continue;
    const rent = Number(field(item, "js-listing-blurb-rent").match(/\$\s?([\d,]+)/)?.[1]?.replace(/,/g, "") ?? 0);
    if (!rent) continue;
    const bb = field(item, "js-listing-blurb-bed-bath");
    const sqft = field(item, "js-listing-square-feet").match(/([\d,]+)/)?.[1];
    const avail = availLabel(field(item, "js-listing-available"));
    // "... - 1Bedroom 2027 - 2028, Berkeley" is a lease year, not unit 2028: two
    // listings tagged "(unit 2028)" made the Stranda bot swap the 1bd and 2bd prices.
    const unitMatch = address.match(/[-–,]\s*#?([A-Za-z]?\d{2,4}[A-Za-z]?)\s*,/)?.[1];
    const unit = unitMatch && !/^20\d\d$/.test(unitMatch) ? unitMatch : undefined;
    const showing = `${AF}/listings/showings/new?listable_uid=${uid}&source=${source}`;
    out.push({
      rent,
      line: `- ${title.slice(0, 90)}${unit ? ` (unit ${unit})` : ""}: ${bb || "bed/bath not listed"}${sqft ? `, ${sqft} sq ft` : ""}, $${rent.toLocaleString("en-US")}/month, available ${avail}. Tour: ${showing}`,
    });
  }
  return out.sort((a, b) => a.rent - b.rent).map((o) => o.line);
}

async function listingsBlock(): Promise<{ block: string; count: number }> {
  const res = await fetch(`${AF}/listings`, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`AppFolio listings returned HTTP ${res.status}`);
  const html = await res.text();
  if (!html.includes("js-listing-item")) throw new Error("AppFolio listings page has no listing items (markup changed or blocked)");
  const lines = parseListings(html, MATCH, SOURCE);
  const head = `CURRENT PUBLIC LISTINGS (AppFolio snapshot, refreshed ${new Date().toISOString().slice(0, 16)}Z; tour links).`;
  const body = lines.length ? lines.join("\n") : `- No public listings are posted for ${NAME} right now. Say so, link ${AVAIL}, and offer to have leasing send openings.`;
  return { block: `${head}\n${body}`, count: lines.length };
}

// ---- DB helpers ----
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {}) });
const q = <T = Record<string, unknown>>(sql: string, ...p: unknown[]) => prisma.$queryRawUnsafe<T[]>(sql, ...p);
const CASTS: Record<string, string> = {
  lifecycle: "PropertyLifecycle", lifecycleSetBy: "PropertyLifecycleSource", chatbotCaptureMode: "ChatbotCaptureMode",
  status: "PopupStatus", provider: "SeoProvider", trigger: "PopupTrigger", position: "PopupPosition", theme: "PopupTheme",
};
const ph = (c: string, n: number) => `$${n}${CASTS[c] ? `::"${CASTS[c]}"` : ""}`;
const newId = () => "c" + randomUUID().replace(/-/g, "").slice(0, 24);

async function insert(table: string, row: Record<string, unknown>) {
  const data = { id: newId(), ...row, createdAt: new Date(), updatedAt: new Date() };
  const cols = Object.keys(data);
  await q(`insert into "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) values (${cols.map((c, i) => ph(c, i + 1)).join(", ")})`, ...Object.values(data));
}
async function update(table: string, id: string, row: Record<string, unknown>) {
  const data = { ...row, updatedAt: new Date() };
  const cols = Object.keys(data);
  await q(`update "${table}" set ${cols.map((c, i) => `"${c}" = ${ph(c, i + 1)}`).join(", ")} where id = $${cols.length + 1}`, ...Object.values(data), id);
}
/** Fields in `want` that differ from `have` (null/undefined treated alike). */
function diff(have: Record<string, unknown> | undefined, want: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(want)) {
    const h = have?.[k];
    const same = h instanceof Date || v instanceof Date ? false : (h ?? null) === (v ?? null) || (typeof h === "number" && Number(v) === h);
    if (!same) out[k] = v;
  }
  return out;
}
const show = (label: string, have: Record<string, unknown> | undefined, changes: Record<string, unknown>) => {
  const keys = Object.keys(changes);
  console.log(`  ${label}: ${!have ? "CREATE" : keys.length ? "UPDATE" : "no change"}`);
  for (const k of keys) {
    const fmt = (v: unknown) => (typeof v === "string" && v.length > 70 ? `<${v.length} chars>` : JSON.stringify(v));
    console.log(`    ${k}: ${have ? fmt(have[k]) + " -> " : ""}${fmt(changes[k])}`);
  }
};

(async () => {
  console.log(`${APPLY ? "APPLY" : "DRY RUN"}  ${SLUG}`);
  const [prop] = await q<{ id: string; orgId: string; name: string; slug: string; lifecycle: string } & Record<string, unknown>>(
    `select * from "Property" where "orgId" = $1 and "backendPropertyId" = $2`, SG_ORG, APPFOLIO_ID,
  );
  if (!prop) throw new Error(`no SG property with AppFolio id ${APPFOLIO_ID}`);
  const [clash] = await q<{ id: string }>(`select id from "Property" where "orgId" = $1 and slug = $2 and id <> $3`, SG_ORG, SLUG, prop.id);
  if (clash) throw new Error(`slug ${SLUG} already used by ${clash.id}`);
  console.log(`  property ${prop.id}: "${prop.name}" (${prop.slug}, ${prop.lifecycle})`);

  const propWant = {
    name: NAME, slug: SLUG, addressLine1: STREET, city: CITY, state: "CA", postalCode: ZIP, websiteUrl: SITE,
    lifecycle: "ACTIVE", lifecycleSetBy: "OPERATOR", excludeReason: null,
  };
  const propChanges = diff(prop, propWant);
  if (propChanges.lifecycle) propChanges.lifecycleSetAt = new Date();
  show("Property", prop, propChanges);

  const { block, count } = await listingsBlock();
  console.log(`  listings: ${count} public AppFolio listings matched /${MATCH.source}/`);
  const kbBase = `You are ${ASSISTANT}, the leasing assistant for ${NAME}, at ${STREET}, ${CITY}, CA ${ZIP}. Managed by SG Real Estate.

${FACTS}

CONTACT: ${PHONE}, ${EMAIL}. Availability and prices: ${AVAIL}.${TOUR ? ` Tours: ${TOUR}.` : " Tours: every listing below has its own tour link."} Current residents: ${AF}/connect/users/sign_in
${RULES}

${block}`;

  const [bot] = await q(`select * from "PropertyChatbotConfig" where "propertyId" = $1`, prop.id);
  // Answers approved in the portal (Suggested fixes) survive a KB refresh.
  const kept = approvedBlocks(bot?.chatbotKnowledgeBase as string | null);
  const kb = [kbBase, ...kept].join("\n\n");
  if (kept.length) console.log(`  KB: keeping ${kept.length} approved answer block(s)`);
  if (args["show-kb"]) console.log(`----- KB -----\n${kb}\n--------------`);
  const botWant = {
    chatbotEnabled: true,
    chatbotPersonaName: ASSISTANT,
    chatbotGreeting: meta.greeting ?? `Hi, I'm ${ASSISTANT}. Any questions about ${NAME}?`,
    chatbotTeaserText: `Hi, I'm ${ASSISTANT}. Any questions?`,
    chatbotFollowUpMessage: meta.followup ?? "Want the leasing team to send you what's open? Share your email and they'll reach out.",
    chatbotBrandColor: COLOR,
    chatbotCaptureMode: "ON_INTENT",
    chatbotIdleTriggerSeconds: 6,
    chatbotKnowledgeBase: kb,
    primaryCtaText: "See availability",
    primaryCtaUrl: AVAIL,
    phoneNumber: PHONE,
    contactEmail: EMAIL,
    ...(GA_ID ? { ga4MeasurementId: GA_ID } : {}),
  };
  const botChanges = diff(bot, botWant);
  // The listings block carries a timestamp, so the KB always differs; only report it when the facts part changed.
  const kbStatic = (s: unknown) => String(s ?? "").replace(/refreshed [0-9T:-]+Z/, "");
  if (bot && kbStatic(bot.chatbotKnowledgeBase) === kbStatic(kb)) delete botChanges.chatbotKnowledgeBase;
  show(`Chatbot ${ASSISTANT}`, bot, botChanges);

  const bound = await q<{ hostname: string; orgId: string; propertyId: string | null }>(
    `select hostname, "orgId", "propertyId" from "DomainBinding" where hostname = any($1::text[])`, HOSTS,
  );
  for (const h of HOSTS) {
    const b = bound.find((x) => x.hostname === h);
    if (b && b.orgId !== SG_ORG) throw new Error(`${h} is bound to another org (${b.orgId}); refusing to move it`);
    console.log(`  DomainBinding ${h}: ${b ? `already SG${b.propertyId && b.propertyId !== prop.id ? ` (property ${b.propertyId})` : ""}` : "CREATE"}`);
  }

  const popupName = `Launch — ${NAME}`;
  const popups = await q<{ id: string; name: string; status: string } & Record<string, unknown>>(
    `select * from "PopupCampaign" where "orgId" = $1 and "propertyId" = $2`, SG_ORG, prop.id,
  );
  const popup = popups.find((p) => p.name === popupName);
  for (const p of popups) if (p !== popup && p.status === "ACTIVE") console.log(`  NOTE other ACTIVE popup on this property: ${p.id} "${p.name}"`);
  const popupWant = {
    name: popupName,
    status: "ACTIVE",
    headline: m("headline"),
    body: m("body"),
    eyebrowText: `${NAME.toUpperCase()} · ${CITY.toUpperCase()}`,
    ctaText: "Send me openings",
    ctaUrl: AVAIL,
    secondaryCtaText: TOUR ? "Book a tour" : null,
    secondaryCtaUrl: TOUR,
    secondaryCtaIcon: TOUR ? "calendar" : null,
    dismissText: "Not now",
    heroImageUrl: abs(m("hero")),
    primaryColor: COLOR,
    accentColor: COLOR,
    textColor: "#151515",
    backgroundColor: "#FFFFFF",
    theme: "LIGHT",
    trigger: "TIME_ON_PAGE",
    triggerThreshold: DELAY,
    frequency: "once_per_day",
    position: "CENTER",
    captureEmail: true,
    capturePhone: true,
  };
  const popupChanges = diff(popup, popupWant);
  show(`Popup "${popupName}"`, popup, popupChanges);

  // Per-property GA4 / GSC SeoIntegration rows (same service account as SG's existing rows; credentials copied, never printed).
  const seo: { provider: "GA4" | "GSC"; ident: string; existing?: { id: string; propertyIdentifier: string } ; src: Record<string, unknown> }[] = [];
  for (const [provider, ident] of [["GA4", GA_PROPERTY], ["GSC", GSC]] as const) {
    if (!ident) continue;
    const [src] = await q<Record<string, unknown>>(
      `select "serviceAccountEmail", "serviceAccountJsonEncrypted" from "SeoIntegration" where "orgId" = $1 and provider = $2::"SeoProvider" and "serviceAccountJsonEncrypted" is not null order by ("propertyId" is null) desc, "updatedAt" desc limit 1`, SG_ORG, provider,
    );
    if (!src) throw new Error(`no SG ${provider} SeoIntegration row to copy service-account credentials from`);
    const [existing] = await q<{ id: string; propertyIdentifier: string }>(
      `select id, "propertyIdentifier" from "SeoIntegration" where "orgId" = $1 and "propertyId" = $2 and provider = $3::"SeoProvider"`, SG_ORG, prop.id, provider,
    );
    console.log(`  SeoIntegration ${provider} ${ident}: ${!existing ? "CREATE" : existing.propertyIdentifier === ident ? "no change" : `UPDATE from ${existing.propertyIdentifier}`} (SA ${src.serviceAccountEmail})`);
    seo.push({ provider, ident, existing, src });
  }

  if (!APPLY) {
    console.log("  (dry run: nothing written; add --apply)");
    return;
  }
  if (Object.keys(propChanges).length) await update("Property", prop.id, propChanges);
  if (bot) await update("PropertyChatbotConfig", String(bot.id), { ...botChanges, chatbotKnowledgeBase: kb });
  else await insert("PropertyChatbotConfig", { orgId: SG_ORG, propertyId: prop.id, ...botWant });
  for (const h of HOSTS) {
    if (!bound.some((b) => b.hostname === h)) {
      await insert("DomainBinding", { orgId: SG_ORG, propertyId: prop.id, hostname: h, isPrimary: false, dnsConfigured: true });
    }
  }
  if (popup) {
    if (Object.keys(popupChanges).length) await update("PopupCampaign", popup.id, popupChanges);
  } else await insert("PopupCampaign", { orgId: SG_ORG, propertyId: prop.id, ...popupWant });
  for (const r of seo) {
    if (r.existing?.propertyIdentifier === r.ident) continue;
    const data = { propertyIdentifier: r.ident, serviceAccountEmail: r.src.serviceAccountEmail, serviceAccountJsonEncrypted: r.src.serviceAccountJsonEncrypted };
    if (r.existing) await update("SeoIntegration", r.existing.id, data);
    else await insert("SeoIntegration", { orgId: SG_ORG, propertyId: prop.id, provider: r.provider, ...data });
  }
  // Same call the portal makes on IMPORTED -> ACTIVE: the sync skipped this
  // building's records while it was inactive, so the next AppFolio run must
  // widen to the backfill window. Armed on every apply (harmless when nothing
  // is missing) so re-running the launch also repairs a skipped backfill.
  await requestAppfolioBackfill([SG_ORG]); // logs + captures, never throws: verify below
  const [armed] = await q<{ backfillRequestedAt: Date | null }>(
    `select "backfillRequestedAt" from "AppFolioIntegration" where "orgId" = $1`, SG_ORG,
  );
  if (!armed?.backfillRequestedAt) throw new Error("applied, but the AppFolio backfill was NOT armed; re-run");
  console.log(`  applied (AppFolio backfill armed ${new Date(armed.backfillRequestedAt).toISOString()})`);
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
