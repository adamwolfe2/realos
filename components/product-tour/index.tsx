"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LEADS,
  CONVERSATIONS,
  PROPERTIES,
  CREATIVE_REQUESTS,
  AD_CHANNELS,
  WEEK_BARS,
  ACTIVITY,
  BRIEFING,
  VISITORS,
  VISITOR_STATS,
  SEO_QUERIES,
  SEO_TREND,
  type LeadRow,
  type LeadStage,
  type LeadSource,
  type CreativeStatus,
  type Visitor,
} from "./data";
import { TOKENS, Icons, Pill, ScoreBadge, Tile, SectionHeader } from "./shared";
import { LiveTicker } from "@/components/platform/live-ticker";
// Real LeaseStack product components — using the same primitives the live
// portal uses so the demo and the product are visually identical.
import { LeadSourceDonut } from "@/components/portal/dashboard/lead-source-donut";
import { ConversionFunnel } from "@/components/portal/dashboard/conversion-funnel";

// ---------------------------------------------------------------------------
// ProductTour
// A fully interactive CRM preview. Click the sidebar to swap views. Each
// view is a self-contained working surface with real-feeling data, filters,
// buttons, and drawers. No network calls; everything is local state.
//
// Views:
//   Dashboard    - top-level KPIs + activity feed + quick actions
//   Leads        - kanban with detail drawer, filters, search, pipeline
//   Conversations- chatbot inbox, two-column transcript view
//   Creative     - studio queue, status filters, "new request" modal
//   Campaigns    - per-channel ad performance with budget progress
//   Properties   - portfolio list with occupancy + leads + revenue
//   Reports      - stacked bar chart + weekly KPIs + download
//   Settings     - integration status + domain + pixel + billing
//
// Design: Claude-inspired (parchment + terracotta + warm neutrals, ring
// shadows, Fraunces for display, Inter for UI).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Animation primitives — kept inline so the demo doesn't pull in framer for
// just two surfaces. CountUp drives the KPI ticker on period switch; the
// dual-axis SVG chart down at SeoView uses the same easing for path draw-in.
// ---------------------------------------------------------------------------

/** Eases a value from a previous integer to a target integer over `ms`,
 *  re-rendering at requestAnimationFrame cadence. Idle when start===target. */
function useCountUp(target: number, ms = 600): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (target === fromRef.current) return;
    const from = value;
    fromRef.current = target;
    startRef.current = null;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // cubic-out
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / ms);
      const v = Math.round(from + (target - from) * ease(t));
      setValue(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ms]);
  return value;
}

type ViewKey =
  | "briefing"
  | "dashboard"
  | "leads"
  | "visitors"
  | "conversations"
  | "creative"
  | "campaigns"
  | "seo"
  | "properties"
  | "reports"
  | "settings";

// Norman brief (2026-05-28): removed Creative + Reports tabs from the
// preview. Creative implied agency services LeaseStack doesn't provide;
// Reports was sparse and made the platform look small. Renamed
// Conversations → Chatbot. The view keys / functions are kept in code
// so they can be re-mounted later without restructuring.
const VIEWS: Array<{ key: ViewKey; label: string; short: string; icon: keyof typeof Icons; count?: number }> = [
  { key: "briefing",      label: "Briefing",      short: "Brief",  icon: "briefing" },
  { key: "dashboard",     label: "Dashboard",     short: "Dash",   icon: "dashboard" },
  { key: "leads",         label: "Leads",         short: "Leads",  icon: "leads",       count: 42 },
  { key: "visitors",      label: "Visitors",      short: "Pixel",  icon: "visitors",    count: 312 },
  { key: "conversations", label: "Chatbot",       short: "Chat",   icon: "chat",        count: 6  },
  { key: "campaigns",     label: "Campaigns",     short: "Ads",    icon: "campaigns" },
  { key: "seo",           label: "SEO",           short: "SEO",    icon: "seo" },
  { key: "properties",    label: "Properties",    short: "Props",  icon: "properties",  count: 4  },
  { key: "settings",      label: "Settings",      short: "Config", icon: "settings" },
];

export function ProductTour() {
  const [view, setView] = useState<ViewKey>("dashboard");

  return (
    <div
      className="w-full overflow-hidden relative"
      style={{
        backgroundColor: TOKENS.ivory,
        borderRadius: "24px",
        boxShadow:
          `0 0 0 1px ${TOKENS.borderCream}, 0 20px 60px rgba(0,0,0,0.06)`,
      }}
    >
      <Topbar />
      <MobileTabBar active={view} onSelect={setView} />
      {/* All tabs render in a fixed-height viewport so switching views
          doesn't jump the page. Each view is sized to fit inside this
          window without internal scroll — Dashboard was compressed
          (single-row KPIs, Properties row dropped) so it earns its
          place at the same height as Leads/Visitors/Creative/etc. */}
      <div
        className="flex"
        style={{ backgroundColor: TOKENS.ivory, height: 640 }}
      >
        <Sidebar active={view} onSelect={setView} />
        <div
          className="flex-1 min-w-0 overflow-hidden"
          style={{ backgroundColor: TOKENS.parchment }}
        >
          <Contents view={view} />
        </div>
      </div>
      <LiveTicker variant="absolute" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top bar - workspace switcher + search + bell + avatar
// ---------------------------------------------------------------------------

function Topbar() {
  return (
    <div
      className="flex items-center gap-3 px-4 md:px-6 h-14"
      style={{
        backgroundColor: TOKENS.ivory,
        borderBottom: `1px solid ${TOKENS.borderCream}`,
      }}
    >
      <div className="flex items-center gap-3">
        <img
          src="/logos/leasestack-wordmark.png"
          alt="LeaseStack"
          style={{ height: "22px", width: "auto", display: "block" }}
        />
        <span
          className="inline-block"
          style={{
            width: "1px",
            height: "18px",
            backgroundColor: TOKENS.borderCream,
          }}
        />
        <span
          style={{
            color: TOKENS.nearBlack,
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            fontSize: "14px",
          }}
        >
          Sample Portfolio
        </span>
        <Icons.chevronDown color={TOKENS.stone} />
      </div>

      <div className="flex-1" />

      <div
        className="hidden sm:flex items-center gap-2 px-3 py-1.5"
        style={{
          backgroundColor: TOKENS.white,
          borderRadius: "10px",
          boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
          width: "260px",
        }}
      >
        <Icons.search color={TOKENS.stone} />
        <input
          type="search"
          placeholder="Search leads, tours, creative..."
          className="bg-transparent outline-none w-full"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: TOKENS.nearBlack,
          }}
          readOnly
        />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: TOKENS.stone,
            padding: "1px 5px",
            border: `1px solid ${TOKENS.borderCream}`,
            borderRadius: "4px",
          }}
        >
          /
        </span>
      </div>

      <button
        type="button"
        aria-label="Notifications"
        className="relative inline-flex items-center justify-center rounded-md"
        style={{
          width: "36px",
          height: "36px",
          color: TOKENS.charcoal,
        }}
      >
        <Icons.bell color={TOKENS.charcoal} />
        <span
          className="absolute top-2 right-2 rounded-full"
          style={{
            width: "6px",
            height: "6px",
            backgroundColor: TOKENS.terracotta,
          }}
        />
      </button>

      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center rounded-full"
          style={{
            width: "28px",
            height: "28px",
            backgroundColor: TOKENS.sand,
            color: TOKENS.charcoal,
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            fontWeight: 600,
          }}
        >
          JD
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile tab bar - icon-only horizontal scroll strip, hidden on md+
// ---------------------------------------------------------------------------

