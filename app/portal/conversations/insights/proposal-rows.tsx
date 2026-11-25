import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, ExternalLink, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeHttpUrl } from "@/lib/safe-url";
import { METRIC_LABEL, change, formatMetric, type Proposal } from "@/lib/self-improve/proposal";
import type { ProposalImpact } from "@/lib/self-improve/metrics";
import { AnswerActions, PopupActions } from "./proposal-actions";

// Self-improve proposals inside the Suggested fixes queue: evidence, the
// proposed change, the metric it should move, and Approve / Edit / Dismiss.

/** The bot's reply that shows the gap, with a link to the chat. */
function BotSaid({ items }: { items: Proposal["evidence"] }) {
  const e = items[0];
  if (!e?.reply) return null;
  return (
    <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
      Bot said: &ldquo;{e.reply}&rdquo;
      {e.conversationId ? (
        <>
          {" "}
          <Link href={`/portal/conversations?c=${e.conversationId}`} className="font-medium text-primary hover:underline">
            Open chat
          </Link>
        </>
      ) : null}
    </p>
  );
}

/** "Should lower: chats the bot couldn't answer · now 4 of 39 chats (28 days)". */
function MetricNow({ p }: { p: Proposal }) {
  const m = METRIC_LABEL[p.metric.key];
  return (
    <p className="mt-1.5 text-[12px] text-muted-foreground">
      Should {m.lowerIsBetter ? "lower" : "raise"} {m.label.toLowerCase()}: at proposal{" "}
      <span className="tabular-nums text-foreground">{formatMetric(p.metric.key, p.metric.value, p.metric.of)}</span> ({p.metric.days}d)
    </p>
  );
}

export function AnswerProposalRow({ id, p, draft, property, count }: { id: string; p: Proposal; draft: string; property: string | null; count: number }) {
  return (
    <li className="grid gap-x-6 gap-y-1 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
          {property ? <span className="font-medium text-foreground">{property}</span> : null}
          <span className="tabular-nums">{count} chat{count === 1 ? "" : "s"}</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              p.needsAnswer ? "bg-[#fef3c7] text-[#92400e]" : "bg-[var(--t-accent-soft)] text-[var(--t-accent)]",
            )}
          >
            {p.needsAnswer ? "Needs SG's answer" : "Drafted from the knowledge base"}
          </span>
        </div>
        <p className="mt-1.5 text-[14px] font-medium leading-snug text-foreground">&ldquo;{p.question}&rdquo;</p>
        {p.needsAnswer ? <p className="mt-0.5 text-[12.5px] text-muted-foreground">Missing: {p.askSg}</p> : null}
        {p.fairHousing ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-[#92400e]">
            <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {p.fairHousing}
          </p>
        ) : null}
        <BotSaid items={p.evidence} />
        <MetricNow p={p} />
      </div>
      <div className="min-w-0">
        {!p.needsAnswer ? (
          <>
            <p className="text-[13px] leading-5 text-foreground">{draft}</p>
            {p.grounding ? <p className="mt-1 line-clamp-1 text-[11.5px] text-muted-foreground" title={p.grounding}>From the knowledge base: {p.grounding}</p> : null}
          </>
        ) : null}
        <AnswerActions id={id} draft={draft} needsAnswer={Boolean(p.needsAnswer)} />
      </div>
    </li>
  );
}

export function PopupProposalRow({ id, p, why, property }: { id: string; p: Proposal; why: string; property: string | null }) {
  const pp = p.popup!;
  const rows: [string, string, string][] = [
    ["Headline", pp.current.headline, pp.proposed.headline],
    ["Body", pp.current.body, pp.proposed.body],
    ["Button", pp.current.ctaText, pp.proposed.ctaText],
    ["Shows after", `${pp.current.delaySeconds}s`, `${pp.proposed.delaySeconds}s`],
  ];
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
        {property ? <span className="font-medium text-foreground">{property}</span> : null}
        <span>Pop-up</span>
      </div>
      <p className="mt-1 text-[13px] text-foreground">{p.why}</p>
      <table className="mt-2 w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[11.5px] text-muted-foreground">
            <th className="w-[92px] py-1 font-normal" />
            <th className="py-1 pr-3 font-normal">Now</th>
            <th className="py-1 font-normal">Proposed</th>
          </tr>
        </thead>
        <tbody className="align-top">
          {rows.map(([k, a, b]) => (
            <tr key={k} className="border-t border-border">
              <td className="py-1.5 text-muted-foreground">{k}</td>
              <td className="py-1.5 pr-3 text-muted-foreground">{a}</td>
              <td className={cn("py-1.5", a !== b ? "font-medium text-foreground" : "text-muted-foreground")}>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[12px] text-muted-foreground">{why}</p>
      <MetricNow p={p} />
      <PopupActions id={id} proposed={pp.proposed} />
    </li>
  );
}

/** Website change: text only, never an automatic code change. */
export function SiteProposalRow({ p, title, body, property, actions }: { p: Proposal; title: string; body: string; property: string | null; actions: React.ReactNode }) {
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
        {property ? <span className="font-medium text-foreground">{property}</span> : null}
        <span>{p.why}</span>
      </div>
      <p className="mt-1 text-[13px] font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 whitespace-pre-line text-[13px] leading-5 text-foreground">{body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 text-[12px] text-muted-foreground">
        <span>Proposal only: the site team makes the change.</span>
        {safeHttpUrl(p.link) ? (
          <a href={safeHttpUrl(p.link)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            Open site <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
      <MetricNow p={p} />
      {actions}
    </li>
  );
}

/** Before/after once approved: equal windows either side of approval. */
export function ProposalImpactLine({ impact, appliedAt }: { impact: ProposalImpact | null; appliedAt: Date | null }) {
  if (!impact) return null;
  if (impact.kind === "too_early") {
    return (
      <p className="mt-1.5 text-[12px] text-muted-foreground">
        Measuring · live {impact.daysLive} day{impact.daysLive === 1 ? "" : "s"}, first read after 7
      </p>
    );
  }
  const c = change(impact);
  const m = METRIC_LABEL[impact.key];
  return (
    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px]">
      <span className="text-muted-foreground">{m.label}:</span>
      <span className="font-semibold tabular-nums text-foreground">
        {formatMetric(impact.key, impact.before.value, impact.before.of)} <ArrowRight className="inline h-3 w-3" /> {formatMetric(impact.key, impact.after.value, impact.after.of)}
      </span>
      {c.pct ? <span className={cn("font-medium tabular-nums", c.better ? "text-[#15803d]" : "text-[#b91c1c]")}>{c.pct > 0 ? "+" : ""}{c.pct}%</span> : null}
      <span className="text-muted-foreground tabular-nums">
        {impact.days}d before vs {impact.days}d since{appliedAt ? ` ${format(appliedAt, "MMM d")}` : ""}
      </span>
    </div>
  );
}
