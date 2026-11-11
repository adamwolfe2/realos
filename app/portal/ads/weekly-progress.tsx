"use client";

import dynamic from "next/dynamic";
import { Panel } from "@/components/portal/overview/kit";
import type { WeekRow } from "@/lib/integrations/ads-insights-math";

const WeeklyFunnelChart = dynamic(() => import("./weekly-funnel-chart").then((m) => m.WeeklyFunnelChart), {
  ssr: false,
  loading: () => <div className="h-72" />,
});

export function WeeklyProgress({ weeks }: { weeks: WeekRow[] }) {
  if (weeks.length === 0) return null;
  return (
    <Panel title="Week by week" aside="By the week the lead came in">
      <WeeklyFunnelChart weeks={weeks} />
    </Panel>
  );
}
