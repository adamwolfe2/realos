import "server-only";
import { prisma } from "@/lib/db";
import { propertyIdsToWhere } from "@/lib/tenancy/property-filter";
import {
  classifySource,
  getSource,
  sourceFromLeadEnum,
} from "@/lib/attribution/source-taxonomy";
import type { Ga4SourceLanding } from "@/lib/attribution/ga4-sources";
import type { AttributionFilters } from "@/lib/attribution/queries";

// ---------------------------------------------------------------------------
// Reverse attribution — trace web traffic back to where it came from.
//
// Blends first-party pixel sessions (VisitorSession → Visitor identity) with
// GA4 source × landing-page volume into a 3-stage graph:
//
//     Referrer / Source  →  Landing page  →  Outcome (lead / identified / anon)
//
// Plus a Cursive-style resolutions table: every identified visit with its
// referrer, landing page, identity, location, and age range.
// ---------------------------------------------------------------------------

export type RvNodeKind = "source" | "landing" | "outcome";
export type RvNode = {
  id: string; // namespaced: src:* | lp:* | out:*
  label: string;
  kind: RvNodeKind;
  color: string;
  logo?: string; // canonical source id, for <SourceLogo>
  value: number;
};
export type RvLink = { source: string; target: string; value: number };

export type ReverseGraph = {
  sources: RvNode[];
  landings: RvNode[];
  outcomes: RvNode[];
  links: RvLink[];
};

export type ResolutionRow = {
  id: string;
  occurredAt: string; // ISO
  sourceId: string;
  sourceLabel: string;
  referrer: string; // raw referrer or "$direct"
  landingPath: string;
  name: string; // "First Last" or "—"
  location: string; // "City, ST" or "—"
  ageRange: string; // or "—"
  intentScore: number;
  isLead: boolean;
};

export type ReverseAttribution = {
  graph: ReverseGraph;
  resolutions: ResolutionRow[];
  totalSessions: number;
  identifiedCount: number;
  leadCount: number;
};

const IDENTIFIED_STATUSES = new Set([
  "IDENTIFIED",
  "ENRICHED",
  "MATCHED_TO_LEAD",
]);

const TOP_LANDINGS = 7;
const MAX_RESOLUTIONS = 200;
const SESSION_SCAN_CAP = 5000;

const OUTCOME_META: Record<string, { label: string; color: string }> = {
  lead: { label: "Lead", color: "#2563EB" },
  identified: { label: "Identified", color: "#7C3AED" },
  anon: { label: "Anonymous", color: "#94A3B8" },
};

