"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { MarketplaceLeadPropertyType } from "@prisma/client";
import { LeadAvatar } from "./initials-avatar";

// ---------------------------------------------------------------------------
// MarketplaceLive — production version of the marketing-page LeadMarketplace
// component, wired to GET /api/marketplace/leads.
//
// Differences from components/platform/artifacts/lead-marketplace.tsx:
//   - Pulls real BrowseLead rows from the API, with debounced refetch on
//     filter changes.
//   - "Markets" dropdown is populated from the API response.
//   - "Buy lead" routes through the (Phase 2) Stripe checkout endpoint;
//     for now it surfaces a "Sign in to purchase" prompt.
//   - Empty state offers a stream subscription form instead of a static CTA.
//   - Uses real photos when present and falls back to initials avatars.
// ---------------------------------------------------------------------------

type ApiLead = {
  id: string;
  initials: string;
  displayName: string;
  age: number | null;
  photoUrl: string | null;
  market: string;
  propertyType: MarketplaceLeadPropertyType;
  intentScore: number;
  budgetLabel: string | null;
  signal: string | null;
  timeline: string | null;
  priceCents: number;
};

type ApiResponse = {
  leads: ApiLead[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  markets: string[];
};

type PropertyType = "ALL" | MarketplaceLeadPropertyType;

const ALL_MARKETS_LABEL = "All markets";
const TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "RENTAL", label: "Rental" },
  { value: "SALE", label: "Sale" },
  { value: "INVESTMENT", label: "Investment" },
  { value: "COMMERCIAL", label: "Commercial" },
];
const PRICE_BANDS = [
  { label: "Any",          min: undefined,  max: undefined },
  { label: "Under $50",    min: 0,          max: 5000 },
  { label: "$50–$100",     min: 5000,       max: 10000 },
  { label: "$100+",        min: 10000,      max: undefined },
];

const ACCENT = "#2563EB";
const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const SLATE = "#64748B";
const BORDER = "#E2E8F0";
const PARCHMENT = "#F1F5F9";

