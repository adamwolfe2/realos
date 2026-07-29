// Identity cross-reference audit — CAN we de-anonymize at all?
//
// The attribution promise is that a person seen in one place (a chatbot chat,
// a website session, an application, a lead) can be recognised in the others.
// That only works if the same identifier actually appears on both sides. This
// script measures the real overlap for the live tenant instead of assuming it.
//
// It reports, per entity: how many rows exist and which identifiers are
// actually populated. Then it computes the pairwise overlap on every key that
// two entities share. Then it stress-tests the weak keys (IP, IP+UA) for
// false positives, because a key that collapses 40 people into one cluster is
// worse than no key at all.
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";

const prisma = new PrismaClient({
  adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any),
});

const ORG_SLUG = process.argv[2] ?? "telegraph-commons";

const email = (v: string | null | undefined) =>
  v && v.includes("@") ? v.trim().toLowerCase() : null;

// Last 10 digits. Handles +1, dashes, parens, and the leading-space bug.
const phone = (v: string | null | undefined) => {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
};

const set = <T,>(xs: Array<T | null>) => new Set(xs.filter((x): x is T => x != null));
const overlap = <T,>(a: Set<T>, b: Set<T>) => [...a].filter((x) => b.has(x)).length;
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "n/a");

function line(label: string, n: number, of: number) {
  console.log(`    ${label.padEnd(34)} ${String(n).padStart(5)} / ${String(of).padStart(5)}  ${pct(n, of)}`);
}

