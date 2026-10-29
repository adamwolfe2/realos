import type { Metadata } from "next";
import Link from "next/link";
import { SourceMark } from "@/components/portal/source-mark";
import { ArrowRight, Check } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { soft } from "@/lib/soft";
import { getFirstRunSignal } from "@/lib/portal/first-run";
import { resolveIntegrationStatuses } from "@/lib/integrations/status";
import { ProspectProfileSchema } from "@/lib/chatbot/extract-prospect-profile";
import { Initial, Logo, Metric, Panel, Pill, change, type Tone } from "@/components/portal/overview/kit";
import { AgentTrace, type Step } from "@/components/portal/overview/agent-trace";
import { ConversationPreview } from "@/components/portal/overview/conversation-preview";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal: the agent home. Leads with what the agent is doing (its log and
// the latest conversation), then the reporting. The previous funnel
// dashboard lives on unchanged at /portal/performance.
// ---------------------------------------------------------------------------

const DAY = 86_400_000;
const fmt = new Intl.NumberFormat("en-US");
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

const PATTERN: Record<string, string> = {
  PRICING_QUESTION_NO_CAPTURE: "renters asked about price and left",
  AVAILABILITY_QUESTION_NO_CAPTURE: "availability questions went unanswered",
  TOUR_INTENT_NO_TOUR: "tour requests never booked",
  APPLICATION_HELP_NEEDED: "prospects got stuck on the application",
  BOT_FALLBACK_PATTERN: "the chatbot could not answer",
};

const SOURCES = [
  { slug: "google-ads", label: "Google Ads" },
  { slug: "meta-ads", label: "Meta" },
  { slug: "ga4", label: "GA4" },
  { slug: "gsc", label: "Search Console" },
  { slug: "appfolio", label: "AppFolio" },
];

const LEAD_SOURCE: Record<string, { label: string; color: string }> = {
  CHATBOT: { label: "Chatbot", color: "var(--t-accent)" },
  ORGANIC: { label: "Organic search", color: "#6d9bff" },
  GOOGLE_ADS: { label: "Google Ads", color: "#a9c4ff" },
  META_ADS: { label: "Meta Ads", color: "#d4e1ff" },
};
const OTHER_SOURCE = { label: "Other", color: "#dcdcd8" };

export default async function PortalOverview({ searchParams }: { searchParams: Promise<{ dashboard?: string }> }) {
  const scope = await requireScope();
  const sp = await searchParams;
  if (sp.dashboard !== "1") {
    const firstRun = await getFirstRunSignal(scope.orgId).catch(soft(null, "portal.overview:first-run"));
    if (firstRun?.isFirstRun) {
      const { redirect } = await import("next/navigation");
      redirect("/portal/setup");
    }
  }

  const orgId = scope.orgId;
  const allowed = scope.allowedPropertyIds;
  const propScope = allowed ? { propertyId: { in: allowed } } : {};
  // Marketable gate: org-level rows plus rows on ACTIVE properties, wrapped
  // in AND so no sibling OR clobbers it.
  const gate = allowed
    ? { propertyId: { in: allowed } }
    : { OR: [{ propertyId: null }, { property: { lifecycle: "ACTIVE" as const } }] };
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY);
  const since60 = new Date(now - 60 * DAY);

  const [org, properties, convs, recentCaptured, leadRows, knowledge, site, insights, appliedRows, statuses, lastRun] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
    prisma.property.findMany({
      where: { orgId, lifecycle: "ACTIVE", ...(allowed ? { id: { in: allowed } } : {}) },
      select: { id: true, name: true, city: true, launchStatus: true, chatbotConfig: { select: { chatbotEnabled: true, chatbotPersonaName: true } } },
      take: 200,
    }),
    // ponytail: 60 days of rows in memory; switch to SQL date_trunc buckets past ~50k chats.
    prisma.chatbotConversation.findMany({
      where: { orgId, createdAt: { gte: since60 }, AND: [gate] },
      select: { createdAt: true, lastMessageAt: true, propertyId: true, capturedEmail: true, capturedPhone: true },
    }),
    prisma.chatbotConversation.findMany({
      where: { orgId, messageCount: { gte: 2 }, AND: [gate, { OR: [{ capturedEmail: { not: null } }, { capturedPhone: { not: null } }] }] },
      orderBy: { lastMessageAt: "desc" },
      take: 10,
      select: { id: true, capturedName: true, capturedEmail: true, messages: true, prospectProfile: true, property: { select: { name: true, chatbotConfig: { select: { chatbotPersonaName: true } } } } },
    }),
    prisma.lead.groupBy({ by: ["propertyId", "source"], where: { orgId, createdAt: { gte: since30 }, AND: [gate] }, _count: { _all: true } }),
    prisma.chatbotKnowledgeSuggestion.findMany({ where: { orgId, ...propScope, status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, patternType: true, affectedCount: true, suggestedText: true, createdAt: true, propertyId: true, property: { select: { name: true } } } }),
    prisma.siteImprovementRecommendation.findMany({ where: { orgId, ...propScope, status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, suggestedTitle: true, suggestedBody: true, targetSurface: true, createdAt: true, propertyId: true, property: { select: { name: true } } } }),
    prisma.insight.findMany({ where: { orgId, ...propScope, status: "open", category: { in: ["ads", "seo", "traffic"] } }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, title: true, suggestedAction: true, body: true, category: true, href: true, createdAt: true, propertyId: true, property: { select: { name: true } } } }),
    prisma.chatbotKnowledgeSuggestion.findMany({ where: { orgId, ...propScope, status: "APPLIED", appliedAt: { gte: since30 } }, orderBy: { appliedAt: "desc" }, take: 10, select: { id: true, suggestedText: true, appliedAt: true, property: { select: { name: true } } } }),
    resolveIntegrationStatuses(orgId).catch(soft([], "portal.overview:statuses")),
    prisma.chatbotLearningCase.findFirst({ where: { orgId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  // ---- Conversations.
  const isCap = (c: (typeof convs)[number]) => Boolean(c.capturedEmail || c.capturedPhone);
  const cur = convs.filter((c) => c.createdAt >= since30);
  const prev = convs.filter((c) => c.createdAt < since30);
  const curCap = cur.filter(isCap).length;
  const prevCap = prev.filter(isCap).length;
  const capDelta = pct(curCap, cur.length) - pct(prevCap, prev.length);
  const weekIdx = (d: Date) => Math.floor((now - d.getTime()) / (7 * DAY));
  const weeks = Array.from({ length: 8 }, (_, i) => ({ label: i === 7 ? "This week" : `${7 - i}w ago`, total: 0, captured: 0 }));
  const perProp = new Map<string, { week: number[]; capWeek: number; last: Date | null }>();
  for (const c of convs) {
    const w = weekIdx(c.createdAt);
    if (w < 8) {
      weeks[7 - w].total += 1;
      if (isCap(c)) weeks[7 - w].captured += 1;
    }
    if (!c.propertyId) continue;
    const p = perProp.get(c.propertyId) ?? { week: Array(8).fill(0), capWeek: 0, last: null };
    if (w < 8) p.week[w] += 1;
    if (w === 0 && isCap(c)) p.capWeek += 1;
    if (!p.last || c.lastMessageAt > p.last) p.last = c.lastMessageAt;
    perProp.set(c.propertyId, p);
  }

  // ---- Leads.
  const leadTotal = leadRows.reduce((s, r) => s + r._count._all, 0);
  const bySource = new Map<string, number>();
  for (const r of leadRows) {
    const k = LEAD_SOURCE[r.source] ? r.source : "OTHER";
    bySource.set(k, (bySource.get(k) ?? 0) + r._count._all);
  }
  const leadShare = [...bySource.entries()]
    .map(([k, v]) => ({ key: k, ...(LEAD_SOURCE[k] ?? OTHER_SOURCE), value: v }))
    .sort((a, b) => (a.key === "OTHER" ? 1 : b.key === "OTHER" ? -1 : b.value - a.value));
  const chatShare = pct(bySource.get("CHATBOT") ?? 0, leadTotal);

  // ---- Properties, busiest first.
  const props = properties
    .map((p) => {
      const s = perProp.get(p.id) ?? { week: Array(8).fill(0), capWeek: 0, last: null };
      const usual = Math.round((s.week[1] + s.week[2] + s.week[3] + s.week[4]) / 4);
      return { ...p, live: Boolean(p.chatbotConfig?.chatbotEnabled), thisWeek: s.week[0], capWeek: s.capWeek, usual, last: s.last };
    })
    .sort((a, b) => b.thisWeek - a.thisWeek || a.name.localeCompare(b.name));
  const liveBots = props.filter((p) => p.live).length;

  // ---- Sources.
  const stateBySlug = new Map(statuses.map((s) => [s.slug, s.state]));
  const liveSources = SOURCES.filter((s) => ["connected", "stale"].includes(stateBySlug.get(s.slug) ?? ""));

  // ---- The agent's log, newest first.
  const steps: Step[] = [
    ...(() => {
      const active = props.filter((p) => p.thisWeek && p.last);
      if (!active.length) return [];
      const total = active.reduce((n, p) => n + p.thisWeek, 0);
      const leads = active.reduce((n, p) => n + p.capWeek, 0);
      const at = active.reduce((d, p) => (p.last! > d ? p.last! : d), active[0].last!);
      return [{
        key: "answered", at, kind: "answered" as const,
        title: `${total} conversations this week`,
        property: active.length === 1 ? active[0].name : `across ${active.length} properties`,
        thought: active.map((p) => `${p.name} ${p.thisWeek}`).join(" · "),
        tag: leads ? { text: `${leads} leads`, tone: "good" as const } : undefined,
      }];
    })(),
    ...knowledge.map((k): Step => ({
      key: `k-${k.id}`, at: k.createdAt, kind: "drafted", title: `after ${k.affectedCount} chats where ${PATTERN[k.patternType] ?? "the answer was missing"}`,
      property: k.property?.name, thought: k.suggestedText, tag: { text: "Needs approval", tone: "ai" }, action: { id: k.id, kind: "knowledge" },
    })),
    ...site.map((s): Step => ({
      key: `s-${s.id}`, at: s.createdAt, kind: "site", title: s.suggestedTitle, property: s.property?.name,
      thought: s.suggestedBody, logo: s.targetSurface === "CONTENT_WORKFLOW" ? "gsc" : "ga4", action: { id: s.id, kind: "site" },
    })),
    ...insights.map((i): Step => ({
      key: `i-${i.id}`, at: i.createdAt, kind: "flag", title: i.title, property: null,
      thought: i.suggestedAction ?? i.body, logo: /meta/i.test(i.title) ? "meta-ads" : i.category === "ads" ? "google-ads" : "gsc",
      tag: { text: "Spend", tone: "bad" }, action: i.href ? { href: i.href } : undefined,
    })),
    ...appliedRows.flatMap((a): Step[] => (a.appliedAt ? [{
      key: `a-${a.id}`, at: a.appliedAt, kind: "applied", title: a.suggestedText, property: a.property?.name,
      tag: { text: "Live in chatbot", tone: "good" },
    }] : [])),
    ...(lastRun ? [{ key: "run", at: lastRun.createdAt, kind: "run" as const, title: "reviewed every new conversation and source" }] : []),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const waiting = knowledge.length + site.length + insights.length;

  // The newest captured chat that actually has a transcript to show.
  const featured = recentCaptured.find((c) => Array.isArray(c.messages) && c.messages.length >= 2) ?? null;

  // ---- Featured conversation summary, from the agent's own extraction.
  const profile = featured?.prospectProfile ? ProspectProfileSchema.safeParse(featured.prospectProfile) : null;
  const summary = profile?.success
    ? [
        [profile.data.roomType, profile.data.moveInDate && `move-in ${profile.data.moveInDate}`].filter(Boolean).join(", "),
        profile.data.budgetMonthly && `Budget ${profile.data.budgetMonthly}`,
        [profile.data.partySize, profile.data.petsAndKids].filter(Boolean).join(", "),
        profile.data.followUpNeeded && `Next: ${profile.data.followUpNeeded}`,
      ].filter((l): l is string => Boolean(l))
    : [];

  const metricTone = (d: number): Tone => (d > 0 ? "good" : d < 0 ? "bad" : "neutral");

  // Brand-new workspace: no chats, no leads, nothing connected. A wall of
  // zeros reads as "is this working?", so point at the three setup steps.
  if (!convs.length && !leadTotal && !liveSources.length) {
    const first = props[0];
    const next = [
      { title: "Your property", note: first ? `${first.name} is added` : "Add the building you want leads for", done: Boolean(first), href: "/portal/setup" },
      { title: "Connect your data", note: "AppFolio, Google Analytics, Search Console or your ads", done: false, href: "/portal/setup" },
      { title: "Turn on your chatbot", note: "Name it, teach it your policies, try it, install it", done: liveBots > 0, href: "/portal/chatbot" },
    ];
    return (
      <div className="w-full space-y-5">
        <header>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--t-ink)]">Welcome to LeaseStack</h1>
          <p className="mt-0.5 text-[13.5px] text-[var(--t-muted)]">Three steps and your agent starts answering renters and learning from every chat.</p>
        </header>
        <Panel title={`Get ${first?.name ?? org?.name ?? "your property"} live`} aside={`${next.filter((n) => n.done).length} of 3 done`} flush>
          <ol className="divide-y divide-[var(--t-divider)]">
            {next.map((n, i) => (
              <li key={n.title}>
                <Link href={n.href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--t-wash)]">
                  <span className={n.done ? "grid h-6 w-6 place-items-center rounded-full bg-[#16a34a] text-[12px] font-semibold text-white" : "grid h-6 w-6 place-items-center rounded-full bg-[var(--t-wash)] text-[12px] font-semibold text-[var(--t-text)]"}>{n.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-[var(--t-ink)]">{n.title}</span>
                    <span className="block truncate text-[12.5px] text-[var(--t-muted)]">{n.note}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-[var(--t-muted)]" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--t-ink)]">Overview</h1>
          <p className="mt-0.5 text-[13.5px] text-[var(--t-muted)]">
            {org?.name ?? "Workspace"} · {props.length} {props.length === 1 ? "property" : "properties"} · {liveBots} {liveBots === 1 ? "chatbot" : "chatbots"} live
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--t-border)] bg-white pl-2.5 pr-3 text-[12.5px] text-[var(--t-text)]">
            <span className="ls-live-dot" aria-hidden />
            Agent active
            {liveSources.length ? <span className="ml-1 flex items-center gap-1 border-l border-[var(--t-border)] pl-2">{liveSources.map((s) => <Logo key={s.slug} slug={s.slug} size={12} />)}</span> : null}
          </span>
          {waiting ? (
            <Link href="/portal/conversations/insights" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--t-primary-bg)] text-[var(--t-primary-fg)] px-3.5 text-[13px] font-medium text-white transition-colors hover:opacity-90">
              Review {waiting} {waiting === 1 ? "fix" : "fixes"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </header>

      <dl className="grid grid-cols-2 rounded-[var(--t-radius)] border border-[var(--t-border)] bg-[var(--t-card)] shadow-[var(--t-shadow)] lg:grid-cols-4 [&>*]:border-[var(--t-divider)] lg:[&>*:not(:last-child)]:border-r max-lg:[&>*:nth-child(odd)]:border-r max-lg:[&>*:nth-child(-n+2)]:border-b">
        <Metric label="Conversations" value={fmt.format(cur.length)} delta={change(cur.length, prev.length)} note="Last 30 days vs the 30 before" />
        <Metric label="Leads captured" value={fmt.format(curCap)} delta={change(curCap, prevCap)} note={leadTotal ? `${chatShare}% of all new leads` : "By the chatbot"} />
        <Metric label="Capture rate" value={`${pct(curCap, cur.length)}%`} delta={prev.length ? { text: `${capDelta > 0 ? "+" : ""}${capDelta} pts`, tone: metricTone(capDelta) } : null} note="Chats that left contact info" />
        <Metric label="Fixes waiting" value={waiting} delta={appliedRows.length ? { text: `${appliedRows.length} applied`, tone: "good" } : null} note="Drafted from your data" />
      </dl>

      <div className="grid gap-5 lg:grid-cols-12">
        <Panel title="Agent activity" aside={<Link href="/portal/conversations/insights" className="hover:text-[var(--t-ink)]">Full log</Link>} className="lg:col-span-7" flush>
          <AgentTrace steps={steps.slice(0, 5)} now={now} />
        </Panel>
        <Panel title="Latest conversation" aside={<Link href="/portal/conversations" className="hover:text-[var(--t-ink)]">All conversations</Link>} className="lg:col-span-5" flush>
          {featured ? (
            <ConversationPreview
              id={featured.id}
              name={featured.capturedName ?? featured.capturedEmail ?? "Website visitor"}
              property={featured.property?.name ?? null}
              persona={featured.property?.chatbotConfig?.chatbotPersonaName ?? "your chatbot"}
              messages={featured.messages}
              summary={summary}
            />
          ) : (
            <p className="px-4 py-6 text-[13.5px] text-[var(--t-muted)]">The first captured conversation shows up here.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <Panel title="Conversations by week" aside={<span className="flex items-center gap-3"><Legend color="var(--t-accent)">Left contact info</Legend><Legend color="#dfe9ff">Browsed only</Legend></span>} className="lg:col-span-8">
          <WeekBars weeks={weeks} />
        </Panel>
        <Panel title="Where leads came from" aside="30 days" className="lg:col-span-4">
          {leadTotal ? (
            <>
              <p className="text-[24px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--t-ink)]">{chatShare}%<span className="ml-2 text-[13px] font-normal tracking-normal text-[var(--t-muted)]">from the chatbot</span></p>
              <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Lead share by source">
                {leadShare.map((l) => <span key={l.key} className="rounded-full" style={{ width: `${pct(l.value, leadTotal)}%`, background: l.color }} />)}
              </div>
              <ul className="mt-4 space-y-2 text-[13px]">
                {leadShare.map((l) => (
                  <li key={l.key} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[var(--t-text)]"><SourceMark source={l.key} size={22} />{l.label}</span>
                    <span className="tabular-nums text-[var(--t-ink)]">{l.value}<span className="ml-2 inline-block w-9 text-right text-[var(--t-muted)]">{pct(l.value, leadTotal)}%</span></span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[13.5px] text-[var(--t-muted)]">No new leads in the last 30 days.</p>
          )}
        </Panel>
      </div>

      <Panel title="Chatbots by property" aside={<Link href="/portal/properties" className="hover:text-[var(--t-ink)]">All {props.length}</Link>} flush>
        <ul className="divide-y divide-[var(--t-divider)]">
          {props.slice(0, 8).map((p) => {
            const pace = p.usual ? p.thisWeek / p.usual : null;
            return (
              <li key={p.id}>
                <Link href={`/portal/properties/${p.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--t-wash)] sm:grid-cols-[auto_1fr_150px_90px_150px]">
                  <Initial name={p.name} size={30} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium text-[var(--t-ink)]">{p.name}</span>
                    <span className="block truncate text-[12px] text-[var(--t-muted)]">{p.city ?? ""}{p.live ? ` · ${p.chatbotConfig?.chatbotPersonaName ?? "Chatbot"} is live` : " · chatbot not live"}</span>
                  </span>
                  <span className="hidden text-right text-[13px] tabular-nums text-[var(--t-ink)] sm:block">{p.thisWeek}<span className="ml-1 text-[var(--t-muted)]">chats this week</span></span>
                  <span className="hidden text-right text-[13px] tabular-nums text-[var(--t-ink)] sm:block">{p.capWeek}<span className="ml-1 text-[var(--t-muted)]">leads</span></span>
                  <span className="justify-self-end">
                    {!p.live ? <Pill>{p.launchStatus === "ONBOARDING" ? "Onboarding" : "Off"}</Pill>
                      : pace === null ? <Pill>New</Pill>
                      : pace < 0.8 ? <Pill tone="warn">{Math.round((1 - pace) * 100)}% below usual</Pill>
                      : pace > 1.05 ? <Pill tone="good">+{Math.round((pace - 1) * 100)}% vs usual</Pill>
                      : <Pill>On pace</Pill>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>

      <p className="text-[12.5px] text-[var(--t-muted)]">
        Funnel, ad spend and occupancy reporting lives under{" "}
        <Link href="/portal/performance" className="text-[var(--t-text)] underline underline-offset-2">Performance</Link>.
      </p>
    </div>
  );
}

function Legend({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--t-text)]">
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

function WeekBars({ weeks }: { weeks: { label: string; total: number; captured: number }[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.total));
  return (
    <div className="grid grid-cols-8 items-end gap-2 sm:gap-3" style={{ height: 196 }} role="img" aria-label="Chatbot conversations per week, last 8 weeks">
      {weeks.map((w, i) => {
        const last = i === weeks.length - 1;
        return (
          <div key={w.label} className="flex h-full flex-col items-center justify-end gap-1.5">
            <span className={`text-[12px] tabular-nums ${last ? "font-semibold text-[var(--t-ink)]" : "text-[var(--t-muted)]"}`}>{w.total}</span>
            <div className="ls-bar flex w-full max-w-[56px] flex-col justify-end overflow-hidden rounded-[6px]" style={{ height: `${(w.total / max) * 140}px`, animationDelay: `${i * 40}ms` }}>
              <span style={{ flex: w.total - w.captured, background: last ? "#c9dbff" : "#e8effe" }} />
              <span style={{ flex: w.captured, background: last ? "var(--t-accent)" : "#8db2ff" }} />
            </div>
            <span className={`whitespace-nowrap text-[11.5px] ${last ? "font-medium text-[var(--t-ink)]" : "text-[var(--t-muted)]"}`}>{w.label}</span>
          </div>
        );
      })}
    </div>
  );
}
