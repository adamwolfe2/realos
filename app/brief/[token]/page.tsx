import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X, ExternalLink, ArrowRight, Sparkles } from "lucide-react";
import {
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
  GoogleMark,
} from "@/components/platform/artifacts/brand-logos";
import {
  BriefShellHeader,
  BriefShellFooter,
  BriefNarrativePanel,
  BriefSourcesBlock,
  SourceBullet,
  COMPETITOR_URLS as SHARED_COMPETITOR_URLS,
  engineRunUrl as sharedEngineRunUrl,
  type BriefSource,
} from "@/components/audit/brief-shell";
import { BRAND_NAME } from "@/lib/brand";
import { BRIEF_REGISTRY } from "@/lib/brief/registry";
import { getScope } from "@/lib/tenancy/scope";
import brief255Cal from "@/prospects/255-cal.json" assert { type: "json" };

// ---------------------------------------------------------------------------
// /brief/[token] — prospect brief page.
//
// Public, token-gated, single-page deep audit hand-built for one prospect
// at a time. Reads from a static JSON snapshot (`prospects/<id>.json`)
// produced by `scripts/build-prospect-brief-<id>.ts`. No DB call. No auth.
//
// Why this exists outside the /audit pipeline: the automated audit
// assumes a multifamily vertical (residential prompts, residential
// schema targets, residential reputation queries). For an enterprise
// commercial prospect we need office-vertical prompts, a hand-curated
// comp set, and a brand-disambiguation pass. This route is the
// pitch-quality output we hand prospects while the automated
// vertical-aware pipeline ships.
//
// Token format: 24-char URL-safe random. Treat the URL as the auth.
// ---------------------------------------------------------------------------

type RouteParams = { token: string };
type RouteContext = { params: Promise<RouteParams> };

// Re-export shared maps under local names so the rest of the file
// reads unchanged. Lives in components/audit/brief-shell.ts.
const COMPETITOR_URLS = SHARED_COMPETITOR_URLS;
const engineRunUrl = sharedEngineRunUrl;

// Operator-only chrome surfaced above the prospect-facing content.
// Renders nothing for anonymous / non-agency viewers — anyone with the
// brief URL still sees the full report, just without the agency
// build-proposal affordance.
function OperatorActionsBar({
  token,
  prospectName,
  domain,
}: {
  token: string;
  prospectName: string;
  domain: string;
}) {
  const proposalHref =
    `/admin/proposals/new` +
    `?brand=${encodeURIComponent(prospectName)}` +
    `&domain=${encodeURIComponent(domain)}` +
    `&briefToken=${encodeURIComponent(token)}`;
  return (
    <section
      style={{
        backgroundColor: "#EFF6FF",
        borderBottom: "1px solid #CFE2FF",
        padding: "10px 0",
      }}
      aria-label="Operator actions"
    >
      <div className="max-w-[1080px] mx-auto px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p
          className="text-[11px]"
          style={{
            color: "#1D4ED8",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Operator view · only visible to agency staff
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={proposalHref}
            className="inline-flex items-center gap-1.5 rounded-md font-semibold text-[12px]"
            style={{
              backgroundColor: "#2563EB",
              color: "#FFFFFF",
              padding: "6px 12px",
              letterSpacing: "-0.005em",
            }}
          >
            Build proposal from this brief
            <ArrowRight className="w-3 h-3" />
          </Link>
          <Link
            href="/admin/proposals"
            className="inline-flex items-center rounded-md text-[12px]"
            style={{
              backgroundColor: "#FFFFFF",
              color: "#1E2A3A",
              border: "1px solid #CFE2FF",
              padding: "6px 12px",
              fontWeight: 500,
            }}
          >
            All proposals
          </Link>
        </div>
      </div>
    </section>
  );
}

// Single source of truth for the JSON shape. Mirrors the writer script.
type BriefJson = typeof brief255Cal;

const DATA: Record<BriefRegistryEntry["dataFile"], BriefJson> = {
  "255-cal": brief255Cal,
};
type BriefRegistryEntry = (typeof BRIEF_REGISTRY)[string];

function lookup(token: string): { entry: BriefRegistryEntry; data: BriefJson } | null {
  const entry = BRIEF_REGISTRY[token];
  if (!entry) return null;
  const data = DATA[entry.dataFile];
  if (!data) return null;
  return { entry, data };
}

export async function generateMetadata({
  params,
}: RouteContext): Promise<Metadata> {
  const { token } = await params;
  const hit = lookup(token);
  if (!hit) return { title: "Brief not found", robots: { index: false, follow: false } };
  return {
    title: `${hit.entry.prospectName} — AI Search Visibility Brief`,
    description: `Confidential ${BRAND_NAME} analysis of ${hit.entry.prospectName}'s AI search visibility, structured data, and digital infrastructure.`,
    robots: { index: false, follow: false },
  };
}

export default async function BriefPage({ params }: RouteContext) {
  const { token } = await params;
  const hit = lookup(token);
  if (!hit) notFound();
  const { entry, data } = hit;
  // Operator chrome — only surfaced to authed agency-side viewers
  // (Adam + the LeaseStack team). Prospects never see this strip.
  // getScope() returns null for anonymous viewers so the check is
  // safe to render on a public route.
  const scope = await getScope().catch(() => null);
  const isOperator = scope?.role === "AGENCY_OWNER";

  return (
    <div style={{ backgroundColor: "#FFFFFF", color: "#1E2A3A" }}>
      <BriefShellHeader
        subjectName={entry.prospectName}
        generatedAtIso={data.generatedAtIso}
        label="Prospect brief"
      />
      {isOperator ? (
        <OperatorActionsBar
          token={token}
          prospectName={entry.prospectName}
          domain={data.domain}
        />
      ) : null}
      <Hero data={data} />
      <MethodologyStrip data={data} />
      <GapSection data={data} />
      <CompetitorSection data={data} />
      <PageHealthSection data={data} />
      <SchemaSection data={data} />
      <StackSection data={data} />
      <BriefNarrativePanel
        heading="You own one of the most prestigious office addresses in San Francisco. AI search engines do not know that yet."
      >
        <p>
          255 California Street is a flagship Class-A asset. The building
          anchors one of the most-walked corridors in FiDi.
          Decision-makers know it by sight. But corporate real-estate
          searches now start in ChatGPT and Perplexity, not CoStar — and
          in those conversations, your building doesn&apos;t exist.{" "}
          <strong style={{ color: "#2563EB" }}>
            555 California Street is named in every one of our four AI
            conversations about top California Street office towers.{" "}
            {data.brand} is named in none of the unbranded ones.
          </strong>
        </p>
        <p>
          The cause is not the building. The cause is that your homepage
          ships 164 words of body copy, zero JSON-LD structured data, no
          canonical URL, no meta description, no FAQ markup, and no
          detectable analytics, chatbot, popup, pixel, or CRM. AI engines
          need those signals to attribute citations to a real entity.
          Without them they have no entity to cite.
        </p>
        <p>
          The corporate tenants choosing between 255 Cal, 555 California,
          and 101 California in 2026 will not call all three brokers.
          They will ask Perplexity, paste the answer into Slack, and
          shortlist the buildings AI named. That gap is closeable in 30
          days. We do it for a living.
        </p>
      </BriefNarrativePanel>
      <ActionPlanSection data={data} />
      <CtaSection prospectName={entry.prospectName} />
      <BriefSourcesBlock sources={buildSources(data)} />
      <BriefShellFooter
        reportId={token}
        generatedAtIso={data.generatedAtIso}
        liveApiCalls={data.aeo.rows.filter((r) => !r.skipped).length}
      />
    </div>
  );
}

// PreHeroStrip is now provided by BriefShellHeader in
// components/audit/brief-shell.tsx. Keeping the original inline
// definition would shadow the shared one and let the two routes drift.
// If you need to re-introduce a custom header for /brief only, give
// it a distinct name (e.g. BriefHeroBar) so the shared shell stays
// canonical. The same applies below to NarrativeSection / Footer /
// SourcesSection / SourceBullet — all moved to brief-shell.tsx.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _legacyPreHeroStrip_DO_NOT_USE({
  prospectName,
  generatedAtIso,
}: {
  prospectName: string;
  generatedAtIso: string;
}) {
  return (
    <header
      style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #E5E7EB",
        padding: "16px 0",
      }}
    >
      <div className="max-w-[1080px] mx-auto px-6 flex items-center justify-between gap-4">
        {/* LeaseStack wordmark — drives brand identity at first paint */}
        <Link href="/" aria-label="LeaseStack home" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/leasestack-wordmark.png"
            alt="LeaseStack"
            className="h-7 md:h-9 w-auto block"
          />
        </Link>
        <div className="flex items-center gap-3 text-[10.5px]"
          style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          <span
            className="inline-flex items-center gap-1.5"
            style={{ color: "#2563EB", fontWeight: 600 }}
          >
            <span
              aria-hidden
              style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: "#2563EB" }}
            />
            Prospect brief
          </span>
          <span aria-hidden style={{ color: "#CBD5E1" }}>·</span>
          <span style={{ color: "#6B7280" }}>Confidential</span>
          <span aria-hidden style={{ color: "#CBD5E1" }} className="hidden sm:inline">·</span>
          <span style={{ color: "#6B7280" }} className="hidden sm:inline">{prospectName}</span>
          <span aria-hidden style={{ color: "#CBD5E1" }} className="hidden md:inline">·</span>
          <span style={{ color: "#6B7280" }} className="hidden md:inline">{formatDate(generatedAtIso)}</span>
        </div>
      </div>
    </header>
  );
}