function MobileTabBar({
  active,
  onSelect,
}: {
  active: ViewKey;
  onSelect: (v: ViewKey) => void;
}) {
  return (
    <div
      className="md:hidden flex items-center px-1 py-1"
      style={{
        backgroundColor: TOKENS.ivory,
        borderBottom: `1px solid ${TOKENS.borderCream}`,
      }}
    >
      {VIEWS.map((v) => {
        const isActive = v.key === active;
        const Icon = Icons[v.icon];
        return (
          <button
            key={v.key}
            type="button"
            onClick={() => onSelect(v.key)}
            title={v.label}
            className="relative flex-1 inline-flex flex-col items-center justify-center gap-0.5"
            style={{
              height: "44px",
              borderRadius: "8px",
              backgroundColor: isActive ? TOKENS.sand : "transparent",
              color: isActive ? TOKENS.nearBlack : TOKENS.charcoal,
              cursor: "pointer",
              transition: "background-color 0.2s ease",
            }}
          >
            <Icon size={15} color={isActive ? TOKENS.terracotta : TOKENS.olive} />
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "8px",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? TOKENS.nearBlack : TOKENS.stone,
                lineHeight: 1,
              }}
            >
              {v.short}
            </span>
            {typeof v.count === "number" ? (
              <span
                style={{
                  position: "absolute",
                  top: "4px",
                  right: "2px",
                  width: "13px",
                  height: "13px",
                  borderRadius: "50%",
                  backgroundColor: TOKENS.terracotta,
                  color: TOKENS.ivory,
                  fontFamily: "var(--font-mono)",
                  fontSize: "7px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {v.count > 9 ? "9+" : v.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar - nav items, counts, and a "Book tour" CTA at the bottom
// ---------------------------------------------------------------------------

function Sidebar({
  active,
  onSelect,
}: {
  active: ViewKey;
  onSelect: (v: ViewKey) => void;
}) {
  return (
    <nav
      className="hidden md:flex flex-col"
      aria-label="Product tour navigation"
      style={{
        width: "220px",
        flexShrink: 0,
        backgroundColor: TOKENS.ivory,
        borderRight: `1px solid ${TOKENS.borderCream}`,
        padding: "16px 10px",
      }}
    >
      <ul className="space-y-1">
        {VIEWS.map((v) => {
          const isActive = v.key === active;
          const Icon = Icons[v.icon];
          return (
            <li key={v.key}>
              <button
                type="button"
                onClick={() => onSelect(v.key)}
                className="w-full inline-flex items-center gap-3 px-3"
                style={{
                  height: "36px",
                  borderRadius: "10px",
                  backgroundColor: isActive ? TOKENS.sand : "transparent",
                  color: isActive ? TOKENS.nearBlack : TOKENS.charcoal,
                  fontFamily: "var(--font-sans)",
                  fontSize: "13.5px",
                  fontWeight: isActive ? 500 : 400,
                  transition: "background-color 0.2s ease, color 0.2s ease",
                  cursor: "pointer",
                }}
              >
                <Icon size={16} color={isActive ? TOKENS.terracotta : TOKENS.olive} />
                <span className="flex-1 text-left">{v.label}</span>
                {typeof v.count === "number" ? (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10.5px",
                      color: TOKENS.stone,
                      backgroundColor: isActive ? TOKENS.white : "transparent",
                      padding: "1px 6px",
                      borderRadius: "999px",
                      border: `1px solid ${TOKENS.borderCream}`,
                    }}
                  >
                    {v.count}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex-1" />

      <div
        className="mt-6 p-3"
        style={{
          backgroundColor: TOKENS.white,
          borderRadius: "12px",
          boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: TOKENS.stone,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Tour mode
        </p>
        <p
          className="mt-1.5"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            color: TOKENS.olive,
            lineHeight: 1.5,
          }}
        >
          Click any sidebar item to explore the real portal surface.
        </p>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Content router
// ---------------------------------------------------------------------------

function Contents({ view }: { view: ViewKey }) {
  return (
    <div className="p-3 md:p-8 text-[13px] md:text-base">
      {view === "briefing" && <BriefingView />}
      {view === "dashboard" && <Dashboard />}
      {view === "leads" && <LeadsView />}
      {view === "visitors" && <VisitorsView />}
      {view === "conversations" && <ConversationsView />}
      {view === "creative" && <CreativeView />}
      {view === "campaigns" && <CampaignsView />}
      {view === "seo" && <SeoView />}
      {view === "properties" && <PropertiesView />}
      {view === "reports" && <ReportsView />}
      {view === "settings" && <SettingsView />}
    </div>
  );
}

// ===========================================================================
// 1. DASHBOARD
// ===========================================================================

// Monochromatic blue ramp — every category slice stays on-brand instead of
// reaching for orange / green / yellow. Order: darkest at the top (Chat,
// the biggest slice) → palest at the bottom (Referral, the smallest).
// Same ramp the real LeaseStack `LeadSourceDonut` palette uses.
const LEAD_SOURCES: Array<{ label: string; pct: number; color: string }> = [
  { label: "Chat",     pct: 32, color: "#1E40AF" }, // blue-800
  { label: "Paid",     pct: 26, color: "#2563EB" }, // blue-600 (brand)
  { label: "Pixel",    pct: 18, color: "#3B82F6" }, // blue-500
  { label: "Form",     pct: 14, color: "#60A5FA" }, // blue-400
  { label: "Referral", pct: 10, color: "#93C5FD" }, // blue-300
];

const FUNNEL: Array<{ label: string; count: number }> = [
  { label: "Visitors", count: 12480 },
  { label: "Leads",    count: 168   },
  { label: "Tours",    count: 31    },
  { label: "Applied",  count: 11    },
  { label: "Signed",   count: 4     },
];

// Local conic-gradient donut removed — the dashboard now uses the real
// product's <LeadSourceDonut /> (recharts) imported at the top of this
// file so the demo and the live portal render the same primitive.

function MiniPropStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          color: TOKENS.stone,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </p>
      <p
        className="mt-0.5"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "15px",
          fontWeight: 500,
          color: TOKENS.nearBlack,
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function Dashboard() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");
  const multiplier = period === "7d" ? 1 : period === "30d" ? 4.2 : 12.5;

  // Numeric targets ride through useCountUp so flipping 7d / 30d / 90d
  // smoothly ramps each KPI to its new value rather than snapping.
  // Avg cost per tour stays as a constant string — period switch
  // doesn't change unit economics.
  const leadsTarget = Math.round(168 * multiplier);
  const toursTarget = Math.round(31 * multiplier);
  const leasesTarget = Math.round(4 * multiplier);
  const leadsAnim = useCountUp(leadsTarget);
  const toursAnim = useCountUp(toursTarget);
  const leasesAnim = useCountUp(leasesTarget);
  const kpis = [
    { label: "Leads this period",  value: leadsAnim.toLocaleString(),  delta: "+12%" },
    { label: "Tours booked",       value: toursAnim.toLocaleString(),  delta: "+4%"  },
    { label: "Signed leases",      value: leasesAnim.toLocaleString(), delta: "+1"   },
    { label: "Avg cost per tour",  value: "$122",                       delta: "-8%"  },
  ];

  return (
    <div>
      {/* Featured-property strip — mirrors the live /portal hero banner
          we ship to real operators. Building image floats above a soft
          brand wash + 28px grid texture (same vocabulary as the
          marketing hero) with the property identity + 3 headline stats
          right next to it. Replaces the previous flat "Good afternoon,
          Sample Portfolio" greeting so the dashboard reads as a real
          product surface instead of a placeholder. */}
      <FeaturedPropertyStrip period={period} onPeriodChange={setPeriod} />

      {/* KPIs — single row of 4 on desktop (was 2×2) so the dashboard
          fits within the fixed 640px viewport. Mobile keeps the 2×2
          stack since it has the vertical room. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="ls-kpi-card"
            style={{
              backgroundColor: TOKENS.white,
              borderRadius: "14px",
              padding: "14px 16px",
              boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
              transition:
                "transform 200ms cubic-bezier(0.22,1,0.36,1), box-shadow 200ms cubic-bezier(0.22,1,0.36,1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = `0 0 0 1px ${TOKENS.borderCream}, 0 12px 28px rgba(37,99,235,0.10)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = `0 0 0 1px ${TOKENS.borderCream}`;
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "11.5px",
                color: TOKENS.stone,
                lineHeight: 1.3,
              }}
            >
              {k.label}
            </p>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(18px, 3.4vw, 24px)",
                  fontWeight: 500,
                  color: TOKENS.nearBlack,
                  lineHeight: 1.1,
                }}
              >
                {k.value}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10.5px",
                  color: k.delta.startsWith("-") ? TOKENS.error : TOKENS.success,
                  fontWeight: 500,
                }}
              >
                {k.delta}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <SectionHeader title="Leads by source (last 7 days)" />
          <Tile>
            <div className="p-5">
              {/* Real-product LeadSourceDonut (recharts) — same component
                  that renders on the live portal dashboard. Slices map to
                  the demo's LEAD_SOURCES configuration so the legend / pct
                  stay in sync with the marketing copy. */}
              <LeadSourceDonut
                slices={LEAD_SOURCES.map((s) => ({
                  source: s.label,
                  // Counts approximate the percentages × the donut center
                  // total (168) so legend counts read as plausible.
                  count: Math.round((s.pct / 100) * 168),
                  color: s.color,
                }))}
              />
            </div>
          </Tile>
        </div>

        <div>
          <SectionHeader title="Conversion funnel (week)" />
          <Tile>
            <div className="p-5">
              {/* Real-product ConversionFunnel — same stage bars the live
                  dashboard renders, with monochromatic blue weights and
                  computed step-by-step conversion percentages. */}
              <ConversionFunnel
                stages={FUNNEL.map((s) => ({ label: s.label, value: s.count }))}
              />
            </div>
          </Tile>
        </div>
      </div>

      {/* Properties row removed from the dashboard — Properties has
          its own dedicated tab in the sidebar, so duplicating the
          three-card row here just made the dashboard overflow the
          fixed viewport. Operators reach Properties via the sidebar. */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <SectionHeader title="Activity" />
          <Tile>
            <ul>
              {ACTIVITY.slice(0, 4).map((a, i, arr) => (
                <li
                  key={i}
                  className="flex items-center gap-3 px-5 py-2.5"
                  style={{
                    borderBottom:
                      i < arr.length - 1 ? `1px solid ${TOKENS.borderCream}` : "none",
                  }}
                >
                  <ActivityDot kind={a.kind} />
                  <p
                    className="flex-1"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13px",
                      color: TOKENS.charcoal,
                      lineHeight: 1.4,
                    }}
                  >
                    {a.text}
                  </p>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      color: TOKENS.stone,
                    }}
                  >
                    {a.at}
                  </span>
                </li>
              ))}
            </ul>
          </Tile>
        </div>

        <div>
          <SectionHeader title="Quick actions" />
          <div className="space-y-2">
            <QuickAction
              label="Download weekly report"
              hint="PDF, goes to owner and operator"
              terracotta
            />
            <QuickAction
              label="Invite a teammate"
              hint="Leasing agents, owners, asset managers"
            />
            <QuickAction
              label="Connect another property"
              hint="Up and running inside 14 days"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FeaturedPropertyStrip — compact featured-property hero used at the top
// of the product-tour Dashboard view. Mirrors the live PropertyHeroBanner
// component we ship on /portal so the demo and the real product share
// the same opening visual.
//
// Layout (single ~120px row in the fixed 640px demo viewport):
//
//   ┌─────────────────────────────────────────────────────────────────┐
//   │ [bldg]  FEATURED PROPERTY · TELEGRAPH COMMONS    [7d 30d 90d]   │
//   │ [img ]  Berkeley · Student housing                              │
//   │         168 leads · 99 walk · 4.6★                              │
//   └─────────────────────────────────────────────────────────────────┘
//
// Building "image" is a CSS gradient block — the marketing site can
// swap in an actual photo later without restructuring this strip.
// ---------------------------------------------------------------------------
function FeaturedPropertyStrip({
  period,
  onPeriodChange,
}: {
  period: "7d" | "30d" | "90d";
  onPeriodChange: (v: "7d" | "30d" | "90d") => void;
}) {
  const accentRgb = "37, 99, 235";
  return (
    <section
      className="relative overflow-hidden rounded-2xl mb-3"
      style={{
        padding: "14px 18px",
        background: `
          radial-gradient(ellipse 70% 90% at 12% 10%, rgba(${accentRgb}, 0.18), transparent 65%),
          radial-gradient(ellipse 60% 80% at 95% 100%, rgba(${accentRgb}, 0.10), transparent 65%),
          linear-gradient(180deg, #F7F9FF 0%, #FFFFFF 80%)
        `,
        boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
      }}
    >
      {/* 28px brand grid texture, masked so it never reaches the edges. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(0deg, rgba(${accentRgb}, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(${accentRgb}, 0.05) 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
          WebkitMaskImage:
            "radial-gradient(ellipse 110% 95% at 30% 50%, #000 70%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 110% 95% at 30% 50%, #000 70%, transparent 100%)",
        }}
      />

      <div className="relative flex items-center gap-4">
        {/* Building "photo" — soft brand-gradient block with a building
            silhouette overlay. Reads as a placeholder for the operator's
            uploaded photo without committing to a specific image. Ground
            shadow underneath gives the 3D "floating" feel that matches
            the live PropertyHeroBanner. */}
        <div className="relative shrink-0">
          <div
            aria-hidden="true"
            className="absolute left-1/2 -translate-x-1/2 bottom-[-6px]"
            style={{
              width: "84%",
              height: 8,
              background:
                "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(15,23,42,0.25), transparent 70%)",
              filter: "blur(4px)",
            }}
          />
          <div
            className="relative grid place-items-center"
            style={{
              width: 76,
              height: 76,
              borderRadius: 12,
              background:
                "linear-gradient(135deg, #2563EB 0%, #60A5FA 60%, #93C5FD 100%)",
              boxShadow:
                "0 10px 18px rgba(15,23,42,0.18), 0 2px 4px rgba(15,23,42,0.08)",
              color: "#ffffff",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 21V8l9-5 9 5v13M9 21v-6h6v6M9 12h.01M15 12h.01"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Identity column */}
        <div className="min-w-0 flex-1">
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9.5px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#2563EB",
              fontWeight: 600,
            }}
          >
            Featured property
          </p>
          <h1
            className="mt-0.5"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(16px, 3.4vw, 22px)",
              fontWeight: 500,
              color: TOKENS.nearBlack,
              lineHeight: 1.05,
              letterSpacing: "-0.018em",
            }}
          >
            Telegraph Commons
          </h1>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <HeroStat label="Leads · 28d" value="168" />
            <span aria-hidden="true" className="h-3 w-px bg-[#E2E8F0]" />
            <HeroStat label="Walk score" value="99" />
            <span aria-hidden="true" className="h-3 w-px bg-[#E2E8F0]" />
            <HeroStat label="Reputation" value="4.6★" />
          </div>
        </div>

        {/* Period switcher pinned right so the strip subsumes the
            "Good afternoon" greeting + period control into one row. */}
        <div className="shrink-0">
          <PeriodSwitcher value={period} onChange={onPeriodChange} />
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "15px",
          fontWeight: 500,
          color: TOKENS.nearBlack,
          letterSpacing: "-0.008em",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: TOKENS.stone,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function PeriodSwitcher({
  value,
  onChange,
}: {
  value: "7d" | "30d" | "90d";
  onChange: (v: "7d" | "30d" | "90d") => void;
}) {
  const opts: Array<{ k: "7d" | "30d" | "90d"; label: string }> = [
    { k: "7d", label: "7 days" },
    { k: "30d", label: "30 days" },
    { k: "90d", label: "90 days" },
  ];
  return (
    <div
      className="inline-flex items-center"
      style={{
        backgroundColor: TOKENS.white,
        borderRadius: "10px",
        padding: "3px",
        boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
      }}
    >
      {opts.map((o) => {
        const active = o.k === value;
        return (
          <button
            key={o.k}
            type="button"
            onClick={() => onChange(o.k)}
            style={{
              padding: "5px 12px",
              borderRadius: "7px",
              fontFamily: "var(--font-sans)",
              fontSize: "12px",
              fontWeight: active ? 500 : 400,
              color: active ? TOKENS.nearBlack : TOKENS.olive,
              backgroundColor: active ? TOKENS.sand : "transparent",
              transition: "background-color 0.2s",
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ActivityDot({ kind }: { kind: string }) {
  // Mirrors the real product's activity feed (components/portal/dashboard/
  // activity-feed.tsx) where every kind lands on brand blue against a
  // 10% blue chip background. No more orange / green / amber per-event
  // dots — every event reads as part of the same product surface.
  void kind;
  return (
    <span
      className="inline-block flex-shrink-0 rounded-full"
      style={{
        width: "8px",
        height: "8px",
        backgroundColor: TOKENS.accent,
        boxShadow: `0 0 0 3px rgba(37,99,235,0.12)`,
      }}
    />
  );
}

function QuickAction({
  label,
  hint,
  terracotta,
}: {
  label: string;
  hint: string;
  terracotta?: boolean;
}) {
  return (
    <button
      type="button"
      className="w-full text-left"
      style={{
        backgroundColor: terracotta ? TOKENS.terracotta : TOKENS.white,
        color: terracotta ? TOKENS.ivory : TOKENS.nearBlack,
        borderRadius: "12px",
        padding: "14px 16px",
        boxShadow: terracotta
          ? `0 0 0 1px ${TOKENS.terracotta}`
          : `0 0 0 1px ${TOKENS.borderCream}`,
        cursor: "pointer",
        transition: "background-color 0.2s ease",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          fontWeight: 500,
          lineHeight: 1.3,
        }}
      >
        {label}
      </p>
      <p
        className="mt-1"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "12px",
          color: terracotta ? "rgba(250,249,245,0.8)" : TOKENS.stone,
          lineHeight: 1.4,
        }}
      >
        {hint}
      </p>
    </button>
  );
}

// ===========================================================================
// 2. LEADS
// ===========================================================================

const STAGES: Array<{ key: LeadStage; label: string }> = [
  { key: "new",       label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "tour",      label: "Tour booked" },
  { key: "applied",   label: "Applied" },
  { key: "signed",    label: "Signed" },
];

function LeadsView() {
  const [source, setSource] = useState<"all" | LeadSource>("all");
  const [query, setQuery] = useState("");
  const [openLead, setOpenLead] = useState<LeadRow | null>(null);

  const filtered = useMemo(() => {
    return LEADS.filter((l) => {
      if (source !== "all" && l.source !== source) return false;
      if (query && !`${l.name} ${l.property} ${l.unit}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [source, query]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: TOKENS.stone,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Pipeline
          </p>
          <h1
            className="mt-1.5"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(18px, 4vw, 28px)",
              fontWeight: 500,
              color: TOKENS.nearBlack,
              lineHeight: 1.1,
            }}
          >
            Leads
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="flex items-center gap-2 px-3"
            style={{
              backgroundColor: TOKENS.white,
              borderRadius: "10px",
              boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
              height: "36px",
              width: "240px",
            }}
          >
            <Icons.search color={TOKENS.stone} size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search leads..."
              className="bg-transparent outline-none w-full"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                color: TOKENS.nearBlack,
              }}
            />
          </div>
          <SourceFilter value={source} onChange={setSource} />
          <button type="button" className="btn-secondary" style={{ minHeight: "36px", padding: "6px 14px", fontSize: "13px", borderRadius: "10px" }}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex md:grid md:grid-cols-5 gap-3 overflow-x-auto pb-2 md:overflow-visible md:pb-0" style={{ scrollSnapType: "x mandatory" }}>
        {STAGES.map((stage) => {
          const leads = filtered.filter((l) => l.stage === stage.key);
          return (
            <div key={stage.key} className="flex flex-col flex-shrink-0 md:flex-shrink" style={{ minHeight: "320px", minWidth: "160px", scrollSnapAlign: "start" }}>
              <div className="flex items-center justify-between mb-2.5 px-1">
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10.5px",
                    color: TOKENS.stone,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                  }}
                >
                  {stage.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "10.5px",
                    color: TOKENS.stone,
                    backgroundColor: TOKENS.white,
                    border: `1px solid ${TOKENS.borderCream}`,
                    padding: "1px 6px",
                    borderRadius: "999px",
                  }}
                >
                  {leads.length}
                </span>
              </div>
              <div
                className="space-y-2 flex-1 p-2"
                style={{
                  backgroundColor: TOKENS.ivory,
                  borderRadius: "12px",
                  boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
                }}
              >
                {leads.length === 0 ? (
                  <p
                    className="text-center pt-10"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "11.5px",
                      color: TOKENS.stone,
                    }}
                  >
                    No leads here
                  </p>
                ) : null}
                {leads.map((l) => (
                  <LeadCard key={l.id} lead={l} onClick={() => setOpenLead(l)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {openLead ? <LeadDrawer lead={openLead} onClose={() => setOpenLead(null)} /> : null}
    </div>
  );
}

function SourceFilter({
  value,
  onChange,
}: {
  value: "all" | LeadSource;
  onChange: (v: "all" | LeadSource) => void;
}) {
  const opts: Array<{ k: "all" | LeadSource; label: string }> = [
    { k: "all", label: "All sources" },
    { k: "Form", label: "Form" },
    { k: "Chat", label: "Chat" },
    { k: "Pixel", label: "Pixel" },
    { k: "Referral", label: "Referral" },
    { k: "Paid", label: "Paid" },
  ];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as "all" | LeadSource)}
      style={{
        backgroundColor: TOKENS.white,
        border: `1px solid ${TOKENS.borderCream}`,
        borderRadius: "10px",
        padding: "7px 10px",
        fontFamily: "var(--font-sans)",
        fontSize: "13px",
        color: TOKENS.nearBlack,
        height: "36px",
      }}
    >
      {opts.map((o) => (
        <option key={o.k} value={o.k}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function LeadCard({ lead, onClick }: { lead: LeadRow; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left"
      style={{
        backgroundColor: TOKENS.white,
        borderRadius: "10px",
        padding: "10px 12px",
        boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
        cursor: "pointer",
        transition: "box-shadow 0.2s ease",
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 500,
            color: TOKENS.nearBlack,
          }}
        >
          {lead.name}
        </span>
        <ScoreBadge score={lead.score} />
      </div>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "11.5px",
          color: TOKENS.olive,
          lineHeight: 1.4,
        }}
      >
        {lead.unit} &middot; {lead.property}
      </p>
      <div className="flex items-center justify-between mt-2.5">
        <Pill tone={lead.source === "Chat" ? "terracotta" : lead.source === "Referral" ? "success" : "neutral"}>
          {lead.source}
        </Pill>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: TOKENS.stone,
          }}
        >
          {lead.createdAt}
        </span>
      </div>
    </button>
  );
}

function LeadDrawer({ lead, onClose }: { lead: LeadRow; onClose: () => void }) {
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        style={{ backgroundColor: "rgba(23,26,32,0.35)", backdropFilter: "blur(4px)" }}
      />
      <aside
        className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[440px] overflow-y-auto"
        style={{
          backgroundColor: TOKENS.ivory,
          borderLeft: `1px solid ${TOKENS.borderCream}`,
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${TOKENS.borderCream}` }}
        >
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center justify-center rounded-full"
              style={{
                width: "36px",
                height: "36px",
                backgroundColor: TOKENS.sand,
                color: TOKENS.charcoal,
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {lead.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
            </span>
            <div>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "18px",
                  fontWeight: 500,
                  color: TOKENS.nearBlack,
                  lineHeight: 1.2,
                }}
              >
                {lead.name}
              </p>
              <p style={{ fontSize: "12px", color: TOKENS.stone }}>
                {lead.unit} &middot; {lead.property}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center rounded-md"
            style={{ width: "32px", height: "32px", color: TOKENS.stone }}
          >
            <Icons.close />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DrawerStat label="Score"  value={<ScoreBadge score={lead.score} />} />
            <DrawerStat label="Source" value={<Pill tone="terracotta">{lead.source}</Pill>} />
            <DrawerStat label="Email"  value={<span style={{ fontSize: "13px", color: TOKENS.nearBlack }}>{lead.email}</span>} />
            <DrawerStat label="Phone"  value={<span style={{ fontSize: "13px", color: TOKENS.nearBlack }}>{lead.phone}</span>} />
          </div>

          <div>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: TOKENS.stone,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 500,
                marginBottom: "10px",
              }}
            >
              Timeline
            </p>
            <ol className="space-y-3">
              {lead.timeline.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="flex items-center justify-center flex-shrink-0 rounded-full"
                    style={{
                      width: "22px",
                      height: "22px",
                      backgroundColor: "rgba(37,99,235,0.12)",
                      color: TOKENS.terracotta,
                      marginTop: "1px",
                    }}
                  >
                    <Icons.dot size={6} color={TOKENS.terracotta} />
                  </span>
                  <div className="flex-1">
                    <p
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "13px",
                        color: TOKENS.nearBlack,
                        lineHeight: 1.45,
                      }}
                    >
                      {t.text}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                        color: TOKENS.stone,
                        marginTop: "2px",
                      }}
                    >
                      {t.at}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <DrawerButton label="Send email" />
            <DrawerButton label="Send SMS" />
            <DrawerButton label="Book tour" />
            <DrawerButton label="Mark won" primary />
          </div>
        </div>
      </aside>
    </>
  );
}

function DrawerStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: TOKENS.white,
        borderRadius: "10px",
        padding: "12px",
        boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: TOKENS.stone,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </p>
      <div className="mt-1.5">{value}</div>
    </div>
  );
}

function DrawerButton({ label, primary }: { label: string; primary?: boolean }) {
  return (
    <button
      type="button"
      className="w-full inline-flex items-center justify-center"
      style={{
        height: "38px",
        borderRadius: "10px",
        backgroundColor: primary ? TOKENS.terracotta : TOKENS.white,
        color: primary ? TOKENS.ivory : TOKENS.nearBlack,
        fontFamily: "var(--font-sans)",
        fontSize: "13px",
        fontWeight: 500,
        boxShadow: primary
          ? `0 0 0 1px ${TOKENS.terracotta}`
          : `0 0 0 1px ${TOKENS.borderCream}`,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ===========================================================================
// 3. CONVERSATIONS
// ===========================================================================

function ConversationsView() {
  const [selectedId, setSelectedId] = useState<string>(CONVERSATIONS[0].id);
  const selected = CONVERSATIONS.find((c) => c.id === selectedId) ?? CONVERSATIONS[0];

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: TOKENS.stone,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Inbox
          </p>
          <h1
            className="mt-1.5"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(18px, 4vw, 28px)",
              fontWeight: 500,
              color: TOKENS.nearBlack,
              lineHeight: 1.1,
            }}
          >
            Conversations
          </h1>
        </div>
        <Pill tone="success">
          <Icons.dot size={6} color={TOKENS.success} /> Chatbot live
        </Pill>
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-[320px_1fr] overflow-hidden"
        style={{
          backgroundColor: TOKENS.white,
          borderRadius: "16px",
          boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
          minHeight: "520px",
        }}
      >
        <div style={{ borderRight: `1px solid ${TOKENS.borderCream}` }}>
          {CONVERSATIONS.map((c, i) => {
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className="w-full text-left px-4 py-3"
                style={{
                  backgroundColor: active ? TOKENS.parchment : "transparent",
                  borderBottom: i < CONVERSATIONS.length - 1 ? `1px solid ${TOKENS.borderCream}` : "none",
                  transition: "background-color 0.2s",
                  cursor: "pointer",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "13.5px",
                      fontWeight: 500,
                      color: TOKENS.nearBlack,
                    }}
                  >
                    {c.visitor}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: TOKENS.stone }}>
                    {c.updatedAt}
                  </span>
                </div>
                <p
                  className="mt-1 truncate"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    color: TOKENS.olive,
                  }}
                >
                  {c.preview}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Pill tone="neutral">{c.property}</Pill>
                  {c.capturedEmail ? <Pill tone="success">Email captured</Pill> : null}
                  {c.unread ? (
                    <span
                      className="inline-block rounded-full"
                      style={{ width: "6px", height: "6px", backgroundColor: TOKENS.terracotta }}
                    />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col">
          <div
            className="flex items-center justify-between gap-3 px-5 py-3"
            style={{ borderBottom: `1px solid ${TOKENS.borderCream}` }}
          >
            <div>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "17px",
                  fontWeight: 500,
                  color: TOKENS.nearBlack,
                  lineHeight: 1.2,
                }}
              >
                {selected.visitor}
              </p>
              <p style={{ fontSize: "12px", color: TOKENS.stone }}>
                {selected.property} &middot; Chatbot assistant
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary"
                style={{ minHeight: "32px", padding: "4px 12px", fontSize: "12px", borderRadius: "8px" }}
              >
                Hand off to leasing
              </button>
            </div>
          </div>

          <div
            className="flex-1 p-5 space-y-2.5"
            style={{ backgroundColor: TOKENS.parchment }}
          >
            {selected.messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[72%] px-3 py-2"
                  style={{
                    backgroundColor: m.from === "user" ? TOKENS.terracotta : TOKENS.white,
                    color: m.from === "user" ? TOKENS.ivory : TOKENS.nearBlack,
                    borderRadius: "14px",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13.5px",
                    lineHeight: 1.5,
                    boxShadow: m.from === "user" ? "none" : `0 0 0 1px ${TOKENS.borderCream}`,
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <div
            className="flex items-center gap-2 px-5 py-3"
            style={{ borderTop: `1px solid ${TOKENS.borderCream}` }}
          >
            <input
              type="text"
              placeholder="Reply as Acme leasing..."
              className="flex-1 bg-transparent outline-none"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                color: TOKENS.nearBlack,
                padding: "8px 10px",
                backgroundColor: TOKENS.parchment,
                borderRadius: "10px",
                border: `1px solid ${TOKENS.borderCream}`,
              }}
            />
            <button
              type="button"
              className="inline-flex items-center justify-center"
              style={{
                height: "36px",
                padding: "0 14px",
                borderRadius: "10px",
                backgroundColor: TOKENS.terracotta,
                color: TOKENS.ivory,
                fontFamily: "var(--font-sans)",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// 4. CREATIVE STUDIO
// ===========================================================================

function CreativeView() {
  const [filter, setFilter] = useState<"All" | CreativeStatus>("All");
  const [showNew, setShowNew] = useState(false);

  const filtered = CREATIVE_REQUESTS.filter((r) => filter === "All" || r.status === filter);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: TOKENS.stone,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Studio
          </p>
          <h1
            className="mt-1.5"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(18px, 4vw, 28px)",
              fontWeight: 500,
              color: TOKENS.nearBlack,
              lineHeight: 1.1,
            }}
          >
            Creative
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2"
          style={{
            backgroundColor: TOKENS.terracotta,
            color: TOKENS.ivory,
            borderRadius: "10px",
            padding: "8px 14px",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 500,
            boxShadow: `0 0 0 1px ${TOKENS.terracotta}`,
          }}
        >
          <Icons.plus color={TOKENS.ivory} />
          New request
        </button>
      </div>

      <div className="flex items-center gap-1.5 mb-4">
        {(["All", "Draft", "In review", "Filming", "Shipped"] as const).map((s) => {
          const active = filter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              style={{
                padding: "6px 12px",
                borderRadius: "999px",
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                fontWeight: active ? 500 : 400,
                color: active ? TOKENS.nearBlack : TOKENS.olive,
                backgroundColor: active ? TOKENS.sand : TOKENS.white,
                border: `1px solid ${active ? TOKENS.ring : TOKENS.borderCream}`,
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
            >
              {s}
            </button>
          );
        })}
      </div>

      <Tile>
        <ul>
          {filtered.map((r, i) => (
            <li
              key={r.id}
              className="flex items-center gap-4 px-5 py-3.5"
              style={{
                borderBottom: i < filtered.length - 1 ? `1px solid ${TOKENS.borderCream}` : "none",
              }}
            >
              <CreativeTypeIcon type={r.type} />
              <div className="flex-1 min-w-0">
                <p
                  className="truncate"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: TOKENS.nearBlack,
                  }}
                >
                  {r.title}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    color: TOKENS.stone,
                    marginTop: "2px",
                  }}
                >
                  {r.type} &middot; Assigned to {r.assignee}
                </p>
              </div>
              <CreativeStatusPill status={r.status} />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  color: TOKENS.stone,
                  minWidth: "72px",
                  textAlign: "right",
                }}
              >
                ETA {r.eta}
              </span>
            </li>
          ))}
        </ul>
      </Tile>

      {showNew ? <NewRequestModal onClose={() => setShowNew(false)} /> : null}
    </div>
  );
}

function CreativeStatusPill({ status }: { status: CreativeStatus }) {
  const tone: "success" | "terracotta" | "warning" | "muted" =
    status === "Shipped"   ? "success"    :
    status === "In review" ? "terracotta" :
    status === "Filming"   ? "warning"    :
    "muted";
  return <Pill tone={tone}>{status}</Pill>;
}

function CreativeTypeIcon({ type }: { type: string }) {
  const glyph = type.startsWith("Meta")
    ? "M"
    : type.startsWith("Google")
    ? "G"
    : type.startsWith("TikTok")
    ? "T"
    : type === "Email"
    ? "E"
    : type === "SMS"
    ? "S"
    : "L";
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: "32px",
        height: "32px",
        backgroundColor: "rgba(37,99,235,0.10)",
        color: TOKENS.terracotta,
        borderRadius: "8px",
        fontFamily: "var(--font-display)",
        fontSize: "14px",
        fontWeight: 500,
      }}
    >
      {glyph}
    </span>
  );
}

function NewRequestModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        style={{ backgroundColor: "rgba(23,26,32,0.35)", backdropFilter: "blur(4px)" }}
      />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[520px]"
        style={{
          backgroundColor: TOKENS.ivory,
          borderRadius: "18px",
          boxShadow:
            `0 0 0 1px ${TOKENS.borderCream}, 0 30px 60px rgba(0,0,0,0.2)`,
          padding: "24px",
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10.5px",
                color: TOKENS.stone,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              Creative studio
            </p>
            <h3
              className="mt-1"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "22px",
                fontWeight: 500,
                color: TOKENS.nearBlack,
                lineHeight: 1.2,
              }}
            >
              New request
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md"
            style={{ width: "32px", height: "32px", color: TOKENS.stone }}
            aria-label="Close"
          >
            <Icons.close />
          </button>
        </div>

        <div className="space-y-3">
          <FormRow label="Asset type">
            <select
              defaultValue="Meta ad set"
              style={{
                width: "100%",
                backgroundColor: TOKENS.white,
                border: `1px solid ${TOKENS.borderCream}`,
                borderRadius: "10px",
                padding: "9px 12px",
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
                color: TOKENS.nearBlack,
              }}
            >
              {["Meta ad set","Google ad set","TikTok spark","Landing block","Email","SMS"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Brief">
            <textarea
              rows={3}
              placeholder="What are we promoting? Which audience? Any must-have copy or visuals?"
              style={{
                width: "100%",
                backgroundColor: TOKENS.white,
                border: `1px solid ${TOKENS.borderCream}`,
                borderRadius: "10px",
                padding: "10px 12px",
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
                color: TOKENS.nearBlack,
                resize: "vertical",
              }}
            />
          </FormRow>
          <FormRow label="Due date">
            <input
              type="text"
              placeholder="Any Friday"
              style={{
                width: "100%",
                backgroundColor: TOKENS.white,
                border: `1px solid ${TOKENS.borderCream}`,
                borderRadius: "10px",
                padding: "9px 12px",
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
                color: TOKENS.nearBlack,
              }}
            />
          </FormRow>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ minHeight: "36px", padding: "6px 14px", fontSize: "13px", borderRadius: "10px" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: TOKENS.terracotta,
              color: TOKENS.ivory,
              borderRadius: "10px",
              padding: "8px 16px",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              fontWeight: 500,
              boxShadow: `0 0 0 1px ${TOKENS.terracotta}`,
            }}
          >
            Submit request
          </button>
        </div>
      </div>
    </>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "12px",
          color: TOKENS.olive,
          display: "block",
          marginBottom: "6px",
          fontWeight: 500,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// ===========================================================================
// 5. CAMPAIGNS
// ===========================================================================

function CampaignsView() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: TOKENS.stone,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Ad spend
          </p>
          <h1
            className="mt-1.5"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(18px, 4vw, 28px)",
              fontWeight: 500,
              color: TOKENS.nearBlack,
              lineHeight: 1.1,
            }}
          >
            Campaigns
          </h1>
        </div>
        <PeriodSwitcher value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {AD_CHANNELS.map((c) => (
          <ChannelCard key={c.id} channel={c} />
        ))}
      </div>

      <div className="mt-6">
        <SectionHeader title="Spend by day · last 7 days" />
        <Tile>
          <div className="p-5">
            <WeeklyBarChart />
            <div
              className="mt-5 pt-4 flex items-center gap-4 flex-wrap"
              style={{ borderTop: `1px dashed ${TOKENS.borderCream}` }}
            >
              <LegendSwatch color={TOKENS.terracotta} label="Meta" />
              <LegendSwatch color={TOKENS.coral} label="Google" />
              <LegendSwatch color={TOKENS.warmSilver} label="TikTok" />
            </div>
          </div>
        </Tile>
      </div>
    </div>
  );
}

function ChannelCard({ channel }: { channel: typeof AD_CHANNELS[number] }) {
  const tone: "success" | "warning" =
    channel.status === "Live" ? "success" : "warning";
  const pct = Math.round((channel.spent / channel.budget) * 100);
  return (
    <div
      style={{
        backgroundColor: TOKENS.white,
        borderRadius: "16px",
        padding: "18px 20px",
        boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "20px",
            fontWeight: 500,
            color: TOKENS.nearBlack,
            lineHeight: 1.2,
          }}
        >
          {channel.name}
        </span>
        <Pill tone={tone}>{channel.status}</Pill>
      </div>
      <p
        className="mt-1"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "12px",
          color: TOKENS.stone,
        }}
      >
        {channel.sub}
      </p>

      <div
        className="mt-4 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: TOKENS.borderCream }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: TOKENS.terracotta }}
        />
      </div>
      <div
        className="mt-2 flex items-center justify-between"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10.5px",
          color: TOKENS.olive,
        }}
      >
        <span>${channel.spent} / ${channel.budget}</span>
        <span>{pct}% of budget</span>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <MiniStat label="Impr." value={channel.impressions} />
        <MiniStat label="Leads" value={String(channel.leads)} />
        <MiniStat label="CPA"   value={channel.cpa} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          className="btn-secondary"
          style={{
            minHeight: "32px",
            padding: "4px 12px",
            fontSize: "12px",
            borderRadius: "8px",
            flex: 1,
          }}
        >
          View detail
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ minHeight: "32px", padding: "4px 12px", fontSize: "12px", borderRadius: "8px" }}
        >
          {channel.status === "Live" ? "Pause" : "Resume"}
        </button>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9.5px",
          color: TOKENS.stone,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </p>
      <p
        className="mt-0.5"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "16px",
          fontWeight: 500,
          color: TOKENS.nearBlack,
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block rounded-sm"
        style={{ width: "10px", height: "10px", backgroundColor: color }}
      />
      <span style={{ fontSize: "12px", color: TOKENS.olive }}>{label}</span>
    </span>
  );
}