(async () => {
  const org = await prisma.organization.findFirst({
    where: { slug: ORG_SLUG },
    select: { id: true, name: true, slug: true },
  });
  if (!org) throw new Error(`no org ${ORG_SLUG}`);
  const orgId = org.id;
  console.log(`\n########  ${org.name}  (${org.slug})  ########`);

  const [leads, visitors, convos, sessions, residents, apps, tours, popupEvents] =
    await Promise.all([
      prisma.lead.findMany({
        where: { orgId },
        select: { id: true, email: true, phone: true, source: true, visitorId: true, createdAt: true },
      }),
      prisma.visitor.findMany({
        where: { orgId },
        select: {
          id: true, email: true, phone: true, status: true,
          cursiveVisitorId: true, visitorHash: true,
          utmSource: true, referrer: true,
        },
      }),
      prisma.chatbotConversation.findMany({
        where: { orgId },
        select: {
          id: true, capturedEmail: true, capturedPhone: true, leadId: true,
          visitorHash: true, ipAddress: true, userAgent: true, createdAt: true,
        },
      }),
      prisma.visitorSession.findMany({
        where: { orgId },
        select: {
          id: true, anonymousId: true, deviceHash: true, ipAddress: true,
          userAgent: true, visitorId: true, utmSource: true, firstReferrer: true,
        },
      }),
      prisma.resident.findMany({ where: { orgId }, select: { email: true, phone: true } }),
      prisma.application.findMany({
        where: { property: { orgId } },
        select: { id: true, lead: { select: { email: true, phone: true, source: true } } },
      }),
      prisma.tour.findMany({
        where: { property: { orgId } },
        select: { id: true, lead: { select: { email: true, phone: true } } },
      }),
      prisma.popupEvent.findMany({ where: { orgId }, select: { anonymousId: true } }),
    ]);

  // ---------------------------------------------------------------- inventory
  console.log(`\n== WHAT EXISTS, AND WHICH IDENTIFIERS ARE ACTUALLY POPULATED ==`);

  console.log(`\n  Lead (${leads.length})`);
  line("email", set(leads.map((l) => email(l.email))).size, leads.length);
  line("phone", set(leads.map((l) => phone(l.phone))).size, leads.length);
  line("linked to a Visitor", leads.filter((l) => l.visitorId).length, leads.length);

  console.log(`\n  Visitor (${visitors.length})`);
  line("email", set(visitors.map((v) => email(v.email))).size, visitors.length);
  line("phone", set(visitors.map((v) => phone(v.phone))).size, visitors.length);
  line("cursiveVisitorId (vendor-side)", visitors.filter((v) => v.cursiveVisitorId).length, visitors.length);
  line("visitorHash (browser-side)", visitors.filter((v) => v.visitorHash).length, visitors.length);
  line("utmSource", visitors.filter((v) => v.utmSource).length, visitors.length);

  console.log(`\n  ChatbotConversation (${convos.length})`);
  line("capturedEmail", set(convos.map((c) => email(c.capturedEmail))).size, convos.length);
  line("capturedPhone", set(convos.map((c) => phone(c.capturedPhone))).size, convos.length);
  line("ipAddress", convos.filter((c) => c.ipAddress).length, convos.length);
  line("userAgent", convos.filter((c) => c.userAgent).length, convos.length);
  line("visitorHash", convos.filter((c) => c.visitorHash).length, convos.length);

  console.log(`\n  VisitorSession (${sessions.length}) — first-party pixel, removed April`);
  line("anonymousId (browser cookie)", sessions.filter((s) => s.anonymousId).length, sessions.length);
  line("ipAddress", sessions.filter((s) => s.ipAddress).length, sessions.length);
  line("linked to a Visitor", sessions.filter((s) => s.visitorId).length, sessions.length);

  console.log(`\n  Resident ${residents.length} · Application ${apps.length} · Tour ${tours.length} · PopupEvent ${popupEvents.length}`);

  // ------------------------------------------------------------ email overlap
  console.log(`\n== OVERLAP ON EMAIL (the only identifier a human types themselves) ==`);

  const eLead = set(leads.map((l) => email(l.email)));
  const eVisitor = set(visitors.map((v) => email(v.email)));
  const eChat = set(convos.map((c) => email(c.capturedEmail)));
  const eResident = set(residents.map((r) => email(r.email)));
  const eApp = set(apps.map((a) => email(a.lead?.email)));

  const pair = (an: string, a: Set<string>, bn: string, b: Set<string>) => {
    const n = overlap(a, b);
    console.log(
      `    ${`${an} (${a.size})`.padEnd(22)} x ${`${bn} (${b.size})`.padEnd(22)} = ${String(n).padStart(4)} shared`,
    );
  };
  pair("Chatbot", eChat, "Lead", eLead);
  pair("Chatbot", eChat, "Visitor", eVisitor);
  pair("Chatbot", eChat, "Resident", eResident);
  pair("Lead", eLead, "Visitor", eVisitor);
  pair("Lead", eLead, "Resident", eResident);
  pair("Application", eApp, "Resident", eResident);
  pair("Application", eApp, "Visitor", eVisitor);

  // ------------------------------------------------------------ phone overlap
  console.log(`\n== OVERLAP ON PHONE (catches people who gave a number, not an email) ==`);
  const pLead = set(leads.map((l) => phone(l.phone)));
  const pVisitor = set(visitors.map((v) => phone(v.phone)));
  const pChat = set(convos.map((c) => phone(c.capturedPhone)));
  const pResident = set(residents.map((r) => phone(r.phone)));
  pair("Chatbot", pChat, "Lead", pLead);
  pair("Chatbot", pChat, "Visitor", pVisitor);
  pair("Chatbot", pChat, "Resident", pResident);
  pair("Lead", pLead, "Visitor", pVisitor);
  pair("Lead", pLead, "Resident", pResident);

  // -------------------------------------------------- weak keys: IP and IP+UA
  // The tempting fallback when nobody shares an email. Measured for false
  // positives BEFORE anyone builds on it: student housing means campus wifi
  // and carrier NAT, so one IP can front dozens of unrelated people.
  console.log(`\n== WEAK KEYS: can IP / IP+UA stand in for an identity? ==`);

  const byIp = new Map<string, typeof convos>();
  for (const c of convos) {
    if (!c.ipAddress) continue;
    const arr = byIp.get(c.ipAddress) ?? [];
    arr.push(c);
    byIp.set(c.ipAddress, arr);
  }
  const ipClusters = [...byIp.entries()].sort((a, b) => b[1].length - a[1].length);
  console.log(`    distinct IPs across ${convos.length} conversations: ${ipClusters.length}`);
  console.log(`    biggest IP clusters (conversations sharing one IP):`);
  for (const [ip, arr] of ipClusters.slice(0, 6)) {
    const emails = set(arr.map((c) => email(c.capturedEmail)));
    console.log(
      `      ${ip.padEnd(20)} ${String(arr.length).padStart(3)} convos, ${emails.size} distinct emails`,
    );
  }
  // The honest test: within an IP cluster that has 2+ known emails, IP would
  // have merged genuinely different people into one identity.
  const badIp = ipClusters.filter(
    ([, arr]) => set(arr.map((c) => email(c.capturedEmail))).size > 1,
  );
  console.log(
    `    IPs proven to front MORE THAN ONE real person: ${badIp.length} of ${ipClusters.length}`,
  );

  const byIpUa = new Map<string, typeof convos>();
  for (const c of convos) {
    if (!c.ipAddress || !c.userAgent) continue;
    const k = `${c.ipAddress}|${c.userAgent}`;
    const arr = byIpUa.get(k) ?? [];
    arr.push(c);
    byIpUa.set(k, arr);
  }
  const badIpUa = [...byIpUa.values()].filter(
    (arr) => set(arr.map((c) => email(c.capturedEmail))).size > 1,
  );
  const repeatIpUa = [...byIpUa.values()].filter((arr) => arr.length > 1);
  console.log(`    IP+UA groups: ${byIpUa.size}; groups with >1 conversation: ${repeatIpUa.length}`);
  console.log(`    IP+UA groups proven to front MORE THAN ONE real person: ${badIpUa.length}`);

  // ------------------------------------------- the returning-chatter question
  // How many conversations came from a browser that had chatted before, and
  // how many of those earlier chats had already given us contact info? That
  // is the entire prize for a LeaseStack-owned first-party cookie.
  console.log(`\n== RETURNING CHATTERS (the prize for our own cookie) ==`);
  const ordered = [...convos].sort((a, b) => +a.createdAt - +b.createdAt);
  const seenKey = new Map<string, { known: boolean }>();
  let repeats = 0;
  let repeatsWhereWeAlreadyKnewThem = 0;
  for (const c of ordered) {
    if (!c.ipAddress || !c.userAgent) continue;
    const k = `${c.ipAddress}|${c.userAgent}`;
    const prior = seenKey.get(k);
    const known = Boolean(email(c.capturedEmail) || phone(c.capturedPhone));
    if (prior) {
      repeats++;
      if (prior.known && !known) repeatsWhereWeAlreadyKnewThem++;
    }
    seenKey.set(k, { known: prior?.known || known });
  }
  console.log(`    conversations from a browser we had seen before: ${repeats} of ${convos.length} (${pct(repeats, convos.length)})`);
  console.log(`    ...of those, anonymous NOW but identified EARLIER: ${repeatsWhereWeAlreadyKnewThem}`);
  console.log(`    (upper bound — IP+UA over-merges, so the true number is lower)`);

  // ------------------------------------------------- google / aggregate sources
  console.log(`\n== GOOGLE SOURCES: is there any person-level data to join on? ==`);
  const [seoQueries, seoPages, adCampaigns, adMetrics] = await Promise.all([
    prisma.seoQuery.count({ where: { orgId } }),
    prisma.seoLandingPage.count({ where: { orgId } }),
    prisma.adCampaign.count({ where: { orgId } }),
    prisma.adMetricDaily.count({ where: { orgId } }),
  ]);
  console.log(`    SeoQuery ${seoQueries} · SeoLandingPage ${seoPages} · AdCampaign ${adCampaigns} · AdMetricDaily ${adMetrics}`);
  console.log(`    These models carry no person fields — they are per-query and`);
  console.log(`    per-day aggregates. Nothing to join to a human on.`);

  // The only person-level acquisition data we hold is the utm/referrer stamped
  // on a Visitor or a VisitorSession at first touch.
  console.log(`\n    Person-level acquisition data we DO hold:`);
  line("Visitor w/ utmSource", visitors.filter((v) => v.utmSource).length, visitors.length);
  line("Visitor w/ referrer", visitors.filter((v) => v.referrer).length, visitors.length);
  line("VisitorSession w/ utmSource", sessions.filter((s) => s.utmSource).length, sessions.length);
  line("VisitorSession w/ referrer", sessions.filter((s) => s.firstReferrer).length, sessions.length);

  await prisma.$disconnect();
})();