export async function getReverseAttribution(
  filters: AttributionFilters,
  ga4Landing?: Ga4SourceLanding[] | null,
): Promise<ReverseAttribution> {
  const sessions = await prisma.visitorSession.findMany({
    where: {
      orgId: filters.orgId,
      startedAt: { gte: filters.fromDate, lte: filters.toDate },
      ...(filters.propertyIds && filters.propertyIds.length > 0
        ? { visitor: propertyIdsToWhere(filters.propertyIds) }
        : {}),
    },
    orderBy: { startedAt: "desc" },
    take: SESSION_SCAN_CAP,
    select: {
      id: true,
      startedAt: true,
      firstReferrer: true,
      firstUrl: true,
      utmSource: true,
      utmMedium: true,
      visitor: {
        select: {
          status: true,
          firstName: true,
          lastName: true,
          intentScore: true,
          enrichedData: true,
          _count: { select: { leads: true } },
        },
      },
    },
  });

  // --- Aggregate links + node totals -------------------------------------
  const srcLanding = new Map<string, number>(); // `${srcId}>>${path}`
  const landingOutcome = new Map<string, number>(); // `${path}>>${outcome}`
  const sourceTotal = new Map<string, number>();
  const landingTotal = new Map<string, number>();
  const outcomeTotal = new Map<string, number>();

  const add = (m: Map<string, number>, k: string, n: number) =>
    m.set(k, (m.get(k) ?? 0) + n);

  let identifiedCount = 0;
  let leadCount = 0;

  for (const s of sessions) {
    const srcId = classifySource(s.utmSource, s.firstReferrer, s.utmMedium).id;
    const path = normalizePath(s.firstUrl);
    const isLead = (s.visitor?._count.leads ?? 0) > 0;
    const isIdentified =
      !!s.visitor?.status && IDENTIFIED_STATUSES.has(s.visitor.status);
    const outcome = isLead ? "lead" : isIdentified ? "identified" : "anon";
    if (isLead) leadCount += 1;
    else if (isIdentified) identifiedCount += 1;

    add(srcLanding, `${srcId}>>${path}`, 1);
    add(landingOutcome, `${path}>>${outcome}`, 1);
    add(sourceTotal, srcId, 1);
    add(landingTotal, path, 1);
    add(outcomeTotal, outcome, 1);
  }

  // Fold in GA4 reach the pixel never saw → counts as anonymous outcome.
  if (ga4Landing) {
    for (const g of ga4Landing) {
      add(srcLanding, `${g.sourceId}>>${g.landingPath}`, g.sessions);
      add(landingOutcome, `${g.landingPath}>>anon`, g.sessions);
      add(sourceTotal, g.sourceId, g.sessions);
      add(landingTotal, g.landingPath, g.sessions);
      add(outcomeTotal, "anon", g.sessions);
    }
  }

  // --- Collapse the long tail of landing pages into "Other pages" --------
  const rankedLandings = Array.from(landingTotal.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  const keptLandings = new Set(
    rankedLandings.slice(0, TOP_LANDINGS).map(([p]) => p),
  );
  const landingKey = (path: string) =>
    keptLandings.has(path) ? path : "__other__";

  // --- Build nodes -------------------------------------------------------
  const sourceNodes: RvNode[] = Array.from(sourceTotal.entries())
    .filter(([id]) => id !== "other" && id !== "manual")
    .map(([id, value]) => {
      const meta = getSource(id);
      return {
        id: `src:${id}`,
        label: meta.label,
        kind: "source" as const,
        color: meta.color,
        logo: id,
        value,
      };
    })
    .sort((a, b) => b.value - a.value);

  const landingAgg = new Map<string, number>();
  for (const [path, n] of landingTotal) add(landingAgg, landingKey(path), n);
  const landingNodes: RvNode[] = Array.from(landingAgg.entries())
    .map(([key, value]) => ({
      id: `lp:${key}`,
      label: key === "__other__" ? "Other pages" : key,
      kind: "landing" as const,
      color: "#0EA5E9",
      value,
    }))
    .sort((a, b) => b.value - a.value);

  const outcomeNodes: RvNode[] = ["lead", "identified", "anon"]
    .filter((o) => (outcomeTotal.get(o) ?? 0) > 0)
    .map((o) => ({
      id: `out:${o}`,
      label: OUTCOME_META[o].label,
      kind: "outcome" as const,
      color: OUTCOME_META[o].color,
      value: outcomeTotal.get(o) ?? 0,
    }));

  // --- Build links (remap collapsed landings) ----------------------------
  const linkAgg = new Map<string, number>();
  for (const [k, n] of srcLanding) {
    const [srcId, path] = k.split(">>");
    if (srcId === "other" || srcId === "manual") continue; // unattributed
    add(linkAgg, `src:${srcId}>>lp:${landingKey(path)}`, n);
  }
  for (const [k, n] of landingOutcome) {
    const [path, outcome] = k.split(">>");
    add(linkAgg, `lp:${landingKey(path)}>>out:${outcome}`, n);
  }
  const links: RvLink[] = Array.from(linkAgg.entries()).map(([k, value]) => {
    const [source, target] = k.split(">>");
    return { source, target, value };
  });

  // --- Resolutions table (identified visits, newest first) ---------------
  const resolutions: ResolutionRow[] = [];
  for (const s of sessions) {
    const v = s.visitor;
    if (!v) continue;
    const isLead = (v._count.leads ?? 0) > 0;
    const isIdentified = !!v.status && IDENTIFIED_STATUSES.has(v.status);
    if (!isLead && !isIdentified) continue;

    const enriched = (v.enrichedData ?? null) as Record<
      string,
      unknown
    > | null;
    const city = readEnriched(enriched, ["PERSONAL_CITY", "CITY", "city"]);
    const state = readEnriched(enriched, [
      "PERSONAL_STATE",
      "STATE",
      "state",
    ]);
    const age = readEnriched(enriched, [
      "AGE_RANGE",
      "PERSONAL_AGE_RANGE",
      "age_range",
      "AGE",
    ]);
    const src = getSource(
      classifySource(s.utmSource, s.firstReferrer, s.utmMedium).id,
    );
    const name = [v.firstName, v.lastName].filter(Boolean).join(" ").trim();

    resolutions.push({
      id: s.id,
      occurredAt: s.startedAt.toISOString(),
      sourceId: src.id,
      sourceLabel: src.label,
      referrer: s.firstReferrer?.trim() || "$direct",
      landingPath: normalizePath(s.firstUrl),
      name: name || "—",
      location: [city, state].filter(Boolean).join(", ") || "—",
      ageRange: age || "—",
      intentScore: v.intentScore ?? 0,
      isLead,
    });
    if (resolutions.length >= MAX_RESOLUTIONS) break;
  }

  const totalSessions = Array.from(sourceTotal.values()).reduce(
    (a, b) => a + b,
    0,
  );

  return {
    graph: { sources: sourceNodes, landings: landingNodes, outcomes: outcomeNodes, links },
    resolutions,
    totalSessions,
    identifiedCount,
    leadCount,
  };
}

// ---------------------------------------------------------------------------
// Channel pipeline — reverse-attribute every lead (including AppFolio "Other"
// imports) to a real marketing channel, then bucket the tour → apply → sign
// funnel BY channel. Resolution order per lead:
//   1. the lead's own linked visitor session referrer/UTM
//   2. email-match to a pixel-identified visitor's session referrer/UTM
//      (this is how an AppFolio import with no channel gets "broken down")
//   3. the lead's source enum
//   4. Unattributed (genuinely no referral signal anywhere)
// ---------------------------------------------------------------------------

export type ChannelPipelineRow = {
  sourceId: string;
  label: string;
  color: string;
  logo: string;
  leads: number;
  toured: number;
  applied: number;
  signed: number;
  signedRate: number | null; // signed / leads
};

const FUNNEL_RANK: Record<string, number> = {
  NEW: 0,
  CONTACTED: 1,
  TOUR_SCHEDULED: 2,
  TOURED: 3,
  APPLICATION_SENT: 4,
  APPLIED: 5,
  APPROVED: 6,
  SIGNED: 7,
  LOST: -1,
  UNQUALIFIED: -1,
};

type SessionSignal = {
  utmSource: string | null;
  utmMedium: string | null;
  firstReferrer: string | null;
};

export async function getChannelPipeline(
  filters: AttributionFilters,
): Promise<ChannelPipelineRow[]> {
  const [leads, identifiedVisitors] = await Promise.all([
    prisma.lead.findMany({
      where: {
        orgId: filters.orgId,
        ...propertyIdsToWhere(filters.propertyIds ?? null),
        createdAt: { gte: filters.fromDate, lte: filters.toDate },
      },
      select: {
        source: true,
        status: true,
        email: true,
        visitor: {
          select: {
            sessions: {
              orderBy: { startedAt: "desc" },
              take: 1,
              select: {
                utmSource: true,
                utmMedium: true,
                firstReferrer: true,
              },
            },
          },
        },
      },
    }),
    // Email → referral signal lookup, for leads with no linked visitor.
    prisma.visitor.findMany({
      where: {
        orgId: filters.orgId,
        ...propertyIdsToWhere(filters.propertyIds ?? null),
        email: { not: null },
      },
      select: {
        email: true,
        sessions: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { utmSource: true, utmMedium: true, firstReferrer: true },
        },
      },
    }),
  ]);

  const emailMap = new Map<string, SessionSignal>();
  for (const v of identifiedVisitors) {
    const s = v.sessions[0];
    if (v.email && s) emailMap.set(v.email.toLowerCase(), s);
  }

  const classifyFromSignal = (sig?: SessionSignal | null) =>
    sig ? classifySource(sig.utmSource, sig.firstReferrer, sig.utmMedium) : null;

  const rows = new Map<string, ChannelPipelineRow>();
  for (const lead of leads) {
    // 1. own session
    let src = classifyFromSignal(lead.visitor?.sessions[0]);
    // 2. email match when the own session is missing or only Direct/Other
    if ((!src || src.id === "direct" || src.id === "other") && lead.email) {
      const matched = classifyFromSignal(emailMap.get(lead.email.toLowerCase()));
      if (matched && matched.id !== "other" && matched.id !== "direct") {
        src = matched;
      }
    }
    // 3. source enum, 4. unattributed
    if (!src || src.id === "other" || src.id === "manual") {
      const fromEnum = sourceFromLeadEnum(lead.source);
      src =
        fromEnum.id !== "other" && fromEnum.id !== "manual"
          ? fromEnum
          : (src ?? getSource("other"));
    }

    const row =
      rows.get(src.id) ??
      ({
        sourceId: src.id,
        label: src.id === "other" ? "Unattributed" : src.label,
        color: src.color,
        logo: src.id,
        leads: 0,
        toured: 0,
        applied: 0,
        signed: 0,
        signedRate: null,
      } satisfies ChannelPipelineRow);

    row.leads += 1;
    const rank = FUNNEL_RANK[lead.status] ?? 0;
    if (rank >= FUNNEL_RANK.TOURED) row.toured += 1;
    if (rank >= FUNNEL_RANK.APPLIED) row.applied += 1;
    if (rank >= FUNNEL_RANK.SIGNED) row.signed += 1;
    rows.set(src.id, row);
  }

  return Array.from(rows.values())
    .map((r) => ({ ...r, signedRate: r.leads > 0 ? r.signed / r.leads : null }))
    .sort((a, b) => b.leads - a.leads);
}

function readEnriched(
  obj: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function normalizePath(raw: string | null | undefined): string {
  if (!raw) return "/";
  let p = raw;
  // Accept a full URL or a bare path.
  try {
    p = new URL(raw).pathname;
  } catch {
    p = raw.split("?")[0].split("#")[0];
  }
  p = p.trim();
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}