function WeeklyBarChart() {
  const totals = WEEK_BARS.map((d) => d.meta + d.google + d.tiktok);
  const max = Math.ceil(Math.max(...totals) / 10) * 10;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const tikTokColor = TOKENS.warmSilver;

  return (
    <div>
      <div className="relative flex gap-3 h-[200px] pl-9 pr-1">
        <div
          className="absolute left-0 top-0 h-full flex flex-col justify-between"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            color: TOKENS.stone,
            width: "28px",
          }}
        >
          {[...ticks].reverse().map((t) => (
            <span key={t} className="text-right leading-none" style={{ transform: "translateY(-4px)" }}>
              {Math.round(max * t)}
            </span>
          ))}
        </div>

        <div
          className="absolute inset-0 flex flex-col justify-between pointer-events-none"
          style={{ left: "36px", right: "4px" }}
        >
          {ticks.map((t) => (
            <div
              key={t}
              style={{
                height: "1px",
                borderTop: `1px dashed ${TOKENS.borderCream}`,
                opacity: t === 0 ? 0 : 1,
              }}
            />
          ))}
        </div>

        {WEEK_BARS.map((d) => {
          const total = d.meta + d.google + d.tiktok;
          const totalPct = (total / max) * 100;
          const metaPct = (d.meta / total) * 100;
          const googlePct = (d.google / total) * 100;
          const tiktokPct = (d.tiktok / total) * 100;
          return (
            <div
              key={d.d}
              className="flex-1 flex flex-col justify-end items-center relative z-10"
              title={`${d.d}: ${total} leads. Meta ${d.meta}, Google ${d.google}, TikTok ${d.tiktok}`}
            >
              <div
                className="w-full max-w-[34px] flex flex-col rounded-md overflow-hidden"
                style={{
                  height: `${totalPct}%`,
                  boxShadow: `0 1px 2px rgba(30, 42, 58,0.06)`,
                  transition: "height 400ms ease",
                }}
              >
                <div style={{ height: `${metaPct}%`,   backgroundColor: TOKENS.terracotta }} />
                <div style={{ height: `${googlePct}%`, backgroundColor: TOKENS.coral }} />
                <div style={{ height: `${tiktokPct}%`, backgroundColor: tikTokColor }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 pl-9 pr-1 mt-2">
        {WEEK_BARS.map((d) => (
          <p
            key={d.d}
            className="flex-1 text-center"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: TOKENS.stone,
            }}
          >
            {d.d}
          </p>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// 6. PROPERTIES
// ===========================================================================

function PropertiesView() {
  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: TOKENS.stone,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Portfolio
          </p>
          <h1
            className="mt-1.5"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(18px, 4vw, 28px)",
              fontWeight: 500,
              color: TOKENS.nearBlack,
              lineHeight: 1.1,
            }}
          >
            Properties
          </h1>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2"
          style={{
            backgroundColor: TOKENS.terracotta,
            color: TOKENS.ivory,
            borderRadius: "10px",
            padding: "8px 14px",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          <Icons.plus color={TOKENS.ivory} />
          Add property
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PROPERTIES.map((p) => (
          <PropertyCard key={p.id} property={p} />
        ))}
      </div>
    </div>
  );
}

function PropertyCard({ property }: { property: typeof PROPERTIES[number] }) {
  const tone: "success" | "warning" | "muted" =
    property.status === "Live"       ? "success"  :
    property.status === "Onboarding" ? "warning"  :
    "muted";
  return (
    <div
      style={{
        backgroundColor: TOKENS.white,
        borderRadius: "16px",
        padding: "20px 22px",
        boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "20px",
              fontWeight: 500,
              color: TOKENS.nearBlack,
              lineHeight: 1.2,
            }}
          >
            {property.name}
          </p>
          <p
            className="mt-1"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
              color: TOKENS.stone,
            }}
          >
            {property.location} &middot; {property.units} units
          </p>
        </div>
        <Pill tone={tone}>{property.status}</Pill>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PropertyStat
          label="Occupancy"
          value={property.occupancyPct > 0 ? `${property.occupancyPct}%` : "—"}
        />
        <PropertyStat
          label="Leads / wk"
          value={String(property.leadsThisWeek)}
        />
        <PropertyStat
          label="Revenue"
          value={property.revenue}
        />
      </div>

      <div
        className="mt-5 pt-4 flex items-center gap-2"
        style={{ borderTop: `1px dashed ${TOKENS.borderCream}` }}
      >
        <button
          type="button"
          className="btn-secondary"
          style={{
            flex: 1,
            minHeight: "32px",
            padding: "4px 12px",
            fontSize: "12px",
            borderRadius: "8px",
          }}
        >
          Open portal
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ minHeight: "32px", padding: "4px 12px", fontSize: "12px", borderRadius: "8px" }}
        >
          Settings
        </button>
      </div>
    </div>
  );
}

function PropertyStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9.5px",
          color: TOKENS.stone,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        {label}
      </p>
      <p
        className="mt-1"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(14px, 3vw, 18px)",
          fontWeight: 500,
          color: TOKENS.nearBlack,
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
    </div>
  );
}

// ===========================================================================
// 7. REPORTS
// ===========================================================================

function ReportsView() {
  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: TOKENS.stone,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Weekly to owner + operator
          </p>
          <h1
            className="mt-1.5"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(18px, 4vw, 28px)",
              fontWeight: 500,
              color: TOKENS.nearBlack,
              lineHeight: 1.1,
            }}
          >
            Reports
          </h1>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2"
          style={{
            backgroundColor: TOKENS.white,
            color: TOKENS.nearBlack,
            borderRadius: "10px",
            padding: "8px 14px",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            fontWeight: 500,
            boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
          }}
        >
          <Icons.download color={TOKENS.nearBlack} />
          Download PDF
        </button>
      </div>

      <Tile>
        <div className="p-6">
          <SectionHeader title="Leads by channel, this week" />
          <WeeklyBarChart />
          <div
            className="mt-5 pt-4 flex items-center gap-4 flex-wrap"
            style={{ borderTop: `1px dashed ${TOKENS.borderCream}` }}
          >
            <LegendSwatch color={TOKENS.terracotta} label="Meta" />
            <LegendSwatch color={TOKENS.coral} label="Google" />
            <LegendSwatch color={TOKENS.warmSilver} label="TikTok" />
          </div>
        </div>
      </Tile>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 mt-5">
        {[
          { label: "Leads",          value: "168" },
          { label: "Tours booked",   value: "31"  },
          { label: "Applied",        value: "11"  },
          { label: "Signed",         value: "4"   },
          { label: "Avg cost / tour",value: "$122" },
          { label: "Avg cost / lease",value:"$948" },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              backgroundColor: TOKENS.white,
              borderRadius: "12px",
              padding: "14px 16px",
              boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: TOKENS.stone,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              {k.label}
            </p>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(16px, 3.5vw, 24px)",
                fontWeight: 500,
                color: TOKENS.nearBlack,
                lineHeight: 1.1,
              }}
            >
              {k.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// 8. SETTINGS
// ===========================================================================

function SettingsView() {
  return (
    <div>
      <div className="mb-5">
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: TOKENS.stone,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Workspace
        </p>
        <h1
          className="mt-1.5"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(18px, 4vw, 28px)",
            fontWeight: 500,
            color: TOKENS.nearBlack,
            lineHeight: 1.1,
          }}
        >
          Settings
        </h1>
      </div>

      <div className="space-y-3">
        <SettingsRow
          title="Brand"
          hint="Logo, colors, typography. Used across the marketing site and all creative."
          action={<Pill tone="success">Configured</Pill>}
        />
        <SettingsRow
          title="Custom domain"
          hint="acmeportfolio.com, SSL active, redirects from www."
          action={<Pill tone="success">Live</Pill>}
        />
        <SettingsRow
          title="PMS integration"
          hint="Connected via API. Units and pricing refresh every 15 minutes."
          action={<Pill tone="success">Connected</Pill>}
        />
        <SettingsRow
          title="Identity pixel"
          hint="Firing on all tenant marketing sites. Names attached to a meaningful share of visits."
          action={<Pill tone="success">Active</Pill>}
        />
        <SettingsRow
          title="AI chatbot"
          hint="Trained on live unit inventory and tour calendar."
          action={<Pill tone="success">Active</Pill>}
        />
        <SettingsRow
          title="Team"
          hint="4 seats. Owner, operator, 2 leasing agents."
          action={
            <button
              type="button"
              className="btn-secondary"
              style={{ minHeight: "32px", padding: "4px 12px", fontSize: "12px", borderRadius: "8px" }}
            >
              Manage
            </button>
          }
        />
        <SettingsRow
          title="Billing"
          hint="Managed subscription. Ad spend passes through at cost."
          action={
            <button
              type="button"
              className="btn-secondary"
              style={{ minHeight: "32px", padding: "4px 12px", fontSize: "12px", borderRadius: "8px" }}
            >
              Stripe portal
            </button>
          }
        />
      </div>
    </div>
  );
}