export function MarketplaceLive() {
  const [market, setMarket] = useState(ALL_MARKETS_LABEL);
  const [markets, setMarkets] = useState<string[]>([]);
  const [propertyType, setPropertyType] = useState<PropertyType>("ALL");
  const [minIntent, setMinIntent] = useState(70);
  const [priceBandLabel, setPriceBandLabel] = useState(PRICE_BANDS[0].label);

  const [leads, setLeads] = useState<ApiLead[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce + AbortController so rapid filter changes don't pile up requests.
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const band = PRICE_BANDS.find((b) => b.label === priceBandLabel);
        const params = new URLSearchParams();
        if (market !== ALL_MARKETS_LABEL) params.set("market", market);
        if (propertyType !== "ALL") params.set("propertyType", propertyType);
        params.set("minIntent", String(minIntent));
        if (band?.min != null) params.set("minPriceCents", String(band.min));
        if (band?.max != null) params.set("maxPriceCents", String(band.max));
        const res = await fetch(`/api/marketplace/leads?${params.toString()}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ApiResponse;
        setLeads(data.leads);
        setTotal(data.total);
        if (data.markets?.length) {
          setMarkets(data.markets);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("marketplace fetch failed", err);
        setError("Could not load leads. Try again in a moment.");
        setLeads([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [market, propertyType, minIntent, priceBandLabel]);

  const marketOptions = useMemo(
    () => [ALL_MARKETS_LABEL, ...markets],
    [markets],
  );

  return (
    <div
      className="w-full"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: `0 0 0 1px ${BORDER}, 0 24px 70px rgba(30, 42, 58,0.10)`,
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 px-5 md:px-6 py-3.5"
        style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: PARCHMENT }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block flex-shrink-0"
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#10B981",
              boxShadow: "0 0 0 4px rgba(16,185,129,0.18)",
              animation: "liveDot 1.6s ease-in-out infinite",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10.5px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: SLATE,
              fontWeight: 600,
            }}
          >
            Live marketplace · refreshed weekly
          </span>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: MUTED,
            fontWeight: 600,
          }}
        >
          {loading ? "Loading…" : `${total} available`}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr]">
        <aside
          className="p-5 md:p-6"
          style={{
            borderRight: `1px solid ${BORDER}`,
            backgroundColor: "#FCFCFD",
          }}
        >
          <FilterGroup label="Market">
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="filter-select"
            >
              {marketOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="Property type">
            <div className="flex flex-wrap gap-1.5">
              {TYPE_OPTIONS.map((t) => (
                <FilterPill
                  key={t.value}
                  active={propertyType === t.value}
                  onClick={() => setPropertyType(t.value)}
                  label={t.label}
                />
              ))}
            </div>
          </FilterGroup>

          <FilterGroup label={`Intent ≥ ${minIntent}`}>
            <input
              type="range"
              min={50}
              max={95}
              step={1}
              value={minIntent}
              onChange={(e) => setMinIntent(Number(e.target.value))}
              style={{ width: "100%", accentColor: ACCENT }}
            />
            <div
              className="flex justify-between mt-1.5"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                color: MUTED,
                letterSpacing: "0.08em",
              }}
            >
              <span>50</span>
              <span>95</span>
            </div>
          </FilterGroup>

          <FilterGroup label="Price per lead">
            <div className="flex flex-wrap gap-1.5">
              {PRICE_BANDS.map((b) => (
                <FilterPill
                  key={b.label}
                  active={priceBandLabel === b.label}
                  onClick={() => setPriceBandLabel(b.label)}
                  label={b.label}
                />
              ))}
            </div>
          </FilterGroup>

          <div
            className="mt-6 p-3 rounded-md"
            style={{
              backgroundColor: PARCHMENT,
              border: `1px dashed ${BORDER}`,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9.5px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: ACCENT,
                fontWeight: 700,
              }}
            >
              Stream subscription
            </p>
            <p
              className="mt-1.5"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                color: SLATE,
                lineHeight: 1.45,
              }}
            >
              Auto-purchase every new lead matching these filters. Delivered
              to your CRM by webhook within seconds of scoring.
            </p>
          </div>
        </aside>

        <div className="p-5 md:p-6">
          {leads === null && loading ? (
            <LoadingGrid />
          ) : error ? (
            <ErrorState message={error} />
          ) : !leads || leads.length === 0 ? (
            <EmptyState
              hasActiveFilters={
                market !== ALL_MARKETS_LABEL ||
                propertyType !== "ALL" ||
                minIntent > 60 ||
                priceBandLabel !== PRICE_BANDS[0].label
              }
              onReset={() => {
                setMarket(ALL_MARKETS_LABEL);
                setPropertyType("ALL");
                setMinIntent(60);
                setPriceBandLabel(PRICE_BANDS[0].label);
              }}
            />
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {leads.slice(0, 6).map((l) => (
                <LeadCardView key={l.id} lead={l} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes liveDot {
          0%, 100% { transform: scale(1);   opacity: 1;   }
          50%      { transform: scale(1.3); opacity: 0.55;}
        }
        .filter-select {
          width: 100%;
          appearance: none;
          background-color: #fff;
          border: 1px solid ${BORDER};
          border-radius: 8px;
          padding: 8px 12px;
          font-family: var(--font-sans);
          font-size: 13px;
          color: ${INK};
          font-weight: 500;
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2394A3B8' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 28px;
        }
      `}</style>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <p
        className="mb-2"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: MUTED,
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "12px",
        fontWeight: 500,
        padding: "5px 10px",
        borderRadius: "999px",
        border: `1px solid ${active ? ACCENT : BORDER}`,
        backgroundColor: active ? ACCENT : "#fff",
        color: active ? "#fff" : INK,
        cursor: "pointer",
        transition: "all 180ms ease",
      }}
    >
      {label}
    </button>
  );
}

