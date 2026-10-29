import Link from "next/link";
import { ArrowRight, BookOpenCheck, Bot, CheckCircle2, Moon } from "lucide-react";
import { RecommendationActions } from "@/app/portal/conversations/insights/recommendation-actions";
import { Logo, Pill, ago, type Tone } from "./kit";

// The agent's own log: what it read, what it noticed, what it drafted.
// Each step is a real row (conversations, learning cases, suggestions,
// insights, applied fixes), newest first.

export type Step = {
  key: string;
  at: Date;
  kind: "answered" | "drafted" | "site" | "flag" | "applied" | "run";
  title: string;
  property?: string | null;
  thought?: string;
  tag?: { text: string; tone: Tone };
  logo?: string;
  action?: { id: string; kind: "knowledge" | "site" } | { href: string };
};

const VERB: Record<Step["kind"], string> = {
  answered: "Answered",
  drafted: "Drafted a chatbot fix",
  site: "Suggested a website change",
  flag: "Flagged",
  applied: "Applied",
  run: "Learning run",
};

function Mark({ step }: { step: Step }) {
  const box = "grid h-7 w-7 shrink-0 place-items-center rounded-full ring-4 ring-white";
  if (step.logo) return <span className={`${box} bg-white border border-[var(--t-border)]`}><Logo slug={step.logo} size={13} /></span>;
  if (step.kind === "applied") return <span className={`${box} bg-white border border-[var(--t-border)] text-[#16a34a]`}><CheckCircle2 className="h-3.5 w-3.5" /></span>;
  if (step.kind === "run") return <span className={`${box} bg-white border border-[var(--t-border)] text-[var(--t-muted)]`}><Moon className="h-3.5 w-3.5" /></span>;
  if (step.kind === "drafted") return <span className={`${box} bg-white border border-[var(--t-border)] text-[var(--t-accent)]`}><BookOpenCheck className="h-3.5 w-3.5" /></span>;
  return <span className={`${box} bg-white border border-[var(--t-border)] text-[var(--t-accent)]`}><Bot className="h-3.5 w-3.5" /></span>;
}

export function AgentTrace({ steps, now }: { steps: Step[]; now: number }) {
  if (!steps.length) {
    return <p className="px-4 py-6 text-[13.5px] text-[var(--t-muted)]">The agent logs every step here once the first conversations come in.</p>;
  }
  return (
    <ol className="relative px-4 py-3">
      <span aria-hidden className="absolute bottom-6 left-[29px] top-6 w-px bg-[var(--t-border)]" />
      {steps.map((s, i) => (
        <li key={s.key} className="ls-step relative flex gap-3 py-2.5" style={{ animationDelay: `${i * 70}ms` }}>
          <Mark step={s} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13.5px] leading-snug text-[var(--t-ink)]">
                <span className="text-[var(--t-muted)]">{VERB[s.kind]}</span>{" "}
                <span className="font-medium">{s.title}</span>
                {s.property ? <span className="text-[var(--t-muted)]"> · {s.property}</span> : null}
              </p>
              <span className="flex shrink-0 items-center gap-2">
                {s.tag ? <Pill tone={s.tag.tone}>{s.tag.text}</Pill> : null}
                <span className="w-7 text-right text-[12px] tabular-nums text-[var(--t-muted)]">{ago(s.at, now)}</span>
              </span>
            </div>
            {s.thought ? (
              <p className="mt-1.5 border-l-2 border-[var(--t-border)] pl-3 py-0.5 text-[12.5px] leading-relaxed text-[var(--t-text)]">{s.thought}</p>
            ) : null}
            {s.action && "id" in s.action ? <RecommendationActions id={s.action.id} kind={s.action.kind} /> : null}
            {s.action && "href" in s.action ? (
              <Link href={s.action.href} className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--t-accent)] hover:underline">
                Open <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