function SettingsRow({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-5 py-4"
      style={{
        backgroundColor: TOKENS.white,
        borderRadius: "12px",
        boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
      }}
    >
      <div>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "16px",
            fontWeight: 500,
            color: TOKENS.nearBlack,
            lineHeight: 1.25,
          }}
        >
          {title}
        </p>
        <p
          className="mt-1"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12.5px",
            color: TOKENS.olive,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </p>
      </div>
      <div className="flex-shrink-0">{action}</div>
    </div>
  );
}

// ===========================================================================
// 9. BRIEFING (daily AI digest)
// ===========================================================================

function BriefingView() {
  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: TOKENS.stone,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {BRIEFING.date} · AI briefing
          </p>
          <h1
            className="mt-1"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "20px",
              fontWeight: 500,
              color: TOKENS.nearBlack,
              lineHeight: 1.15,
            }}
          >
            {BRIEFING.greeting}
          </h1>
        </div>
        <button
          type="button"
          className="btn-secondary"
          style={{ minHeight: "30px", padding: "4px 10px", fontSize: "11.5px", borderRadius: "8px" }}
        >
          Share
        </button>
      </div>

      <div
        className="p-4 mb-3"
        style={{
          backgroundColor: TOKENS.accent,
          borderRadius: "12px",
          color: TOKENS.white,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9.5px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 500,
            opacity: 0.9,
          }}
        >
          Weekly summary
        </p>
        <p
          className="mt-1.5"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "13.5px",
            fontWeight: 400,
            lineHeight: 1.55,
          }}
        >
          {BRIEFING.summary}
        </p>
      </div>

      <div className="space-y-2">
        {BRIEFING.highlights.map((h, i) => {
          const toneColor =
            h.kind === "win"   ? TOKENS.success :
            h.kind === "watch" ? TOKENS.warning :
            TOKENS.accent;
          const toneBg =
            h.kind === "win"   ? "rgba(22, 163, 74,0.12)" :
            h.kind === "watch" ? "rgba(245, 158, 11,0.12)" :
            "rgba(37,99,235,0.10)";
          const toneLabel =
            h.kind === "win"   ? "WIN" :
            h.kind === "watch" ? "WATCH" :
            "NOTE";
          return (
            <div
              key={i}
              className="p-3.5 flex gap-3"
              style={{
                backgroundColor: TOKENS.white,
                borderRadius: "10px",
                boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
              }}
            >
              <span
                className="flex-shrink-0 inline-flex items-center justify-center"
                style={{
                  width: "42px",
                  height: "20px",
                  borderRadius: "5px",
                  backgroundColor: toneBg,
                  color: toneColor,
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                }}
              >
                {toneLabel}
              </span>
              <div className="flex-1 min-w-0">
                <h3
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: TOKENS.nearBlack,
                    lineHeight: 1.3,
                  }}
                >
                  {h.title}
                </h3>
                <p
                  className="mt-1"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "12.5px",
                    color: TOKENS.charcoal,
                    lineHeight: 1.55,
                  }}
                >
                  {h.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="mt-3 p-3.5"
        style={{
          backgroundColor: TOKENS.ivory,
          borderRadius: "10px",
          boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9.5px",
            color: TOKENS.stone,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Focus this week
        </p>
        <p
          className="mt-1"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12.5px",
            color: TOKENS.charcoal,
            lineHeight: 1.55,
          }}
        >
          {BRIEFING.focus}
        </p>
      </div>
    </div>
  );
}