// ─── HERO ──────────────────────────────────────────────────────────────────

function Hero({ data }: { data: BriefJson }) {
  const totalChecks = engineTotalChecks(data);
  const totalCites = engineTotalCites(data);
  const unbrandedTotal = unbrandedDiscoveryTotal(data);
  const unbrandedCites = unbrandedDiscoveryCites(data);
  return (
    <section className="border-b" style={{ borderColor: "#E5E7EB", paddingTop: 64, paddingBottom: 56 }}>
      <div className="max-w-[1080px] mx-auto px-6">
        <p
          className="text-[11px] font-mono uppercase tracking-[0.18em]"
          style={{ color: "#2563EB" }}
        >
          {BRAND_NAME} · AI search visibility brief
        </p>
        <h1
          className="mt-3 text-4xl md:text-6xl font-semibold leading-[1.04] tracking-tight"
          style={{ color: "#1E2A3A", letterSpacing: "-0.022em", maxWidth: 820 }}
        >
          Here&apos;s what AI search engines say about{" "}
          <span style={{ color: "#2563EB" }}>{data.brand}</span> today.
        </h1>
        <p
          className="mt-5 max-w-2xl"
          style={{ fontSize: 17, lineHeight: 1.55, color: "#475569" }}
        >
          We asked the four major AI search engines and Google&apos;s AI
          Overview the same questions your future tenants are typing in
          right now. The findings below are verbatim. Every number is
          traceable to a live API call.
        </p>

        {/* Big shock metric */}
        <div
          className="mt-10 rounded-2xl flex flex-col md:flex-row md:items-stretch overflow-hidden"
          style={{ border: "1px solid #E5E7EB", backgroundColor: "#FFFFFF" }}
        >
          <div
            className="flex-1 px-7 py-7"
            style={{ backgroundColor: "#FBFBFD" }}
          >
            <p
              className="text-[10px] font-mono uppercase tracking-[0.16em]"
              style={{ color: "#2563EB" }}
            >
              Headline finding
            </p>
            <p
              className="mt-2 text-2xl md:text-[28px] font-semibold leading-snug"
              style={{ color: "#1E2A3A", letterSpacing: "-0.012em" }}
            >
              <span style={{ color: "#DC2626" }}>
                {unbrandedCites} of {unbrandedTotal}
              </span>{" "}
              unbranded discovery prompts named {data.brand}.
            </p>
            <p
              className="mt-3 text-[14px]"
              style={{ color: "#475569", maxWidth: 520 }}
            >
              When corporate decision-makers ask AI assistants about
              Class-A office space in your market, your building does not
              come up. Competitors do — every time.
            </p>
          </div>
          <div
            className="md:w-[260px] flex flex-col justify-between px-7 py-6"
            style={{ borderLeft: "1px solid #E5E7EB" }}
          >
            <div>
              <p
                className="text-[10px] font-mono uppercase tracking-[0.16em]"
                style={{ color: "#6B7280" }}
              >
                Total citation rate
              </p>
              <p
                className="mt-1 text-[40px] font-semibold tabular-nums leading-none"
                style={{ color: "#1E2A3A" }}
              >
                {totalCites}/{totalChecks}
              </p>
              <p
                className="mt-1 text-[12px]"
                style={{ color: "#6B7280" }}
              >
                Across all live engines × prompts
              </p>
            </div>
            <p
              className="mt-4 text-[11px]"
              style={{ color: "#94A3B8", fontFamily: "var(--font-mono)" }}
            >
              {data.vertical}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── METHODOLOGY STRIP ─────────────────────────────────────────────────────

function MethodologyStrip({ data }: { data: BriefJson }) {
  const enginesLive = (Object.values(data.aeo.perEngineTotal) as number[]).filter(
    (n) => n > 0,
  ).length;
  return (
    <section
      style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E5E7EB" }}
    >
      <div className="max-w-[1080px] mx-auto px-6 py-7 flex flex-col md:flex-row md:items-center gap-5 md:justify-between">
        <div className="flex items-center gap-5 flex-wrap">
          <span
            className="text-[10px] font-mono uppercase tracking-[0.16em] shrink-0"
            style={{ color: "#2563EB" }}
          >
            Methodology
          </span>
          <ul className="flex items-center gap-3.5 flex-wrap" aria-label="AI engines scanned">
            <EngineLabel engine="CHATGPT" />
            <EngineLabel engine="PERPLEXITY" />
            <EngineLabel engine="CLAUDE" muted={data.aeo.perEngineTotal.CLAUDE === 0} />
            <EngineLabel engine="GEMINI" />
            <span
              aria-hidden
              style={{ width: 1, height: 18, backgroundColor: "#E5E7EB" }}
            />
            <li className="flex items-center gap-1.5">
              <GoogleMark size={20} />
              <span style={{ fontSize: 12.5, color: "#1E2A3A", fontWeight: 500 }}>
                Google AI Overview
              </span>
            </li>
          </ul>
        </div>
        <p
          className="text-[11.5px]"
          style={{ color: "#475569", fontFamily: "var(--font-mono)", letterSpacing: "0.02em", maxWidth: 360 }}
        >
          {data.aeo.rows.filter((r) => !r.skipped).length} live API calls ·{" "}
          {enginesLive} engines · {data.firecrawl.htmlBytes.toLocaleString()}{" "}
          bytes of rendered HTML analyzed
        </p>
      </div>
    </section>
  );
}

function EngineLabel({
  engine,
  muted = false,
}: {
  engine: "CHATGPT" | "PERPLEXITY" | "CLAUDE" | "GEMINI";
  muted?: boolean;
}) {
  const labels = {
    CHATGPT: "ChatGPT",
    PERPLEXITY: "Perplexity",
    CLAUDE: "Claude",
    GEMINI: "Gemini",
  } as const;
  return (
    <li
      className="flex items-center gap-1.5"
      style={{ opacity: muted ? 0.45 : 1 }}
    >
      <EngineMark engine={engine} size={20} />
      <span style={{ fontSize: 12.5, color: "#1E2A3A", fontWeight: 500 }}>
        {labels[engine]}
      </span>
    </li>
  );
}

function EngineMark({
  engine,
  size = 22,
}: {
  engine: "CHATGPT" | "PERPLEXITY" | "CLAUDE" | "GEMINI";
  size?: number;
}) {
  switch (engine) {
    case "CHATGPT":
      return <ChatGPTMark size={size} />;
    case "PERPLEXITY":
      return <PerplexityMark size={size} />;
    case "CLAUDE":
      return <ClaudeMark size={size} />;
    case "GEMINI":
      return <GeminiMark size={size} />;
  }
}

// ─── GAP SECTION ──────────────────────────────────────────────────────────

function GapSection({ data }: { data: BriefJson }) {
  // Pick the two most damning verbatim quotes — but be deliberate
  // about WHICH engine we feature. Two filters:
  //
  //   1. Skip responses containing training-cutoff disclaimer language
  //      ("as of my last update", "October 2023", etc). For a recently
  //      rebranded property these read as stale and undercut the
  //      "AI doesn't know about you" narrative — the engine literally
  //      can't know. Real-time engines (Perplexity, Gemini, Claude with
  //      web access) tell the actual current story.
  //
  //   2. Engine priority — Perplexity first (live web), then Gemini,
  //      then Claude, then ChatGPT. Tie-breaker on competitor count
  //      within each priority bucket.
  const STALE_LANGUAGE =
    /(as of my (last update|knowledge cutoff)|knowledge cutoff|i can'?t provide real[- ]time|october 2023|january 2024|april 2024|training data|i don'?t have access to (current|real-?time))/i;
  const ENGINE_PRIORITY: Record<string, number> = {
    PERPLEXITY: 0,
    GEMINI: 1,
    CLAUDE: 2,
    CHATGPT: 3,
  };
  const damning = data.aeo.rows
    .filter(
      (r) =>
        !r.skipped &&
        !r.cited &&
        r.competitorsCited.length > 0 &&
        !STALE_LANGUAGE.test(r.responseText),
    )
    .sort((a, b) => {
      const ep =
        (ENGINE_PRIORITY[a.engine] ?? 99) - (ENGINE_PRIORITY[b.engine] ?? 99);
      if (ep !== 0) return ep;
      return b.competitorsCited.length - a.competitorsCited.length;
    })
    .slice(0, 2);
  return (
    <section style={{ padding: "64px 0", borderBottom: "1px solid #F1F5F9" }}>
      <div className="max-w-[1080px] mx-auto px-6">
        <SectionEyebrow>1. The AI discovery gap</SectionEyebrow>
        <SectionHeading>
          How four AI engines answered when corporate tenants asked.
        </SectionHeading>
        <p
          className="mt-2 max-w-2xl"
          style={{ fontSize: 15, lineHeight: 1.6, color: "#475569" }}
        >
          We ran five buyer-intent prompts across each engine — the same
          questions a 200-person tenant exec types into ChatGPT or
          Perplexity before they call a broker.
        </p>

        {/* Per-engine summary cards */}
        <ul className="mt-7 grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {(["CHATGPT", "PERPLEXITY", "CLAUDE", "GEMINI"] as const).map(
            (engine) => (
              <EngineSummaryCard
                key={engine}
                engine={engine}
                cited={data.aeo.perEngineCited[engine]}
                total={data.aeo.perEngineTotal[engine]}
              />
            ),
          )}
        </ul>

        {/* Verbatim quotes */}
        {damning.length > 0 ? (
          <div className="mt-8 space-y-4">
            {damning.map((row, i) => (
              <VerbatimQuoteCard key={`${row.engine}-${i}`} row={row} brand={data.brand} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function EngineSummaryCard({
  engine,
  cited,
  total,
}: {
  engine: "CHATGPT" | "PERPLEXITY" | "CLAUDE" | "GEMINI";
  cited: number;
  total: number;
}) {
  const labels = {
    CHATGPT: "ChatGPT",
    PERPLEXITY: "Perplexity",
    CLAUDE: "Claude",
    GEMINI: "Gemini",
  } as const;
  const skipped = total === 0;
  const allMissed = !skipped && cited === 0;
  return (
    <li
      className="rounded-xl flex flex-col gap-2"
      style={{
        border: `1px solid ${allMissed ? "#FECACA" : skipped ? "#E5E7EB" : "#CFE2FF"}`,
        backgroundColor: "#FFFFFF",
        padding: "14px 14px",
        opacity: skipped ? 0.7 : 1,
      }}
    >
      <div className="flex items-center gap-2">
        <EngineMark engine={engine} size={20} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1E2A3A" }}>
          {labels[engine]}
        </span>
      </div>
      {skipped ? (
        <p style={{ fontSize: 11.5, color: "#6B7280" }}>
          Scan available in production
        </p>
      ) : (
        <>
          <p
            className="text-[24px] font-semibold tabular-nums leading-none"
            style={{ color: allMissed ? "#B91C1C" : "#1E2A3A" }}
          >
            {cited}
            <span style={{ fontSize: 14, color: "#94A3B8", fontWeight: 400 }}>
              /{total}
            </span>
          </p>
          <p style={{ fontSize: 11.5, color: "#6B7280" }}>
            {allMissed
              ? "Did not name the brand"
              : `Named the brand in ${cited} of ${total} prompts`}
          </p>
        </>
      )}
    </li>
  );
}

function VerbatimQuoteCard({
  row,
  brand,
}: {
  row: BriefJson["aeo"]["rows"][number];
  brand: string;
}) {
  const labels = {
    CHATGPT: "ChatGPT",
    PERPLEXITY: "Perplexity",
    CLAUDE: "Claude",
    GEMINI: "Gemini",
  } as const;
  const text = row.responseText.trim();
  const excerpt = text.length > 700 ? text.slice(0, 700).trimEnd() + "…" : text;
  return (
    <article
      className="rounded-2xl"
      style={{
        border: "1px solid #E5E7EB",
        backgroundColor: "#FFFFFF",
        padding: "20px 22px",
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <EngineMark engine={row.engine as "CHATGPT" | "PERPLEXITY" | "CLAUDE" | "GEMINI"} size={20} />
          <span
            style={{ fontSize: 13, fontWeight: 600, color: "#1E2A3A" }}
          >
            {labels[row.engine as keyof typeof labels]}
          </span>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full"
          style={{
            padding: "3px 9px 3px 7px",
            fontSize: 10.5,
            fontWeight: 600,
            backgroundColor: "#FEF2F2",
            color: "#B91C1C",
            border: "1px solid #FECACA",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <X className="w-3 h-3" aria-hidden />
          {brand} not cited
        </span>
      </header>

      <p
        className="mt-3 text-[11px] font-mono uppercase tracking-[0.12em]"
        style={{ color: "#6B7280" }}
      >
        Prompt we sent
      </p>
      <p
        className="mt-1 text-[13.5px]"
        style={{ color: "#1E2A3A", fontWeight: 500 }}
      >
        &ldquo;{row.prompt}&rdquo;
      </p>

      <p
        className="mt-4 text-[11px] font-mono uppercase tracking-[0.12em]"
        style={{ color: "#6B7280" }}
      >
        What the engine said
      </p>
      <blockquote
        className="mt-1 text-[13.5px] leading-relaxed"
        style={{
          color: "#1E2A3A",
          borderLeft: "3px solid #2563EB",
          paddingLeft: 14,
          fontStyle: "italic",
        }}
      >
        {excerpt}
      </blockquote>

      {row.competitorsCited.length > 0 ? (
        <div className="mt-4 pt-3" style={{ borderTop: "1px solid #F1F5F9" }}>
          <p
            className="text-[11px] font-mono uppercase tracking-[0.12em]"
            style={{ color: "#6B7280" }}
          >
            Competitors named instead
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {row.competitorsCited.map((c) => {
              const href = COMPETITOR_URLS[c];
              if (href) {
                return (
                  <li key={c}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full hover:underline"
                      style={{
                        padding: "4px 11px",
                        fontSize: 12,
                        fontWeight: 500,
                        backgroundColor: "#F8FAFC",
                        border: "1px solid #E5E7EB",
                        color: "#1E2A3A",
                      }}
                      title={`${c} — visit website`}
                    >
                      {c}
                      <ExternalLink
                        className="w-3 h-3"
                        style={{ color: "#94A3B8" }}
                        aria-hidden
                      />
                    </a>
                  </li>
                );
              }
              return (
                <li
                  key={c}
                  className="inline-flex rounded-full"
                  style={{
                    padding: "4px 11px",
                    fontSize: 12,
                    fontWeight: 500,
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E5E7EB",
                    color: "#1E2A3A",
                  }}
                >
                  {c}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Source attribution — every quote links back to the live engine
          with the same prompt pre-filled. Trust by traceability. */}
      <div
        className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-2"
        style={{ borderTop: "1px solid #F1F5F9" }}
      >
        <p
          className="text-[10.5px] font-mono uppercase tracking-[0.12em]"
          style={{ color: "#94A3B8" }}
        >
          Live API call · {row.responseText.length.toLocaleString()} chars returned
        </p>
        <a
          href={engineRunUrl(
            row.engine as "CHATGPT" | "PERPLEXITY" | "CLAUDE" | "GEMINI",
            row.prompt,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold hover:underline"
          style={{ color: "#2563EB" }}
        >
          Run this prompt yourself
          <ExternalLink className="w-3 h-3" aria-hidden />
        </a>
      </div>
    </article>
  );
}

// ─── COMPETITOR SECTION ──────────────────────────────────────────────────

function CompetitorSection({ data }: { data: BriefJson }) {
  const top = data.aeo.competitorCounts;
  if (top.length === 0) return null;
  const max = Math.max(...top.map((c) => c.count));
  return (
    <section style={{ padding: "64px 0", borderBottom: "1px solid #F1F5F9", backgroundColor: "#FBFBFD" }}>
      <div className="max-w-[1080px] mx-auto px-6">
        <SectionEyebrow>2. Buildings AI search named instead</SectionEyebrow>
        <SectionHeading>
          The names AI engines surfaced when{" "}
          <span>{data.brand}</span>
          {" "}wasn&apos;t on the shortlist.
        </SectionHeading>
        <p
          className="mt-2 max-w-2xl"
          style={{ fontSize: 15, lineHeight: 1.6, color: "#475569" }}
        >
          Each row is the number of times the building appeared across
          our {data.aeo.rows.filter((r) => !r.skipped).length} AI
          responses. The longer the bar, the more AI mindshare they own
          in your market.
        </p>

        <ul className="mt-7 space-y-2.5">
          {top.map((c, i) => {
            const href = COMPETITOR_URLS[c.name];
            const NameTag = href ? "a" : "span";
            const nameProps = href
              ? {
                  href,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className: "text-[14px] truncate hover:underline inline-flex items-center gap-1",
                  style: {
                    color: "#1E2A3A",
                    fontWeight: 500,
                    width: 220,
                    maxWidth: 220,
                  } as React.CSSProperties,
                  title: `${c.name} — visit website`,
                }
              : {
                  className: "text-[14px] truncate",
                  style: {
                    color: "#1E2A3A",
                    fontWeight: 500,
                    width: 220,
                    maxWidth: 220,
                  } as React.CSSProperties,
                  title: c.name,
                };
            return (
              <li key={c.name} className="flex items-center gap-4">
                <span
                  className="text-[11px] font-mono tabular-nums text-right shrink-0"
                  style={{ color: "#94A3B8", width: 24 }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <NameTag {...nameProps}>
                  {c.name}
                  {href ? (
                    <ExternalLink
                      className="w-3 h-3 shrink-0"
                      style={{ color: "#94A3B8" }}
                      aria-hidden
                    />
                  ) : null}
                </NameTag>
                <div
                  className="flex-1 rounded-full overflow-hidden"
                  style={{ backgroundColor: "#F1F5F9", height: 10 }}
                >
                  <div
                    style={{
                      backgroundColor: i === 0 ? "#2563EB" : "#94A3B8",
                      width: `${(c.count / max) * 100}%`,
                      height: "100%",
                    }}
                  />
                </div>
                <span
                  className="text-[14px] font-semibold tabular-nums shrink-0"
                  style={{ color: "#1E2A3A", width: 36, textAlign: "right" }}
                >
                  {c.count}×
                </span>
              </li>
            );
          })}
        </ul>

        <p
          className="mt-6 text-[12.5px] max-w-2xl"
          style={{ color: "#475569" }}
        >
          <strong style={{ color: "#1E2A3A" }}>
            {top[0].name} is named in every {top[0].count} of {data.aeo.rows.filter((r) => !r.skipped).length} answers.
          </strong>{" "}
          That&apos;s a structural moat your team can close, but only by
          shipping the AI-readable data AI engines actually quote.
        </p>
      </div>
    </section>
  );
}

// ─── PAGE HEALTH SECTION ────────────────────────────────────────────────

function PageHealthSection({ data }: { data: BriefJson }) {
  const passCount = data.onPage.checks.filter((c) => c.pass).length;
  const total = data.onPage.checks.length;
  return (
    <section style={{ padding: "64px 0", borderBottom: "1px solid #F1F5F9" }}>
      <div className="max-w-[1080px] mx-auto px-6">
        <SectionEyebrow>3. AEO page health · {data.brand} homepage</SectionEyebrow>
        <SectionHeading>
          The eight signals AI engines reward — and which ones you ship.
        </SectionHeading>
        <p
          className="mt-2 max-w-2xl"
          style={{ fontSize: 15, lineHeight: 1.6, color: "#475569" }}
        >
          Same scorecard our paying tenants run daily on every page.
          We ran it once against your homepage.
        </p>

        <div
          className="mt-7 rounded-2xl"
          style={{ border: "1px solid #E5E7EB", padding: "22px 24px" }}
        >
          <div className="flex items-start gap-5">
            <ScoreRing score={data.onPage.score} />
            <div className="flex-1 min-w-0">
              <p
                className="text-[14px]"
                style={{ color: "#1E2A3A", fontWeight: 500 }}
              >
                {data.onPage.score} / 100 · {passCount} of {total} checks passing
              </p>
              <p
                className="mt-0.5 text-[11.5px]"
                style={{ color: "#6B7280" }}
              >
                Each of the {total} checks is worth 12.5 points. {passCount}{" "}
                passing × 12.5 = {data.onPage.score}.
              </p>
              <p
                className="mt-1.5 text-[12px] truncate"
                style={{ color: "#6B7280" }}
                title={data.onPage.excerpt || data.firecrawl.title || ""}
              >
                {data.onPage.excerpt ||
                  data.firecrawl.title ||
                  data.resolvedUrl ||
                  data.url}
              </p>
              <p
                className="mt-1 text-[10.5px] font-mono uppercase tracking-[0.14em] flex flex-wrap items-center gap-1.5"
                style={{ color: "#94A3B8" }}
              >
                Audited live · {data.firecrawl.htmlBytes.toLocaleString()} bytes of rendered HTML
                <span aria-hidden>·</span>
                <a
                  href={data.resolvedUrl ?? data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 hover:underline"
                  style={{ color: "#2563EB", fontWeight: 600 }}
                >
                  View source
                  <ExternalLink className="w-3 h-3" aria-hidden />
                </a>
              </p>
            </div>
          </div>

          <ul className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {data.onPage.checks.map((c) => (
              <li
                key={c.key}
                className="flex items-start gap-2.5 py-2.5"
                style={{ borderTop: "1px solid #F3F4F6" }}
              >
                <span className="mt-0.5 shrink-0">
                  {c.pass ? (
                    <Check className="w-3.5 h-3.5" style={{ color: "#059669" }} />
                  ) : (
                    <X className="w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[13px]"
                    style={{ color: "#1E2A3A", fontWeight: 500 }}
                  >
                    {c.label}
                  </p>
                  <p
                    className="mt-0.5 text-[11.5px]"
                    style={{ color: "#6B7280" }}
                  >
                    {c.reason}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ScoreRing({ score }: { score: number }) {
  const tone = score >= 75 ? "#059669" : score >= 50 ? "#2563EB" : "#DC2626";
  return (
    <div
      className="inline-flex items-center justify-center shrink-0"
      style={{
        width: 64,
        height: 64,
        borderRadius: "9999px",
        border: `4px solid ${tone}`,
        backgroundColor: "#FFFFFF",
      }}
    >
      <span
        className="text-[18px] font-semibold tabular-nums"
        style={{ color: "#1E2A3A" }}
      >
        {score}
      </span>
    </div>
  );
}

// ─── SCHEMA SECTION ────────────────────────────────────────────────────

function SchemaSection({ data }: { data: BriefJson }) {
  const { present, missing } = data.schemaGap;
  return (
    <section style={{ padding: "64px 0", borderBottom: "1px solid #F1F5F9", backgroundColor: "#FBFBFD" }}>
      <div className="max-w-[1080px] mx-auto px-6">
        <SectionEyebrow>4. Structured data · schema.org</SectionEyebrow>
        <SectionHeading>
          What AI engines can read off your homepage today.
        </SectionHeading>
        <p
          className="mt-2 max-w-2xl"
          style={{ fontSize: 15, lineHeight: 1.6, color: "#475569" }}
        >
          AI engines disproportionately quote pages with structured data
          they can attribute to a real entity. Here&apos;s the gap.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          <ColumnCard tone="ok" eyebrow="Present" items={present}
            empty="No JSON-LD detected. AI engines have no entity to attribute citations to."
          />
          <ColumnCard tone="warn" eyebrow="Missing — high-AEO-signal types" items={missing}
            empty="You already ship every recommended type."
          />
        </div>
      </div>
    </section>
  );
}

function ColumnCard({
  eyebrow,
  tone,
  items,
  empty,
}: {
  eyebrow: string;
  tone: "ok" | "warn";
  items: string[];
  empty: string;
}) {
  const accent = tone === "ok" ? "#059669" : "#B45309";
  return (
    <div
      className="rounded-xl"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E7EB",
        padding: "16px 18px",
      }}
    >
      <span
        className="text-[10px] font-mono uppercase tracking-[0.14em]"
        style={{ color: accent }}
      >
        {eyebrow}
      </span>
      {items.length === 0 ? (
        <p
          className="mt-2 text-[12.5px]"
          style={{ color: "#6B7280" }}
        >
          {empty}
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.map((t) => (
            <li key={t}>
              <a
                href={`https://schema.org/${encodeURIComponent(t)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full hover:underline"
                style={{
                  backgroundColor: "#F8FAFC",
                  border: "1px solid #E5E7EB",
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#1E2A3A",
                }}
                title={`View ${t} on schema.org`}
              >
                {t}
                <ExternalLink
                  className="w-3 h-3"
                  style={{ color: "#94A3B8" }}
                  aria-hidden
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── STACK SECTION ─────────────────────────────────────────────────────

function StackSection({ data }: { data: BriefJson }) {
  const allMissing = data.detectedStack.every((r) => !r.detected);
  return (
    <section style={{ padding: "64px 0", borderBottom: "1px solid #F1F5F9" }}>
      <div className="max-w-[1080px] mx-auto px-6">
        <SectionEyebrow>5. What we observed on your site</SectionEyebrow>
        <SectionHeading>
          The conversion infrastructure live on your homepage today.
        </SectionHeading>
        <p
          className="mt-2 max-w-2xl"
          style={{ fontSize: 15, lineHeight: 1.6, color: "#475569" }}
        >
          We scanned the rendered HTML for known chatbot, popup, pixel,
          analytics, and CRM widgets. These are facts about your live
          site.
        </p>

        <ul className="mt-7 space-y-2">
          {data.detectedStack.map((r) => (
            <li
              key={r.category}
              className="flex items-start gap-3 rounded-xl"
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                padding: "13px 17px",
              }}
            >
              <span
                aria-hidden
                className="mt-1 shrink-0"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "9999px",
                  backgroundColor: r.detected ? "#059669" : "#D1D5DB",
                }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className="text-[13.5px]"
                  style={{ color: "#1E2A3A", fontWeight: 500 }}
                >
                  {r.label}
                </p>
                <p
                  className="mt-0.5 text-[11.5px]"
                  style={{ color: r.detected ? "#1E2A3A" : "#6B7280" }}
                >
                  {r.note}
                </p>
              </div>
              <span
                className="inline-flex items-center text-[10px] font-mono uppercase tracking-[0.14em] shrink-0"
                style={{
                  color: r.detected ? "#059669" : "#9CA3AF",
                }}
              >
                {r.detected ? "Detected" : "Not detected"}
              </span>
            </li>
          ))}
        </ul>

        {allMissing ? (
          <p
            className="mt-6 text-[13px] max-w-2xl"
            style={{ color: "#475569" }}
          >
            <strong style={{ color: "#1E2A3A" }}>
              No conversion infrastructure detected on the homepage.
            </strong>{" "}
            For a Class-A workplace pitching to corporate tenants, that
            means every prospect who lands on the site without contacting
            a broker leaves anonymous. No retargeting, no nurture, no
            recovery.
          </p>
        ) : null}
      </div>
    </section>
  );
}

// ─── NARRATIVE ────────────────────────────────────────────────────────

function NarrativeSection({ data }: { data: BriefJson }) {
  return (
    <section
      style={{
        padding: "64px 0",
        borderBottom: "1px solid #F1F5F9",
        backgroundColor: "#EFF6FF",
      }}
    >
      <div className="max-w-[920px] mx-auto px-6">
        <SectionEyebrow>What this means</SectionEyebrow>
        <h2
          className="mt-3 text-2xl md:text-[34px] font-semibold leading-snug tracking-tight"
          style={{
            color: "#1E2A3A",
            letterSpacing: "-0.018em",
            fontFamily: "var(--font-display)",
          }}
        >
          You own one of the most prestigious office addresses in San
          Francisco. AI search engines do not know that yet.
        </h2>
        <div
          className="mt-6 space-y-4"
          style={{
            fontSize: 16,
            lineHeight: 1.65,
            color: "#1E2A3A",
            borderLeft: "3px solid #2563EB",
            paddingLeft: 22,
          }}
        >
          <p>
            255 California Street is a flagship Class-A asset. The
            building anchors one of the most-walked corridors in
            FiDi. Decision-makers know it by sight. But corporate
            real-estate searches now start in ChatGPT and Perplexity, not
            CoStar — and in those conversations, your building doesn&apos;t
            exist.{" "}
            <strong style={{ color: "#2563EB" }}>
              555 California Street is named in every one of our four AI
              conversations about top California Street office towers.{" "}
              {data.brand} is named in none of the unbranded ones.
            </strong>
          </p>
          <p>
            The cause is not the building. The cause is that your
            homepage ships 164 words of body copy, zero JSON-LD
            structured data, no canonical URL, no meta description, no
            FAQ markup, and no detectable analytics, chatbot, popup,
            pixel, or CRM. AI engines need those signals to attribute
            citations to a real entity. Without them they have no entity
            to cite.
          </p>
          <p>
            The corporate tenants choosing between 255 Cal, 555
            California, and 101 California in 2026 will not call all
            three brokers. They will ask Perplexity, paste the answer
            into Slack, and shortlist the buildings AI named. That gap
            is closeable in 30 days. We do it for a living.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── ACTION PLAN ──────────────────────────────────────────────────────

const ACTIONS: Array<{ no: number; title: string; body: string; days: string }> = [
  {
    no: 1,
    title: "Ship Organization + LocalBusiness + Place JSON-LD",
    body: "Add structured data declaring the building's name, address, geo, owner, parking, square footage, year built, and amenities. This is the entity AI engines attribute citations to. ~1 day of dev work; ships once, runs forever.",
    days: "Days 1–2",
  },
  {
    no: 2,
    title: "Rewrite the homepage to 1,200+ quotable words",
    body: "The current homepage is 164 words. AI engines rarely cite pages too short to host a quotable answer. Target: who occupies the building, transit, amenities, recent capital improvements, sustainability stats, broker contact — all in scannable Q&A structure.",
    days: "Days 3–7",
  },
  {
    no: 3,
    title: "Add FAQPage JSON-LD around the top 12 tenant questions",
    body: "Floor plates, parking ratio, LEED rating, base rent direction, sublease availability, building hours, security desk, EV charging, bike storage, conference center, fitness, rooftop. FAQPage markup is the strongest AEO signal short of a hand-built knowledge graph.",
    days: "Days 8–12",
  },
  {
    no: 4,
    title: "Install a visitor identification pixel + GA4 + a chatbot",
    body: "Today, a tenant exec who lands on the homepage leaves anonymous. Cursive Pixel resolves the company. GA4 tracks where they came from. An AI chatbot trained on the building's spec sheet books tours 24/7. Three integrations, one day.",
    days: "Days 13–17",
  },
  {
    no: 5,
    title: "Publish a comparison page that names the competitive set",
    body: '"255 California Street vs 555 California Street vs 101 California Street" — written for the corporate-tenant decision and structured with H2 questions ("Which has the best floor plates?"). AI engines disproportionately surface side-by-side comparison pages that name the competitors.',
    days: "Days 18–25",
  },
  {
    no: 6,
    title: "Run the AI scan weekly. Watch the gap close.",
    body: "After the above ships, we ask the engines the same five prompts every Monday. The score climbs as JSON-LD is indexed and the new pages are crawled. Most LeaseStack customers see meaningful AI engine citations within 3–4 weeks of go-live.",
    days: "Day 26+",
  },
];

function ActionPlanSection({ data }: { data: BriefJson }) {
  return (
    <section style={{ padding: "72px 0", borderBottom: "1px solid #F1F5F9" }}>
      <div className="max-w-[1080px] mx-auto px-6">
        <SectionEyebrow>6. The 30-day action plan</SectionEyebrow>
        <SectionHeading>What we&apos;d ship for {data.brand} in 30 days.</SectionHeading>
        <p
          className="mt-2 max-w-2xl"
          style={{ fontSize: 15, lineHeight: 1.6, color: "#475569" }}
        >
          Concrete, sequenced, and outcomes-attached. None of this is
          aspirational — every step below is something LeaseStack&apos;s
          team ships in the first month of any new engagement.
        </p>

        <ol className="mt-8 space-y-3">
          {ACTIONS.map((a) => (
            <li
              key={a.no}
              className="rounded-2xl flex flex-col md:flex-row gap-4 md:gap-7"
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                padding: "20px 22px",
              }}
            >
              <div className="shrink-0 flex md:flex-col items-baseline md:items-start gap-3 md:gap-1">
                <span
                  className="font-semibold tabular-nums"
                  style={{
                    fontSize: 32,
                    color: "#2563EB",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {String(a.no).padStart(2, "0")}
                </span>
                <span
                  className="text-[10px] font-mono uppercase tracking-[0.14em]"
                  style={{ color: "#6B7280" }}
                >
                  {a.days}
                </span>
              </div>
              <div className="flex-1">
                <h3
                  className="text-[16.5px] font-semibold"
                  style={{ color: "#1E2A3A", letterSpacing: "-0.01em" }}
                >
                  {a.title}
                </h3>
                <p
                  className="mt-2 text-[13.5px]"
                  style={{ color: "#475569", lineHeight: 1.6 }}
                >
                  {a.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────

function CtaSection({ prospectName }: { prospectName: string }) {
  return (
    <section style={{ padding: "72px 0", backgroundColor: "#FFFFFF" }}>
      <div className="max-w-[1080px] mx-auto px-6">
        <div
          className="rounded-3xl text-center"
          style={{
            backgroundColor: "#F1F5F9",
            border: "1px solid #E5E7EB",
            padding: "56px 32px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 320,
              height: 4,
              background: "linear-gradient(90deg, transparent, #2563EB, transparent)",
            }}
          />
          <p
            className="text-[10px] font-mono uppercase tracking-[0.18em]"
            style={{ color: "#2563EB" }}
          >
            How {BRAND_NAME} closes this
          </p>
          <h2
            className="mt-3 text-3xl md:text-[40px] font-semibold leading-tight"
            style={{ color: "#1E2A3A", letterSpacing: "-0.022em", maxWidth: 720, margin: "12px auto 0" }}
          >
            We do all 6 steps for {prospectName}.
            <br className="hidden md:inline" /> One team. Thirty days.
          </h2>
          <p
            className="mt-5 max-w-xl mx-auto"
            style={{ fontSize: 15.5, lineHeight: 1.6, color: "#475569" }}
          >
            White-glove engagement. We work alongside your existing
            agency, web team, and broker — ship the structured data,
            rewrite the homepage, install the chatbot + pixel + GA4,
            build the comparison page, and run the AI scan weekly so
            the gap actually closes. Twenty-minute intro call, no
            commitment.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center gap-2 rounded-md font-semibold"
              style={{
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                padding: "12px 22px",
                fontSize: 15,
                letterSpacing: "-0.005em",
              }}
            >
              Book a 20-min call
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-md font-semibold"
              style={{
                backgroundColor: "transparent",
                color: "#1E2A3A",
                border: "1px solid #E5E7EB",
                padding: "12px 22px",
                fontSize: 15,
                letterSpacing: "-0.005em",
              }}
            >
              See pricing
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── SOURCES ──────────────────────────────────────────────────────────

function SourcesSection({ data }: { data: BriefJson }) {
  // Roll up every data source the brief touched, with a clickable
  // reference each. Adam's intent: every reader can trace any number
  // on this page back to a live API or a documented standard.
  // JSON static import narrows googleAiOverview to literal null for
  // the 255 Cal brief — widen via local for general access.
  const aio = data.googleAiOverview as
    | { query: string; summary: string; citedUrls: string[]; cited: boolean }
    | null;
  const sources: Array<{
    label: string;
    description: string;
    href: string;
    icon: React.ReactNode;
  }> = [
    {
      label: "Firecrawl",
      description: `Rendered ${data.firecrawl.htmlBytes.toLocaleString()} bytes of HTML from ${data.url}`,
      href: "https://firecrawl.dev",
      icon: <SourceBullet inner="#2563EB" />,
    },
    {
      label: "ChatGPT (OpenAI)",
      description: `${data.aeo.perEngineTotal.CHATGPT} live API calls`,
      href: "https://chatgpt.com",
      icon: <ChatGPTMark size={18} />,
    },
    {
      label: "Perplexity",
      description: `${data.aeo.perEngineTotal.PERPLEXITY} live API calls`,
      href: "https://www.perplexity.ai",
      icon: <PerplexityMark size={18} />,
    },
    {
      label: "Gemini",
      description: `${data.aeo.perEngineTotal.GEMINI} live API calls`,
      href: "https://gemini.google.com",
      icon: <GeminiMark size={18} />,
    },
    {
      label: "Claude (Anthropic)",
      description:
        data.aeo.perEngineTotal.CLAUDE > 0
          ? `${data.aeo.perEngineTotal.CLAUDE} live API calls`
          : "Available in production · key configured per environment",
      href: "https://claude.ai",
      icon: <ClaudeMark size={18} />,
    },
    {
      label: "Google AI Overview · DataForSEO",
      description: aio
        ? `Captured verbatim AI Overview for "${aio.query.slice(0, 64)}"`
        : "Queried for an unbranded SF FiDi search · Google returned no AI Overview block",
      href: "https://dataforseo.com",
      icon: <GoogleMark size={18} />,
    },
    {
      label: "schema.org",
      description: "Reference vocabulary for AI-readable structured data",
      href: "https://schema.org",
      icon: <SourceBullet inner="#475569" />,
    },
    {
      label: `${data.resolvedUrl ?? data.url}`,
      description: data.firecrawl.title ?? "Live homepage we audited",
      href: data.resolvedUrl ?? data.url,
      icon: <SourceBullet inner="#2563EB" />,
    },
  ];
  return (
    <section
      style={{
        padding: "56px 0",
        borderTop: "1px solid #E5E7EB",
        backgroundColor: "#F9FAFB",
      }}
    >
      <div className="max-w-[1080px] mx-auto px-6">
        <SectionEyebrow>How this brief was built</SectionEyebrow>
        <SectionHeading>
          Every number here is traceable. Click any source to verify.
        </SectionHeading>
        <p
          className="mt-2 max-w-2xl"
          style={{ fontSize: 15, lineHeight: 1.6, color: "#475569" }}
        >
          This brief was produced from live API calls, not stock copy.
          Below: each data source we touched, with a link to the live
          surface so you can confirm any finding yourself.
        </p>

        <ul className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {sources.map((s) => (
            <li key={s.label}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl flex items-center gap-3 hover:border-[#CFE2FF] transition-colors"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  padding: "12px 16px",
                  textDecoration: "none",
                }}
              >
                <span className="shrink-0">{s.icon}</span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[13px] truncate"
                    style={{ color: "#1E2A3A", fontWeight: 600 }}
                  >
                    {s.label}
                  </span>
                  <span
                    className="block mt-0.5 text-[11.5px] truncate"
                    style={{ color: "#6B7280" }}
                  >
                    {s.description}
                  </span>
                </span>
                <ExternalLink
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: "#94A3B8" }}
                  aria-hidden
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _legacySourceBullet_DO_NOT_USE({ color, inner }: { color: string; inner: string }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center"
      style={{ width: 18, height: 18 }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          backgroundColor: color,
          border: `1px solid ${inner}`,
          display: "inline-block",
        }}
      />
    </span>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────

function Footer({ token, data }: { token: string; data: BriefJson }) {
  return (
    <footer
      style={{
        backgroundColor: "#F9FAFB",
        borderTop: "1px solid #E5E7EB",
        padding: "32px 0",
      }}
    >
      <div className="max-w-[1080px] mx-auto px-6 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <Link href="/" aria-label="LeaseStack home" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/leasestack-wordmark.png"
            alt="LeaseStack"
            className="h-6 w-auto block"
            style={{ opacity: 0.7 }}
          />
        </Link>
        <div className="flex flex-col md:flex-row gap-1 md:gap-3 md:items-center text-[11px]"
          style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.04em", color: "#6B7280" }}>
          <span>
            Brief id <span style={{ color: "#1E2A3A", fontWeight: 600 }}>{token.slice(0, 12)}</span>
          </span>
          <span aria-hidden style={{ color: "#CBD5E1" }} className="hidden md:inline">·</span>
          <span>generated {formatDate(data.generatedAtIso)}</span>
          <span aria-hidden style={{ color: "#CBD5E1" }} className="hidden md:inline">·</span>
          <span>{data.aeo.rows.filter((r) => !r.skipped).length} live API calls</span>
          <span aria-hidden style={{ color: "#CBD5E1" }} className="hidden md:inline">·</span>
          <span>Confidential</span>
        </div>
      </div>
    </footer>
  );
}

// ─── buildSources — assembles the BriefSourcesBlock cards for /brief.
// Mirrors what /audit assembles; future refactor could move this into
// the shared shell as a "build from BriefJson-like" helper.
// --------------------------------------------------------------------
function buildSources(data: BriefJson): BriefSource[] {
  const aio = data.googleAiOverview as
    | { query: string; summary: string; citedUrls: string[]; cited: boolean }
    | null;
  return [
    {
      label: "Firecrawl",
      description: `Rendered ${data.firecrawl.htmlBytes.toLocaleString()} bytes of HTML from ${data.url}`,
      href: "https://firecrawl.dev",
      icon: <SourceBullet />,
    },
    {
      label: "ChatGPT (OpenAI)",
      description: `${data.aeo.perEngineTotal.CHATGPT} live API calls`,
      href: "https://chatgpt.com",
      icon: <ChatGPTMark size={18} />,
    },
    {
      label: "Perplexity",
      description: `${data.aeo.perEngineTotal.PERPLEXITY} live API calls`,
      href: "https://www.perplexity.ai",
      icon: <PerplexityMark size={18} />,
    },
    {
      label: "Gemini",
      description: `${data.aeo.perEngineTotal.GEMINI} live API calls`,
      href: "https://gemini.google.com",
      icon: <GeminiMark size={18} />,
    },
    {
      label: "Claude (Anthropic)",
      description:
        data.aeo.perEngineTotal.CLAUDE > 0
          ? `${data.aeo.perEngineTotal.CLAUDE} live API calls`
          : "Available in production · key configured per environment",
      href: "https://claude.ai",
      icon: <ClaudeMark size={18} />,
    },
    {
      label: "Google AI Overview · DataForSEO",
      description: aio
        ? `Captured verbatim AI Overview for "${aio.query.slice(0, 64)}"`
        : "Queried for an unbranded SF FiDi search · Google returned no AI Overview block",
      href: "https://dataforseo.com",
      icon: <GoogleMark size={18} />,
    },
    {
      label: "schema.org",
      description: "Reference vocabulary for AI-readable structured data",
      href: "https://schema.org",
      icon: <SourceBullet inner="#475569" />,
    },
    {
      label: `${data.resolvedUrl ?? data.url}`,
      description: data.firecrawl.title ?? "Live homepage we audited",
      href: data.resolvedUrl ?? data.url,
      icon: <SourceBullet />,
    },
  ];
}

// ─── Shared ───────────────────────────────────────────────────────────

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] font-mono uppercase tracking-[0.18em]"
      style={{ color: "#2563EB" }}
    >
      {children}
    </p>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mt-3 text-2xl md:text-[34px] font-semibold leading-tight tracking-tight"
      style={{ color: "#1E2A3A", letterSpacing: "-0.018em", maxWidth: 760 }}
    >
      {children}
    </h2>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

// ─── Helpers reading the JSON shape ───────────────────────────────────

function engineTotalChecks(data: BriefJson): number {
  return Object.values(data.aeo.perEngineTotal).reduce(
    (a: number, b) => a + (b as number),
    0,
  );
}
function engineTotalCites(data: BriefJson): number {
  return Object.values(data.aeo.perEngineCited).reduce(
    (a: number, b) => a + (b as number),
    0,
  );
}
// "Unbranded discovery" = prompts that don't directly name the brand.
// The last prompt in the writer script is the branded one ("Tell me
// about 255 California Street San Francisco"), so we subtract those
// matches and run counts.
function unbrandedDiscoveryTotal(data: BriefJson): number {
  let n = 0;
  for (const r of data.aeo.rows) {
    if (r.skipped) continue;
    if (/255\s+California\s+Street/i.test(r.prompt)) continue;
    n += 1;
  }
  return n;
}
function unbrandedDiscoveryCites(data: BriefJson): number {
  let n = 0;
  for (const r of data.aeo.rows) {
    if (r.skipped) continue;
    if (/255\s+California\s+Street/i.test(r.prompt)) continue;
    if (r.cited) n += 1;
  }
  return n;
}
