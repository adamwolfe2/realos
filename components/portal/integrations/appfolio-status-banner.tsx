import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Plug,
} from "lucide-react";
import type { AppFolioStatus } from "@/lib/integrations/appfolio-status";
import { RunAppFolioSyncButton } from "./run-appfolio-sync-button";

// ---------------------------------------------------------------------------
// AppFolioStatusBanner — honest disclosure of the current AppFolio sync state
// at the top of every operations page (residents / renewals / work-orders).
// Distinguishes the four states that previously all looked like "no data"
// to operators:
//
//   not_connected → "Connect AppFolio to mirror residents…" + CTA
//   never_synced  → "Credentials saved. First sync hasn't run yet." + Run sync
//   syncing       → "Sync in progress."
//   synced        → "Last sync 5 min ago." (+ stale warning if > 24h)
//   failed        → Surfaces the error message + Run sync to retry
//
// Always emphasizes that AppFolio remains the source of truth. Never claims
// LeaseStack manages the underlying records.
// ---------------------------------------------------------------------------

type Tone = "info" | "ok" | "warn" | "error" | "muted";

const TONES: Record<Tone, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  muted: "border-border bg-muted/30 text-foreground",
};

export function AppFolioStatusBanner({
  status,
  resourceLabel,
}: {
  status: AppFolioStatus;
  /** Plural noun for the resource displayed on the page (e.g. "residents"). */
  resourceLabel: string;
}) {
  if (status.state === "not_connected") {
    return (
      <Banner
        tone="muted"
        icon={<Plug className="h-4 w-4" />}
        title={`Connect AppFolio to mirror ${resourceLabel}.`}
        body={`AppFolio remains your source of truth. Once connected, LeaseStack pulls ${resourceLabel} on an hourly schedule so you never have to leave AppFolio for routine reporting.`}
        action={
          <Link
            href="/portal/settings/integrations"
            className="inline-flex items-center rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-semibold hover:opacity-90"
          >
            Connect AppFolio
          </Link>
        }
      />
    );
  }

  if (status.state === "never_synced") {
    return (
      <Banner
        tone="info"
        icon={<CircleDashed className="h-4 w-4" />}
        title="AppFolio is connected. First sync hasn't run yet."
        body={
          status.subdomain
            ? `Credentials saved for ${status.subdomain}.appfolio.com. Run the first sync to populate ${resourceLabel}.`
            : `Credentials saved. Run the first sync to populate ${resourceLabel}.`
        }
        action={<RunAppFolioSyncButton />}
      />
    );
  }

  if (status.state === "syncing") {
    return (
      <Banner
        tone="info"
        icon={<Clock className="h-4 w-4 animate-pulse" />}
        title="AppFolio sync in progress."
        body={`${resourceLabel} will refresh automatically as soon as the current sync finishes. This usually takes under a minute.`}
      />
    );
  }

  if (status.state === "failed") {
    return (
      <Banner
        tone="error"
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Most recent AppFolio sync failed."
        body={truncate(status.lastError ?? "Unknown error.", 240)}
        meta={
          status.lastSyncAt
            ? `Last attempt ${formatDistanceToNow(status.lastSyncAt, {
                addSuffix: true,
              })}.`
            : undefined
        }
        action={<RunAppFolioSyncButton label="Retry sync" />}
      />
    );
  }

  // synced
  if (status.stale) {
    return (
      <Banner
        tone="warn"
        icon={<Clock className="h-4 w-4" />}
        title="AppFolio data may be stale."
        body={`Last sync ${formatDistanceToNow(status.lastSyncAt!, {
          addSuffix: true,
        })}. Sync usually runs hourly — re-run if you expect newer ${resourceLabel}.`}
        action={<RunAppFolioSyncButton />}
      />
    );
  }

  return (
    <Banner
      tone="ok"
      icon={<CheckCircle2 className="h-4 w-4" />}
      title={`Synced from AppFolio · ${formatDistanceToNow(status.lastSyncAt!, {
        addSuffix: true,
      })}`}
      body={`AppFolio remains the source of truth for ${resourceLabel}. This view is read-only.`}
      action={<RunAppFolioSyncButton label="Sync now" subtle />}
    />
  );
}

function truncate(input: string, max: number): string {
  const s = input.trim().replace(/\s+/g, " ");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function Banner({
  tone,
  icon,
  title,
  body,
  meta,
  action,
}: {
  tone: Tone;
  icon: React.ReactNode;
  title: string;
  body?: string;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 flex items-start gap-3 flex-wrap md:flex-nowrap ${TONES[tone]}`}
      role="status"
    >
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        {body ? (
          <p className="text-xs mt-1 opacity-90 leading-snug">{body}</p>
        ) : null}
        {meta ? (
          <p className="text-[11px] mt-1 opacity-70">{meta}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