// ===========================================================================
// 10. VISITORS (identity-pixel resolved traffic)
// ===========================================================================

function VisitorsView() {
  const [filter, setFilter] = useState<"All" | Visitor["stage"]>("All");
  const rows = VISITORS.filter((v) => filter === "All" || v.stage === filter);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: TOKENS.stone,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Identity pixel
          </p>
          <h1
            className="mt-1.5"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "28px",
              fontWeight: 500,
              color: TOKENS.nearBlack,
              lineHeight: 1.1,
            }}
          >
            Visitors
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Identification rate", value: VISITOR_STATS.resolveRate },
          { label: "Identified / week",   value: VISITOR_STATS.identifiedThisWeek.toLocaleString() },
          { label: "Moved to lead",       value: VISITOR_STATS.movedToLead.toLocaleString() },
          { label: "Followed up this week", value: VISITOR_STATS.movedToLead.toLocaleString() },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              backgroundColor: TOKENS.white,
              borderRadius: "12px",
              padding: "14px 16px",
              boxShadow: `0 0 0 1px ${TOKENS.borderCream}`,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: TOKENS.stone,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              {k.label}
            </p>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "24px",
                fontWeight: 500,
                color: TOKENS.nearBlack,
                lineHeight: 1.1,
              }}
            >
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 mb-4">
        {(["All", "Identified", "Nurturing", "Converted"] as const).map((s) => {
          const active = filter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              style={{
                padding: "6px 12px",
                borderRadius: "999px",
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                fontWeight: active ? 500 : 400,
                color: active ? TOKENS.nearBlack : TOKENS.olive,
                backgroundColor: active ? TOKENS.sand : TOKENS.white,
                border: `1px solid ${active ? TOKENS.ring : TOKENS.borderCream}`,
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
            >
              {s}
            </button>
          );
        })}
      </div>

      <Tile>
        <div
          className="grid grid-cols-[1fr_1.3fr_1fr_80px_80px] gap-3 px-5 py-2.5"
          style={{
            backgroundColor: TOKENS.parchment,
            borderBottom: `1px solid ${TOKENS.borderCream}`,
            color: TOKENS.stone,
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          <span>Visitor</span>
          <span>Context</span>
          <span>Last page</span>
          <span className="text-right">Score</span>
          <span className="text-right">Sessions</span>
        </div>
        {rows.map((v, i) => (
          <div
            key={v.id}
            className="grid grid-cols-[1fr_1.3fr_1fr_80px_80px] gap-3 px-5 py-3 items-center"
            style={{
              borderBottom: i < rows.length - 1 ? `1px solid ${TOKENS.borderCream}` : "none",
              fontFamily: "var(--font-sans)",
              fontSize: "13.5px",
            }}
          >
            <div className="min-w-0">
              <p className="truncate" style={{ color: TOKENS.nearBlack, fontWeight: 500 }}>
                {v.name}
              </p>
              <p className="truncate" style={{ color: TOKENS.stone, fontSize: "12px" }}>
                {v.email}
              </p>
            </div>
            <div className="min-w-0">
              <Pill tone={v.stage === "Converted" ? "success" : v.stage === "Nurturing" ? "warning" : "terracotta"}>
                {v.stage}
              </Pill>
              {v.company && v.company !== "—" ? (
                <span className="ml-2" style={{ color: TOKENS.stone, fontSize: "12px" }}>
                  {v.company}
                </span>
              ) : null}
            </div>
            <span className="truncate" style={{ color: TOKENS.charcoal, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
              {v.lastPage}
            </span>
            <span className="text-right">
              <ScoreBadge score={v.score} />
            </span>
            <span className="text-right" style={{ color: TOKENS.charcoal, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
              {v.sessions}
            </span>
          </div>
        ))}
      </Tile>
    </div>
  );
}

// ===========================================================================
// 11. SEO (search performance)
// ===========================================================================

function SeoView() {
  const latest = SEO_TREND[SEO_TREND.length - 1];
  const first  = SEO_TREND[0];
  const impDelta = Math.round(((latest.impressions - first.impressions) / first.impressions) * 100);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: TOKENS.stone,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Organic + AEO
          </p>
          <h1
            className="mt-1.5"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "28px",
              fontWeight: 500,
              color: TOKENS.nearBlack,
              lineHeight: 1.1,
            }}
          >
            SEO
          </h1>
        </div>
      </div>

      {/* KPI strip — Norman brief (2026-05-28): keyword/query/ranking
          stats lead; clicks and impressions sit lower on the page. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div style={{ backgroundColor: TOKENS.white, borderRadius: "12px", padding: "14px 16px", boxShadow: `0 0 0 1px ${TOKENS.borderCream}` }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: TOKENS.stone, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>Top keywords</p>
          <p className="mt-1" style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 500, color: TOKENS.nearBlack }}>{SEO_QUERIES.length}</p>
        </div>
        <div style={{ backgroundColor: TOKENS.white, borderRadius: "12px", padding: "14px 16px", boxShadow: `0 0 0 1px ${TOKENS.borderCream}` }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: TOKENS.stone, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>Google rank (avg)</p>
          <p className="mt-1" style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 500, color: TOKENS.nearBlack }}>#{latest.position.toFixed(1)}</p>
        </div>
        <div style={{ backgroundColor: TOKENS.white, borderRadius: "12px", padding: "14px 16px", boxShadow: `0 0 0 1px ${TOKENS.borderCream}` }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: TOKENS.stone, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>AI rank citations</p>
          <p className="mt-1" style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 500, color: TOKENS.nearBlack }}>27</p>
        </div>
        <div style={{ backgroundColor: TOKENS.white, borderRadius: "12px", padding: "14px 16px", boxShadow: `0 0 0 1px ${TOKENS.borderCream}` }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: TOKENS.stone, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500 }}>Indexed pages</p>
          <p className="mt-1" style={{ fontFamily: "var(--font-display)", fontSize: "24px", fontWeight: 500, color: TOKENS.nearBlack }}>184</p>
        </div>
      </div>

      <div>
        <SectionHeader title="Top queries" />
        <Tile>
          <div
            className="grid grid-cols-[1.6fr_90px_80px_90px_70px] gap-3 px-5 py-2.5"
            style={{
              backgroundColor: TOKENS.parchment,
              borderBottom: `1px solid ${TOKENS.borderCream}`,
              color: TOKENS.stone,
              fontFamily: "var(--font-mono)",
              fontSize: "10.5px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            <span>Query</span>
            <span className="text-right">Impr.</span>
            <span className="text-right">Clicks</span>
            <span className="text-right">Position</span>
            <span className="text-right">Delta</span>
          </div>
          {SEO_QUERIES.map((q, i) => (
            <div
              key={q.query}
              className="grid grid-cols-[1.6fr_90px_80px_90px_70px] gap-3 px-5 py-3 items-center"
              style={{
                borderBottom: i < SEO_QUERIES.length - 1 ? `1px solid ${TOKENS.borderCream}` : "none",
                fontFamily: "var(--font-sans)",
                fontSize: "13.5px",
              }}
            >
              <span className="truncate" style={{ color: TOKENS.nearBlack, fontWeight: 500 }}>
                {q.query}
              </span>
              <span className="text-right" style={{ color: TOKENS.charcoal, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                {q.impressions.toLocaleString()}
              </span>
              <span className="text-right" style={{ color: TOKENS.charcoal, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                {q.clicks}
              </span>
              <span className="text-right" style={{ color: TOKENS.charcoal, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                #{q.position.toFixed(1)}
              </span>
              <span
                className="text-right"
                style={{
                  color: q.delta > 0 ? TOKENS.success : q.delta < 0 ? TOKENS.error : TOKENS.stone,
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  fontWeight: 500,
                }}
              >
                {q.delta > 0 ? `+${q.delta.toFixed(1)}` : q.delta.toFixed(1)}
              </span>
            </div>
          ))}
        </Tile>
      </div>

      <div className="mt-5">
        <SectionHeader title={`Clicks & impressions, last 8 weeks · ${latest.impressions.toLocaleString()} impressions (+${impDelta}%)`} />
        <Tile>
          <div className="p-5">
            <AnimatedSeoChart points={SEO_TREND} />
          </div>
        </Tile>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnimatedSeoChart — dual-axis SVG line chart that mirrors the real
// /portal/seo Recharts chart (clicks on the left axis, impressions on the
// right). Pure SVG so the demo doesn't pull Recharts client-side. Lines
// draw in left-to-right via stroke-dashoffset; hovering any column
// highlights the week and surfaces a stat card with the underlying
// numbers. No external deps.
// ---------------------------------------------------------------------------

type SeoPoint = {
  wk: string;
  impressions: number;
  clicks: number;
  position: number;
};

function AnimatedSeoChart({ points }: { points: SeoPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);

  // Trigger the draw-in animation one frame after mount so the
  // dashoffset transition fires from full to zero.
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Viewport — rendered at native size and scaled via CSS so the lines
  // stay crisp on any container width.
  const W = 720;
  const H = 200;
  const PAD = { top: 18, right: 44, bottom: 28, left: 44 };
  const PW = W - PAD.left - PAD.right;
  const PH = H - PAD.top - PAD.bottom;

  const maxClicks = Math.max(...points.map((p) => p.clicks));
  const maxImps = Math.max(...points.map((p) => p.impressions));

  const xAt = (i: number) => PAD.left + (i / (points.length - 1)) * PW;
  const yClicks = (v: number) => PAD.top + (1 - v / maxClicks) * PH;
  const yImps = (v: number) => PAD.top + (1 - v / maxImps) * PH;

  // Smooth quadratic-midpoint paths so the lines read as gentle curves
  // rather than zig-zags. Same shape as the marketing SEOTrendChart.
  const pathFor = (yFn: (v: number) => number, key: "clicks" | "impressions") => {
    const pts = points.map((p, i) => [xAt(i), yFn(p[key])] as const);
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1];
      const [x2, y2] = pts[i];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      d += ` Q ${x1} ${y1} ${mx} ${my}`;
    }
    d += ` T ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
    return d;
  };
  const clicksPath = pathFor(yClicks, "clicks");
  const impsPath = pathFor(yImps, "impressions");

  // Approx path length for the dashoffset trick. SVG would tell us
  // exactly via getTotalLength() at runtime, but a generous overestimate
  // works because the trailing dash is invisible anyway.
  const STROKE_LEN = 1800;

  const colorClicks = "#2563EB"; // brand blue, primary metric
  const colorImps = "#93C5FD"; // light blue, secondary metric

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: 200, display: "block" }}
      >
        <defs>
          <linearGradient id="seo-clicks-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorClicks} stopOpacity="0.18" />
            <stop offset="100%" stopColor={colorClicks} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid — 4 evenly spaced lines, soft warm-grey. */}
        {[0, 1, 2, 3, 4].map((row) => {
          const y = PAD.top + (row / 4) * PH;
          return (
            <line
              key={row}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y}
              y2={y}
              stroke={TOKENS.borderCream}
              strokeWidth={1}
              strokeDasharray={row === 4 ? undefined : "2 4"}
            />
          );
        })}

        {/* Area fill under the primary (clicks) line. */}
        <path
          d={`${clicksPath} L ${xAt(points.length - 1)} ${H - PAD.bottom} L ${xAt(0)} ${H - PAD.bottom} Z`}
          fill="url(#seo-clicks-fill)"
          opacity={drawn ? 1 : 0}
          style={{ transition: "opacity 800ms ease 300ms" }}
        />

        {/* Impressions line — draws in first, lighter weight. */}
        <path
          d={impsPath}
          fill="none"
          stroke={colorImps}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: STROKE_LEN,
            strokeDashoffset: drawn ? 0 : STROKE_LEN,
            transition: "stroke-dashoffset 1100ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />

        {/* Clicks line — primary metric, draws in second. */}
        <path
          d={clicksPath}
          fill="none"
          stroke={colorClicks}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: STROKE_LEN,
            strokeDashoffset: drawn ? 0 : STROKE_LEN,
            transition:
              "stroke-dashoffset 1100ms cubic-bezier(0.22,1,0.36,1) 200ms",
          }}
        />

        {/* X-axis week labels. */}
        {points.map((p, i) => (
          <text
            key={p.wk}
            x={xAt(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fontFamily="var(--font-mono)"
            fill={TOKENS.stone}
            fontWeight={500}
          >
            {p.wk}
          </text>
        ))}

        {/* Left axis (clicks) — 3 ticks. */}
        {[0, 0.5, 1].map((frac) => {
          const v = Math.round(maxClicks * (1 - frac));
          const y = PAD.top + frac * PH;
          return (
            <text
              key={`l-${frac}`}
              x={PAD.left - 8}
              y={y + 3}
              textAnchor="end"
              fontSize="9.5"
              fontFamily="var(--font-mono)"
              fill={TOKENS.stone}
            >
              {v}
            </text>
          );
        })}

        {/* Right axis (impressions) — 3 ticks. */}
        {[0, 0.5, 1].map((frac) => {
          const v = Math.round(maxImps * (1 - frac));
          const y = PAD.top + frac * PH;
          return (
            <text
              key={`r-${frac}`}
              x={W - PAD.right + 8}
              y={y + 3}
              textAnchor="start"
              fontSize="9.5"
              fontFamily="var(--font-mono)"
              fill={TOKENS.stone}
            >
              {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
            </text>
          );
        })}

        {/* Hover hit-targets — one rect per column. Reveal a vertical
            guide + larger dots on the underlying lines when active. */}
        {points.map((p, i) => {
          const cx = xAt(i);
          const colWidth = PW / (points.length - 1);
          const active = hoverIdx === i;
          return (
            <g key={`hit-${p.wk}`}>
              {active ? (
                <line
                  x1={cx}
                  x2={cx}
                  y1={PAD.top}
                  y2={H - PAD.bottom}
                  stroke={colorClicks}
                  strokeOpacity={0.18}
                  strokeWidth={1}
                />
              ) : null}
              <circle
                cx={cx}
                cy={yImps(p.impressions)}
                r={active ? 4 : 0}
                fill="#fff"
                stroke={colorImps}
                strokeWidth={2}
                style={{ transition: "r 160ms ease" }}
              />
              <circle
                cx={cx}
                cy={yClicks(p.clicks)}
                r={active ? 4.5 : 0}
                fill="#fff"
                stroke={colorClicks}
                strokeWidth={2.5}
                style={{ transition: "r 160ms ease" }}
              />
              <rect
                x={cx - colWidth / 2}
                y={0}
                width={colWidth}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() =>
                  setHoverIdx((cur) => (cur === i ? null : cur))
                }
                style={{ cursor: "pointer" }}
              />
            </g>
          );
        })}
      </svg>

      {/* Legend + active-week stat card. The card slides in/out so the
          hover state feels responsive without flickering. */}
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <LegendDot color={colorClicks} label="Clicks" />
          <LegendDot color={colorImps} label="Impressions" />
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            color: hoverIdx !== null ? TOKENS.nearBlack : TOKENS.stone,
            letterSpacing: "0.06em",
            transition: "color 160ms ease",
          }}
        >
          {hoverIdx !== null ? (
            <span>
              {points[hoverIdx].wk} ·{" "}
              <strong style={{ color: colorClicks, fontWeight: 600 }}>
                {points[hoverIdx].clicks} clicks
              </strong>
              {" · "}
              {points[hoverIdx].impressions.toLocaleString()} impressions · pos {points[hoverIdx].position.toFixed(1)}
            </span>
          ) : (
            <span>Hover any week for details</span>
          )}
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          backgroundColor: color,
          display: "inline-block",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10.5px",
          color: TOKENS.stone,
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
    </span>
  );
}
