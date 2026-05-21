import { ArrowUp, ArrowDown, Award, AlertCircle, Users } from "lucide-react";

type WeeklyChange =
  | {
      kind: "rank_up";
      query: string;
      fromRank: number;
      toRank: number;
      change: number;
    }
  | {
      kind: "rank_down";
      query: string;
      fromRank: number;
      toRank: number;
      change: number;
    }
  | {
      kind: "entered_top_10";
      query: string;
      rank: number;
    }
  | {
      kind: "fell_out_top_10";
      query: string;
      lastRank: number;
    }
  | {
      kind: "new_competitor_citation";
      competitor: string;
      prompt: string;
    };

type Props = {
  changes: WeeklyChange[];
};

// ---------------------------------------------------------------------------
// WeeklyChangesPanel — surfaces the meaningful week-over-week deltas
// operators want to see at a glance. Each row has a semantic icon +
// color (green for wins, amber for losses, blue for competitor signals)
// so the panel scans in two seconds.
//
// Server component — no client JS. Hidden when there are no changes.
// ---------------------------------------------------------------------------
export function WeeklyChangesPanel({ changes }: Props) {
  if (changes.length === 0) return null;

  const wins = changes.filter(
    (c) => c.kind === "rank_up" || c.kind === "entered_top_10",
  );
  const losses = changes.filter(
    (c) => c.kind === "rank_down" || c.kind === "fell_out_top_10",
  );
  const competitors = changes.filter(
    (c) => c.kind === "new_competitor_citation",
  );

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60">
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
            This week
          </p>
          <h3 className="text-sm font-semibold text-foreground mt-0.5">
            What changed in the last 7 days
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
          {wins.length > 0 ? (
            <span className="rounded-md bg-primary text-primary-foreground px-1.5 py-0.5">
              {wins.length} win{wins.length === 1 ? "" : "s"}
            </span>
          ) : null}
          {losses.length > 0 ? (
            <span className="rounded-md bg-muted text-foreground px-1.5 py-0.5">
              {losses.length} loss{losses.length === 1 ? "" : "es"}
            </span>
          ) : null}
          {competitors.length > 0 ? (
            <span className="rounded-md bg-primary/10 text-primary px-1.5 py-0.5">
              {competitors.length} compet{competitors.length === 1 ? "itor" : "itors"}
            </span>
          ) : null}
        </div>
      </header>
      <ul className="divide-y divide-border/60">
        {changes.map((c, i) => (
          <ChangeRow key={i} change={c} />
        ))}
      </ul>
    </section>
  );
}

function ChangeRow({ change }: { change: WeeklyChange }) {
  switch (change.kind) {
    case "rank_up":
      return (
        <li className="flex items-start gap-3 px-4 py-2.5">
          <ArrowUp className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground truncate">
              {change.query}
            </p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">
              Moved up {change.change} spots ·{" "}
              <span className="font-mono">#{change.fromRank} → #{change.toRank}</span>
            </p>
          </div>
        </li>
      );
    case "rank_down":
      return (
        <li className="flex items-start gap-3 px-4 py-2.5">
          <ArrowDown className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground truncate">
              {change.query}
            </p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">
              Lost {Math.abs(change.change)} spots ·{" "}
              <span className="font-mono">#{change.fromRank} → #{change.toRank}</span>
            </p>
          </div>
        </li>
      );
    case "entered_top_10":
      return (
        <li className="flex items-start gap-3 px-4 py-2.5">
          <Award className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground truncate">
              {change.query}
            </p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">
              Entered the top 10 · <span className="font-mono">#{change.rank}</span>
            </p>
          </div>
        </li>
      );
    case "fell_out_top_10":
      return (
        <li className="flex items-start gap-3 px-4 py-2.5">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground truncate">
              {change.query}
            </p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">
              Fell out of the top 10 (was{" "}
              <span className="font-mono">#{change.lastRank}</span>)
            </p>
          </div>
        </li>
      );
    case "new_competitor_citation":
      return (
        <li className="flex items-start gap-3 px-4 py-2.5">
          <Users className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground">
              {change.competitor} cited by AI engines
            </p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 truncate">
              For: &ldquo;{change.prompt}&rdquo;
            </p>
          </div>
        </li>
      );
  }
}
