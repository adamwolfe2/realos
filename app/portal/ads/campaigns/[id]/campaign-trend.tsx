"use client";

import dynamic from "next/dynamic";
import type { AdsTrendPoint } from "../../ads-trend-chart";

// Same lazy-loaded chart as /portal/ads, scoped to one campaign.
const AdsTrendChart = dynamic(() => import("../../ads-trend-chart").then((m) => m.AdsTrendChart), {
  ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center text-xs text-[var(--t-muted)]">Loading chart…</div>,
});

const formatCents = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function CampaignTrend({ points }: { points: AdsTrendPoint[] }) {
  return <AdsTrendChart series={points} formatCents={formatCents} />;
}