function LeadCardView({ lead }: { lead: ApiLead }) {
  return (
    <li
      className="p-4 h-full"
      style={{
        backgroundColor: "#fff",
        borderRadius: "12px",
        boxShadow: `0 0 0 1px ${BORDER}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <LeadAvatar
            mode="blurred"
            photoUrl={lead.photoUrl}
            displayName={lead.displayName}
            seed={lead.id}
            size={36}
          />
          <div className="min-w-0">
            <p
              className="truncate"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                color: INK,
                fontWeight: 600,
              }}
            >
              {lead.displayName}
              {lead.age != null ? ` · ${lead.age}` : ""}
            </p>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.08em",
                color: MUTED,
                marginTop: "2px",
                fontWeight: 500,
              }}
            >
              {lead.id.slice(-8).toUpperCase()} · {lead.market}
            </p>
          </div>
        </div>
        <IntentDot value={lead.intentScore} />
      </div>

      <dl className="mt-3 space-y-1.5">
        <Row label="Type" value={prettyType(lead.propertyType)} />
        {lead.budgetLabel && <Row label="Budget" value={lead.budgetLabel} />}
        {lead.signal && <Row label="Signal" value={lead.signal} />}
        {lead.timeline && <Row label="Timeline" value={lead.timeline} strong />}
      </dl>

      <div
        className="mt-3 pt-3 flex items-center justify-between gap-3"
        style={{ borderTop: `1px solid ${BORDER}` }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "20px",
            color: INK,
            fontWeight: 500,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          ${(lead.priceCents / 100).toFixed(0)}
        </span>
        <button
          type="button"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            fontWeight: 600,
            padding: "6px 12px",
            borderRadius: "8px",
            backgroundColor: ACCENT,
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
          onClick={() => {
            window.location.href = `/marketplace/${lead.id}`;
          }}
        >
          Buy lead →
        </button>
      </div>
    </li>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9.5px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: MUTED,
          fontWeight: 600,
        }}
      >
        {label}
      </dt>
      <dd
        className="truncate"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: strong ? "12.5px" : "12px",
          color: strong ? ACCENT : INK,
          fontWeight: strong ? 600 : 500,
          maxWidth: "65%",
          textAlign: "right",
        }}
      >
        {value}
      </dd>
    </div>
  );
}

function IntentDot({ value }: { value: number }) {
  const tone =
    value >= 85
      ? { bg: "rgba(16,185,129,0.14)", fg: "#059669" }
      : value >= 75
        ? { bg: "rgba(37,99,235,0.14)", fg: ACCENT }
        : { bg: "rgba(245,158,11,0.14)", fg: "#D97706" };
  return (
    <span
      className="inline-flex items-center gap-1 flex-shrink-0"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        color: tone.fg,
        backgroundColor: tone.bg,
        padding: "3px 7px",
        borderRadius: "999px",
        fontWeight: 700,
        letterSpacing: "0.04em",
      }}
    >
      <span style={{ fontFamily: "var(--font-display)", fontSize: "12px" }}>{value}</span>
      <span style={{ opacity: 0.75 }}>INTENT</span>
    </span>
  );
}

function LoadingGrid() {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          style={{
            backgroundColor: PARCHMENT,
            borderRadius: "12px",
            border: `1px dashed ${BORDER}`,
            minHeight: "180px",
          }}
        />
      ))}
    </ul>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-10 px-6 text-center"
      style={{
        backgroundColor: PARCHMENT,
        borderRadius: "12px",
        border: `1px dashed ${BORDER}`,
        minHeight: "240px",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "15px",
          color: INK,
          fontWeight: 500,
        }}
      >
        {message}
      </p>
    </div>
  );
}

function EmptyState({
  hasActiveFilters = false,
  onReset,
}: {
  hasActiveFilters?: boolean;
  onReset?: () => void;
} = {}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-10 px-6 text-center"
      style={{
        backgroundColor: PARCHMENT,
        borderRadius: "12px",
        border: `1px dashed ${BORDER}`,
        minHeight: "260px",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "16px",
          color: INK,
          fontWeight: 500,
        }}
      >
        {hasActiveFilters
          ? "No leads match these filters right now."
          : "The marketplace is being refreshed."}
      </p>
      <p
        className="mt-2 max-w-[340px]"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          color: SLATE,
          lineHeight: 1.5,
        }}
      >
        {hasActiveFilters
          ? "Reset to see every available lead, or subscribe to this filter set as a stream — every matching lead will be delivered the moment one scores."
          : "New leads land every Monday morning. Check back shortly or subscribe to a stream to get notified."}
      </p>
      {hasActiveFilters && onReset ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 inline-flex items-center"
          style={{
            padding: "8px 14px",
            borderRadius: "8px",
            backgroundColor: INK,
            color: "#fff",
            fontFamily: "var(--font-sans)",
            fontSize: "12.5px",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          Reset filters
        </button>
      ) : null}
    </div>
  );
}

function prettyType(t: MarketplaceLeadPropertyType): string {
  return t.charAt(0) + t.slice(1).toLowerCase();
}
