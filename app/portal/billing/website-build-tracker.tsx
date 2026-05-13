import Link from "next/link";
import { Calendar, ExternalLink, CheckCircle2 } from "lucide-react";

// ---------------------------------------------------------------------------
// WebsiteBuildTracker
//
// Renders on /portal/billing when the customer has one or more
// WebsiteBuildRequest rows. Shows each row's status, payment amount,
// and the kickoff call link if not yet booked. Lets the customer
// track build progress without leaving the portal.
// ---------------------------------------------------------------------------

type BuildStatus =
  | "requested"
  | "scoping"
  | "designing"
  | "building"
  | "review"
  | "live"
  | "cancelled";

type Build = {
  id: string;
  status: BuildStatus;
  amountPaidCents: number;
  calBookingUrl: string | null;
  calBookedAt: string | null;
  kickoffCallAt: string | null;
  launchedAt: string | null;
  createdAt: string;
  propertyName: string | null;
};

const STAGE_ORDER: Array<{ id: BuildStatus; label: string }> = [
  { id: "requested", label: "Paid" },
  { id: "scoping", label: "Scoping" },
  { id: "designing", label: "Designing" },
  { id: "building", label: "Building" },
  { id: "review", label: "Review" },
  { id: "live", label: "Live" },
];

function stageIndex(status: BuildStatus): number {
  if (status === "cancelled") return -1;
  return STAGE_ORDER.findIndex((s) => s.id === status);
}

export function WebsiteBuildTracker({ builds }: { builds: Build[] }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Your custom website builds</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Each row shows where your build is in our queue. Click the
          kickoff call link if you haven&apos;t booked yet.
        </p>
      </div>

      <ul className="space-y-3">
        {builds.map((b) => {
          const activeIdx = stageIndex(b.status);
          const cancelled = b.status === "cancelled";
          return (
            <li
              key={b.id}
              className="rounded-lg border border-border bg-background p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {b.propertyName
                      ? `Custom site for ${b.propertyName}`
                      : "Custom website build"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ${Math.round(b.amountPaidCents / 100).toLocaleString()} paid
                    on {new Date(b.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {cancelled ? (
                  <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[11px] font-semibold">
                    Cancelled
                  </span>
                ) : b.status === "live" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold">
                    <CheckCircle2 size={11} strokeWidth={2.5} />
                    Live
                  </span>
                ) : null}
              </div>

              {!cancelled ? (
                <ol className="flex items-center gap-0">
                  {STAGE_ORDER.map((stage, i) => {
                    const done = i < activeIdx;
                    const active = i === activeIdx;
                    return (
                      <li
                        key={stage.id}
                        className="flex-1 flex flex-col items-center text-center"
                      >
                        <span
                          className="inline-flex items-center justify-center rounded-full text-[10px] font-bold"
                          style={{
                            width: 22,
                            height: 22,
                            backgroundColor: done
                              ? "#2563EB"
                              : active
                                ? "#141413"
                                : "#e8e6dc",
                            color:
                              done || active ? "#ffffff" : "#88867f",
                          }}
                          aria-hidden="true"
                        >
                          {done ? "✓" : i + 1}
                        </span>
                        <span
                          className="mt-1"
                          style={{
                            color: active ? "#141413" : "#88867f",
                            fontFamily: "var(--font-mono)",
                            fontSize: "9.5px",
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            fontWeight: active ? 600 : 500,
                          }}
                        >
                          {stage.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : null}

              {!cancelled && b.status === "requested" && b.calBookingUrl ? (
                <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 border border-border px-3 py-2">
                  <p className="text-xs text-foreground">
                    {b.calBookedAt
                      ? `Kickoff call booked for ${new Date(b.calBookedAt).toLocaleDateString()}`
                      : "Next step: book your kickoff call so we can start the build."}
                  </p>
                  {!b.calBookedAt ? (
                    <Link
                      href={b.calBookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-amber-800 text-white text-[11px] font-semibold px-3 py-1.5 shrink-0"
                    >
                      <Calendar size={12} strokeWidth={2.5} />
                      Book call
                      <ExternalLink size={10} strokeWidth={2.5} />
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {b.launchedAt ? (
                <p className="text-xs text-muted-foreground">
                  Launched {new Date(b.launchedAt).toLocaleDateString()}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
