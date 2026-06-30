import * as React from "react";
import { centsToUsdShort } from "@/lib/properties/queries";

// ---------------------------------------------------------------------------
// Marketing section — promoted from sidebar to a main-column block per
// Norman feedback (issue #75). Renders four data-backed marketing
// signals over a 28-day window plus a conversion funnel mini-chart.
// Empties out cleanly when the data source isn't connected (chatbot
// off → "Connect" callout instead of "0 conversations").
// ---------------------------------------------------------------------------

export function MarketingSection({
  propertyId,
  organicSessions28d,
  organicMapped,
  adSpendCents28d,
  chatbotConversations28d,
  leads28d,
  tours28d,
  applications28d,
  hasAdsModule,
  chatbotEnabled,
  pixelConnected,
  availableUnits,
  totalUnits,
}: {
  propertyId: string;
  organicSessions28d: number | null;
  organicMapped: boolean;
  adSpendCents28d: number;
  chatbotConversations28d: number;
  leads28d: number;
  tours28d: number;
  applications28d: number;
  hasAdsModule: boolean;
  chatbotEnabled: boolean;
  pixelConnected: boolean;
  /** Inventory fact surfaced in the header. Picked up from the parent
   *  so deleting the standalone KPI strip didn't lose the available-unit
   *  signal. */
  availableUnits?: number;
  totalUnits?: number | null;
}) {
  void pixelConnected;
  // Conversion: leads / organic sessions. We use organic sessions as
  // the denominator (the audience the operator is actually responsible
  // for marketing to) rather than total visitors — paid sessions are
  // expected to convert and skew the ratio. Capped at 100% defensively.
  const conversionPct =
    organicSessions28d && organicSessions28d > 0
      ? Math.min(100, Math.round((leads28d / organicSessions28d) * 100))
      : null;

  type Metric = {
    label: string;
    value: React.ReactNode;
    hint: string;
    cta?: { label: string; href: string };
  };
  const metrics: Metric[] = [];

  metrics.push({
    label: "Organic sessions (28d)",
    value: organicMapped && organicSessions28d != null
      ? organicSessions28d.toLocaleString()
      : <DimZero />,
    hint: organicMapped
      ? organicSessions28d && organicSessions28d > 0
        ? "From GA4 / GSC matched URLs"
        : "GA4 connected, no sessions yet"
      : "Map a domain to surface organic traffic",
    cta: organicMapped
      ? undefined
      : { label: "Connect GA4", href: "/portal/connect" },
  });

  metrics.push({
    label: "Chatbot conversations (28d)",
    value: chatbotEnabled
      ? chatbotConversations28d > 0
        ? chatbotConversations28d.toLocaleString()
        : <DimZero />
      : <DimZero />,
    hint: chatbotEnabled
      ? chatbotConversations28d > 0
        ? "On-site capture"
        : "First conversation lands here"
      : "Chatbot off",
    cta: chatbotEnabled
      ? undefined
      : { label: "Enable chatbot", href: "/portal/chatbot" },
  });

  metrics.push({
    label: "Ad spend (28d)",
    value: hasAdsModule
      ? adSpendCents28d > 0
        ? centsToUsdShort(adSpendCents28d)
        : <DimZero />
      : <DimZero />,
    hint: hasAdsModule
      ? adSpendCents28d > 0
        ? `${leads28d > 0 ? `${centsToUsdShort(Math.round(adSpendCents28d / leads28d))}/lead` : "No leads attributed"}`
        : "No spend in window"
      : "Ad modules off",
    cta: hasAdsModule
      ? undefined
      : { label: "Connect ads", href: "/portal/connect" },
  });

  // Conversion rate tile only renders when we can compute it. The
  // pre-cleanup behavior pushed a "Conversion rate — Map a domain
  // first" tile that was always dim-em-dashed on tenants without
  // organic traffic, adding to the wall-of-zero feel. Drop it; the
  // organic-sessions tile already carries the GA4 CTA when needed.
  if (conversionPct != null) {
    metrics.push({
      label: "Conversion rate",
      value: `${conversionPct}%`,
      hint: `${leads28d} ${leads28d === 1 ? "lead" : "leads"} from ${
        organicSessions28d?.toLocaleString() ?? 0
      } sessions`,
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <header className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Last 28 days
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            Marketing &amp; pipeline
          </h3>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Inventory fact — surfaced here after the standalone "Available
              units" KpiTile was removed. Reads as a small contextual chip
              next to the section CTA rather than another full tile. */}
          {totalUnits != null && totalUnits > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                aria-hidden="true"
                className="inline-block h-1 w-1 rounded-full bg-primary/50"
              />
              <span className="tabular-nums font-semibold text-foreground">
                {availableUnits ?? 0}
              </span>
              <span>available to lease · {totalUnits.toLocaleString()} units</span>
            </span>
          ) : null}
          <a
            href={`/portal/properties/${propertyId}?tab=traffic`}
            className="text-[11.5px] font-semibold text-primary hover:underline whitespace-nowrap"
          >
            Open traffic →
          </a>
        </div>
      </header>

      {(() => {
        // Pattern #2 empty-state collapse — when every tile is a
        // DimZero placeholder (rendered as a JSX element rather than a
        // string), the 4-tile row reads as broken product. Partition
        // tiles into live (string values) vs dim, and either render
        // only the live ones or — if nothing is live — collapse the
        // whole grid into one focused "no marketing signal" card.
        const liveMetrics = metrics.filter((m) => typeof m.value !== "object");
        if (liveMetrics.length === 0) {
          return (
            <div className="rounded-lg border border-dashed border-border bg-muted/10 p-4 text-center">
              <p className="text-[12px] font-semibold text-foreground">
                No marketing signal yet
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground leading-snug max-w-sm mx-auto">
                Tiles populate the moment GA4, the chatbot, or an ad
                module starts reporting for this property.
              </p>
              <a
                href="/portal/connect"
                className="mt-2 inline-flex text-[11.5px] font-semibold text-primary hover:underline"
              >
                Open integrations →
              </a>
            </div>
          );
        }
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {liveMetrics.map((m) => (
              <div
                key={m.label}
                className="rounded-lg border border-border bg-muted/20 p-3 min-w-0"
              >
                <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground truncate">
                  {m.label}
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground tabular-nums leading-none">
                  {m.value}
                </p>
                <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
                  {m.hint}
                </p>
                {m.cta ? (
                  <a
                    href={m.cta.href}
                    className="mt-2 inline-flex text-[11px] font-semibold text-primary hover:underline"
                  >
                    {m.cta.label} →
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Funnel mini — sessions → leads → tours → applications.
          Hidden when there's no data in any stage so we don't render an
          empty rail. */}
      {leads28d > 0 || tours28d > 0 || applications28d > 0 ? (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground mb-2">
            Funnel
          </p>
          <FunnelMini
            stages={[
              {
                label: "Organic sessions",
                value: organicSessions28d ?? 0,
              },
              { label: "Leads", value: leads28d },
              { label: "Tours", value: tours28d },
              { label: "Applications", value: applications28d },
            ]}
          />
        </div>
      ) : null}
    </section>
  );
}

function FunnelMini({
  stages,
}: {
  stages: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <ul className="space-y-1.5">
      {stages.map((s) => {
        const pct = Math.round((s.value / max) * 100);
        return (
          <li key={s.label} className="grid grid-cols-[140px_1fr_auto] items-center gap-3 min-w-0">
            <span className="text-[11.5px] text-muted-foreground truncate">
              {s.label}
            </span>
            <span className="relative h-2 rounded-full bg-muted overflow-hidden">
              <span
                className="absolute inset-y-0 left-0 bg-primary/60 rounded-full"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-foreground shrink-0">
              {s.value.toLocaleString()}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Sparse-data primitives.
// ---------------------------------------------------------------------------

function DimZero() {
  return <span className="text-muted-foreground/40 tabular-nums">—</span>;
}
