import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Inbox } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { DraftStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Content approvals · LeaseStack" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /admin/content-approvals
//
// FIFO queue of every ContentDraft sitting in PENDING_REVIEW across every
// client org. This is the page Adam works from when shipping content into
// external client repos via Claude Code.
//
// Distinct from /admin/content-drafts:
//   - This screen ONLY shows PENDING_REVIEW.
//   - Each row links to the dedicated approval workflow (Preview / MDX /
//     Claude Code prompt + Mark-as-deployed).
//   - The reviewer is expected to actually paste content into a client's
//     external GitHub repo, so the detail page is optimized for that flow.
// ---------------------------------------------------------------------------

function fmtRelative(d: Date | null | undefined): string {
  if (!d) return "—";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(0, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function wordCount(html: string | null | undefined, md: string | null | undefined): number {
  const source = (md && md.trim()) || (html ? html.replace(/<[^>]+>/g, " ") : "");
  if (!source) return 0;
  return source.trim().split(/\s+/).filter(Boolean).length;
}

function deriveDomain(domains: { hostname: string; isPrimary: boolean }[]): string | null {
  if (!domains?.length) return null;
  const primary = domains.find((d) => d.isPrimary);
  return (primary ?? domains[0]).hostname;
}

export default async function ContentApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { error } = await requireAdmin();
  if (error) {
    redirect("/sign-in");
  }

  const sp = await searchParams;
  const orgFilter = typeof sp.org === "string" && sp.org !== "" ? sp.org : null;

  const drafts = await prisma.contentDraft.findMany({
    where: {
      status: DraftStatus.PENDING_REVIEW,
      ...(orgFilter ? { orgId: orgFilter } : {}),
    },
    orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
    take: 200,
    select: {
      id: true,
      format: true,
      brief: true,
      orgId: true,
      submittedAt: true,
      createdAt: true,
      htmlBody: true,
      outputMarkdown: true,
      output: true,
      org: {
        select: {
          id: true,
          name: true,
          domains: { select: { hostname: true, isPrimary: true } },
        },
      },
      property: { select: { name: true } },
    },
  });

  // Org dropdown options — every org that currently has a pending draft.
  const orgIds = Array.from(new Set(drafts.map((d) => d.orgId)));
  const orgOptions = orgIds.length
    ? await prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
            Admin
          </p>
          <div className="mt-1 flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-foreground">
              Content approvals
            </h1>
            <span className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full bg-primary/10 px-2 text-[11px] font-mono font-medium text-primary">
              {drafts.length}
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-2xl">
            Pending drafts across every client. Oldest first — work them FIFO,
            copy the MDX or Claude Code prompt, then mark as deployed once it&apos;s
            live on the client&apos;s domain.
          </p>
        </div>

        {orgOptions.length > 1 ? (
          <form className="flex items-center gap-2" action="/admin/content-approvals">
            <label className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
              Org
            </label>
            <select
              name="org"
              defaultValue={orgFilter ?? ""}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All orgs</option>
              {orgOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted"
            >
              Apply
            </button>
          </form>
        ) : null}
      </header>

      {drafts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Inbox className="h-5 w-5 text-primary" />
          </div>
          <p className="text-[14px] font-medium text-foreground">
            No pending approvals
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            When operators submit drafts for review, they&apos;ll land here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {drafts.map((d) => {
            const out =
              d.output && typeof d.output === "object" && !Array.isArray(d.output)
                ? (d.output as Record<string, unknown>)
                : {};
            const title =
              (typeof out.title === "string" && out.title.trim()) ||
              d.brief.split("\n")[0]?.slice(0, 90) ||
              "Untitled draft";
            const domain = deriveDomain(d.org?.domains ?? []);
            const words = wordCount(d.htmlBody, d.outputMarkdown);

            return (
              <li
                key={d.id}
                className="group rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-4">
                  {/* Severity dot — single LeaseStack blue, no rainbow. */}
                  <div className="mt-2 flex-none">
                    <span
                      aria-hidden
                      className="block h-2 w-2 rounded-full bg-primary shadow-[0_0_0_3px_rgba(0,0,0,0.04)]"
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wide text-primary">
                        {d.format.replace(/_/g, " ").toLowerCase()}
                      </span>
                      <span className="text-[12px] font-medium text-foreground">
                        {d.org?.name ?? d.orgId}
                      </span>
                      {domain ? (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {domain}
                        </span>
                      ) : null}
                      {d.property?.name ? (
                        <span className="text-[11px] text-muted-foreground">
                          · {d.property.name}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-[13.5px] font-medium text-foreground line-clamp-1 leading-snug">
                      {title}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{fmtRelative(d.submittedAt ?? d.createdAt)}</span>
                      <span aria-hidden>·</span>
                      <span className="font-mono">{words} words</span>
                    </div>
                  </div>

                  <div className="flex-none">
                    <Link
                      href={`/admin/content-approvals/${d.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Open
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
