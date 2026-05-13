import Link from "next/link";
import { Check, X, CircleAlert } from "lucide-react";

type ReadinessItem = {
  label: string;
  status: "ok" | "missing" | "warn";
  hint?: string;
  href?: string;
};

type Props = {
  items: ReadinessItem[];
};

// ---------------------------------------------------------------------------
// Pre-launch readiness panel for the admin client detail page.
//
// Quick at-a-glance of everything that should be green before we send the
// Clerk invite. Each item is pre-computed server-side — this component just
// renders the pills + optional deep links.
// ---------------------------------------------------------------------------

export function LaunchReadiness({ items }: Props) {
  const okCount = items.filter((i) => i.status === "ok").length;
  const missing = items.filter((i) => i.status === "missing");
  const allGreen = okCount === items.length;

  return (
    <section
      className="rounded-lg border border-border bg-card p-4 space-y-3"
      aria-labelledby="launch-readiness-title"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h3
            id="launch-readiness-title"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            Pre-launch readiness
          </h3>
          <span
            className={[
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
              allGreen
                ? "bg-primary/10 text-primary"
                : missing.length > 0
                  ? "bg-muted text-foreground"
                  : "bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {okCount}/{items.length} ready
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Everything that should be green before the invite goes out.
        </p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item) => (
          <li key={item.label}>
            <div
              className={[
                "flex items-start gap-2.5 rounded-md border px-3 py-2",
                item.status === "ok"
                  ? "border-border bg-card"
                  : item.status === "warn"
                    ? "border-border bg-muted/40"
                    : "border-destructive/30 bg-destructive/5",
              ].join(" ")}
            >
              <StatusGlyph status={item.status} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-foreground">
                    {item.label}
                  </span>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="text-[11px] text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
                    >
                      Open
                    </Link>
                  ) : null}
                </div>
                {item.hint ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                    {item.hint}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusGlyph({ status }: { status: ReadinessItem["status"] }) {
  if (status === "ok") {
    return (
      <span
        aria-label="Ready"
        className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <Check className="h-2.5 w-2.5" />
      </span>
    );
  }
  if (status === "warn") {
    return (
      <span aria-label="Warning" className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted/40 text-white">
        <CircleAlert className="h-2.5 w-2.5" />
      </span>
    );
  }
  return (
    <span
      aria-label="Missing"
      className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
    >
      <X className="h-2.5 w-2.5" />
    </span>
  );
}
