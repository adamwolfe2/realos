"use client";

import * as React from "react";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import {
  PerformanceOverTime,
  type PerformancePoint,
} from "@/components/portal/dashboard/performance-over-time";
import type {
  ChatbotAnalytics,
  ProspectIntel,
} from "@/lib/chatbot/conversation-analytics";

// ---------------------------------------------------------------------------
// ChatbotPerformancePanel — ONE card, three views, toggled by tabs (Adam,
// 2026-07-29: "more views, not more page"). Everything stays inside the
// same footprint; the tab strip swaps the content region.
//
//   Volume     — conversations/day chart (prior 30d dashed) + KPI row
//   Questions  — what visitors actually type: top opening questions +
//                topic keyword frequency (from conversation-analytics)
//   Prospects  — aggregates over the Haiku-extracted profiles: budgets,
//                room types, move-in timing, competitors, follow-ups
//
// Single brand accent only — bars are primary-blue on muted, matching the
// "Leads by source" rows and the marketing site. No new colors.
// ---------------------------------------------------------------------------

const TABS = ["Volume", "Questions", "Prospects"] as const;
type Tab = (typeof TABS)[number];

export function ChatbotPerformancePanel({
  points,
  d30,
  d7,
  intakes30d,
  d30DeltaPct,
  analytics,
  prospects,
}: {
  points: PerformancePoint[];
  d30: number;
  d7: number;
  intakes30d: number;
  d30DeltaPct: number | null;
  /** Null when the analytics query failed — Volume still renders. */
  analytics: Pick<ChatbotAnalytics, "topKeywords" | "topQuestions" | "totals"> | null;
  prospects: ProspectIntel | null;
}) {
  const [tab, setTab] = React.useState<Tab>("Volume");

  return (
    <section className="ls-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold text-foreground">Performance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tab === "Volume"
              ? "Conversations per day, last 30 days vs the prior 30."
              : tab === "Questions"
                ? "What visitors actually ask — top opening questions and topic frequency."
                : "What the extracted prospect profiles say — budgets, timing, room types."}
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Performance view"
          className="inline-flex rounded-[2px] border border-border overflow-hidden"
        >
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 text-[12px] font-semibold transition-colors border-r border-border last:border-r-0 ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Fixed-ish content region so tab switches don't reflow the page. */}
      <div className="min-h-[360px]">
        {tab === "Volume" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiTile
                density="dense"
                label="Conversations · 30d"
                value={d30.toLocaleString()}
                delta={
                  d30DeltaPct != null
                    ? {
                        value: `${d30DeltaPct >= 0 ? "+" : ""}${d30DeltaPct}%`,
                        trend:
                          d30DeltaPct > 0 ? "up" : d30DeltaPct < 0 ? "down" : "flat",
                      }
                    : undefined
                }
                hint="vs prior 30 days"
              />
              <KpiTile
                density="dense"
                label="Conversations · 7d"
                value={d7.toLocaleString()}
              />
              <KpiTile
                density="dense"
                label="Leads captured · 30d"
                value={intakes30d.toLocaleString()}
              />
              <KpiTile
                density="dense"
                label="Capture rate · 30d"
                value={d30 > 0 ? `${Math.round((intakes30d / d30) * 100)}%` : "—"}
                hint="conversations that left contact info"
              />
            </div>
            <PerformanceOverTime points={points} compare />
          </div>
        ) : null}

        {tab === "Questions" ? (
          !analytics ||
          (analytics.topQuestions.length === 0 && analytics.topKeywords.length === 0) ? (
            <EmptyNote text="Question analytics fill out as conversations come in." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
              <div>
                <SubLabel>Top opening questions</SubLabel>
                <ul className="mt-2 divide-y divide-border/50">
                  {analytics.topQuestions.slice(0, 8).map((q) => (
                    <li
                      key={q.question}
                      className="flex items-baseline justify-between gap-3 py-1.5"
                    >
                      <span className="min-w-0 truncate text-[12.5px] text-foreground">
                        &ldquo;{q.question}&rdquo;
                      </span>
                      <span className="ls-metric shrink-0 text-[11px] text-muted-foreground">
                        ×{q.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <SubLabel>What they talk about</SubLabel>
                <ul className="mt-2 space-y-2">
                  {analytics.topKeywords.slice(0, 10).map((k, i, arr) => {
                    const max = arr[0]?.count ?? 1;
                    return (
                      <li key={k.term} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 truncate text-[12.5px] text-foreground">
                          {k.term}
                        </span>
                        <span className="h-2 flex-1 overflow-hidden rounded-[2px] bg-muted">
                          <span
                            className="block h-full rounded-[2px] bg-primary/80"
                            style={{ width: `${Math.max(6, (k.count / max) * 100)}%` }}
                          />
                        </span>
                        <span className="ls-metric w-7 shrink-0 text-right text-[11px] text-muted-foreground">
                          {k.count}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Counted once per conversation, {analytics.totals.conversations.toLocaleString()}{" "}
                  conversations analyzed.
                </p>
              </div>
            </div>
          )
        ) : null}

        {tab === "Prospects" ? (
          !prospects || prospects.profiles === 0 ? (
            <EmptyNote text="Prospect intel appears once conversations produce extracted profiles." />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiTile
                  density="dense"
                  label="Profiles extracted · 30d"
                  value={prospects.profiles.toLocaleString()}
                />
                <KpiTile
                  density="dense"
                  label="Median budget"
                  value={
                    prospects.medianBudget != null
                      ? `$${prospects.medianBudget.toLocaleString()}/mo`
                      : "—"
                  }
                />
                <KpiTile
                  density="dense"
                  label="Follow-ups flagged"
                  value={prospects.followUpsNeeded.toLocaleString()}
                  hint="prospects the bot marked worth a human reply"
                />
                <KpiTile
                  density="dense"
                  label="Prospect temperature"
                  value={`${prospects.sentiment.positive}↑ ${prospects.sentiment.neutral}· ${prospects.sentiment.negative}↓`}
                  hint="hot+warm / lukewarm / cold"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5">
                <DistList title="Room types requested" rows={prospects.roomTypes} />
                <DistList title="Move-in timing" rows={prospects.moveIn} />
                <DistList title="Also considering" rows={prospects.competitors} />
              </div>
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </h3>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="flex h-[300px] items-center justify-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function DistList({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  const max = rows[0]?.count ?? 1;
  return (
    <div>
      <SubLabel>{title}</SubLabel>
      {rows.length === 0 ? (
        <p className="mt-2 text-[12px] text-muted-foreground">
          Nothing mentioned yet.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-[12.5px] capitalize text-foreground">
                {r.label}
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-[2px] bg-muted">
                <span
                  className="block h-full rounded-[2px] bg-primary/80"
                  style={{ width: `${Math.max(6, (r.count / max) * 100)}%` }}
                />
              </span>
              <span className="ls-metric w-7 shrink-0 text-right text-[11px] text-muted-foreground">
                {r.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
