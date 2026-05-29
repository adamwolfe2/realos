"use client";

// EmptyState — rendered when an audit completes but no mentions surfaced.
// Self-explains the three usual causes (no online presence / generic brand
// name / rate-limited source) and offers a "Re-run scan" button once the
// initial run is past its cooldown window (so we don't double-bill the
// upstream providers for a job that's about to land anyway).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const RERUN_GRACE_MS = 60_000;

interface EmptyStateProps {
  brandName: string;
  shareToken: string;
  auditCreatedAtIso: string;
}

export function EmptyState({
  brandName,
  shareToken,
  auditCreatedAtIso,
}: EmptyStateProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);

  const createdMs = new Date(auditCreatedAtIso).getTime();
  const canRerun =
    Number.isFinite(createdMs) && Date.now() - createdMs > RERUN_GRACE_MS;

  async function handleRerun() {
    setError(null);
    setRerunning(true);
    try {
      const res = await fetch(`/api/audit/${encodeURIComponent(shareToken)}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(body.error ?? `Re-run failed (${res.status})`);
      }
      // Give the run trigger a beat to flip the row to RUNNING before we
      // refresh — otherwise we'd just see the same READY-empty payload.
      setTimeout(() => {
        startTransition(() => router.refresh());
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-run failed");
      setRerunning(false);
    }
  }

  return (
    <section className="mt-12">
      <p
        className="text-[11px] font-mono uppercase tracking-[0.18em]"
        style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
      >
        Reputation — past 90 days
      </p>
      <h2
        className="text-3xl sm:text-4xl font-semibold mt-2 tracking-tight"
        style={{ color: "#1E2A3A" }}
      >
        No public mentions surfaced
      </h2>
      <div
        className="mt-6 rounded-2xl border p-6 sm:p-8 max-w-3xl"
        style={{ borderColor: "#E5E7EB", backgroundColor: "#FBFBFD" }}
      >
        <p
          className="text-base leading-relaxed"
          style={{ color: "#1E2A3A" }}
        >
          We searched 6 sources (Reddit, Yelp, Google, BBB, ApartmentRatings,
          Facebook) for posts about{" "}
          <span className="font-semibold">{brandName}</span> in the last 90
          days and didn&apos;t find anything.
        </p>
        <p className="text-sm mt-4" style={{ color: "#4B5563" }}>
          That can mean three things:
        </p>
        <ol
          className="mt-3 space-y-2 text-sm list-decimal pl-5"
          style={{ color: "#4B5563" }}
        >
          <li>
            Your property genuinely has no recent online mentions (rare for an
            established multifamily property).
          </li>
          <li>
            Your brand name is too generic to dedupe from unrelated content.
          </li>
          <li>
            The audit ran while a source was rate-limited — re-run to retry.
          </li>
        </ol>
        {canRerun ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={handleRerun}
              disabled={rerunning || isPending}
              className="inline-flex items-center justify-center h-11 px-6 rounded-md text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: "#2563EB" }}
            >
              {rerunning || isPending ? "Re-running…" : "Re-run scan"}
            </button>
            {error ? (
              <p className="mt-3 text-sm" style={{ color: "#B91C1C" }}>
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
