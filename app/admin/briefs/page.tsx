import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { PageHeader, SectionCard } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Prospect briefs" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /admin/briefs — list of all prospect briefs the operator has generated.
// Sorted newest first. Shows status pill (QUEUED / RUNNING / READY /
// FAILED), brand, domain, view count, and a quick "Open brief" link.
// ---------------------------------------------------------------------------

const STATUS_TONE: Record<string, { label: string; bg: string; fg: string }> = {
  QUEUED: { label: "Queued", bg: "#F3F4F6", fg: "#6B7280" },
  RUNNING: { label: "Running…", bg: "#EFF6FF", fg: "#1D4ED8" },
  READY: { label: "Ready", bg: "#ECFDF5", fg: "#047857" },
  FAILED: { label: "Failed", bg: "#FEF2F2", fg: "#B91C1C" },
};

function fmtRel(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

export default async function AdminBriefsPage() {
  await requireAgency();
  const rows = await prisma.prospectBrief.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      token: true,
      brand: true,
      domain: true,
      vertical: true,
      status: true,
      viewCount: true,
      lastViewedAt: true,
      createdAt: true,
      errorMessage: true,
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ADMIN"
        title="Prospect briefs"
        description="Hand-curated AI search visibility reports gated by random tokens. Generate one per prospect, paste the URL into a follow-up email."
        actions={
          <Link
            href="/admin/briefs/new"
            className="inline-flex items-center justify-center h-9 px-4 rounded-md text-[13px] font-semibold text-white"
            style={{ backgroundColor: "#2563EB" }}
          >
            Generate brief
          </Link>
        }
      />

      <SectionCard
        label={`Briefs (${rows.length})`}
        description="Newest first. Each brief lives at /brief/{token}. Tokens are 24-char hex random."
      >
        {rows.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-3">
            No briefs yet.{" "}
            <Link
              href="/admin/briefs/new"
              className="text-primary hover:underline"
            >
              Generate your first one
            </Link>
            {"."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const tone = STATUS_TONE[r.status] ?? STATUS_TONE.QUEUED;
              return (
                <li
                  key={r.id}
                  className="py-3 grid grid-cols-12 gap-3 items-center"
                >
                  <div className="col-span-5 min-w-0">
                    <p
                      className="truncate text-[14px] font-semibold"
                      title={r.brand}
                    >
                      {r.brand}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      {r.domain}
                      {r.vertical ? ` · ${r.vertical}` : ""}
                    </p>
                    {r.status === "FAILED" && r.errorMessage ? (
                      <p
                        className="mt-0.5 text-[11px] truncate"
                        style={{ color: "#B91C1C" }}
                        title={r.errorMessage}
                      >
                        Error: {r.errorMessage}
                      </p>
                    ) : null}
                  </div>
                  <div className="col-span-2">
                    <span
                      className="inline-flex items-center text-[11px] rounded-full px-2 py-0.5 font-medium"
                      style={{
                        backgroundColor: tone.bg,
                        color: tone.fg,
                      }}
                    >
                      {tone.label}
                    </span>
                  </div>
                  <div className="col-span-2 text-[11.5px] text-muted-foreground">
                    {fmtRel(r.createdAt)}
                  </div>
                  <div className="col-span-1 text-[11.5px] text-muted-foreground tabular-nums">
                    {r.viewCount}{" "}
                    <span className="text-muted-foreground/70">views</span>
                  </div>
                  <div className="col-span-2 text-right">
                    {r.status === "READY" ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <Link
                          href={`/brief/${encodeURIComponent(r.token)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] font-medium text-primary hover:underline"
                        >
                          Open brief →
                        </Link>
                        <Link
                          href={
                            `/admin/proposals/new` +
                            `?brand=${encodeURIComponent(r.brand)}` +
                            `&domain=${encodeURIComponent(r.domain)}` +
                            `&briefToken=${encodeURIComponent(r.token)}`
                          }
                          className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline"
                        >
                          Build proposal →
                        </Link>
                      </div>
                    ) : r.status === "FAILED" ? (
                      <RetryButton briefId={r.id} />
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        building…
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

import { RetryButton } from "./retry-button";
