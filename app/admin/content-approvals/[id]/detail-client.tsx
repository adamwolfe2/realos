"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FileCode, MessageSquare, Rocket } from "lucide-react";
import { CopyButton } from "../copy-button";

type TabKey = "preview" | "mdx" | "prompt";

type Props = {
  draftId: string;
  canReview: boolean;
  htmlBody: string;
  mdxOutput: string;
  claudePrompt: string;
  slug: string;
  domain: string | null;
  format: string;
};

// ---------------------------------------------------------------------------
// ApprovalDetailClient
//
// Tabs:
//   Preview — renders htmlBody as-is inside a constrained prose container.
//   MDX — paste-ready frontmatter + body + JSON-LD scripts, with a copy
//         button top-right.
//   Claude Code prompt — paste-ready instruction string for Claude Code.
//
// Footer actions:
//   Request changes  → opens notes textarea, posts CHANGES_REQUESTED.
//   Reject           → opens notes textarea, posts REJECTED.
//   Mark as deployed → opens confirmation modal that requires a deployed
//                      URL, then posts SHIPPED with deployedUrl.
// ---------------------------------------------------------------------------
export function ApprovalDetailClient({
  draftId,
  canReview,
  htmlBody,
  mdxOutput,
  claudePrompt,
  slug,
  domain,
  format,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("preview");
  const [pending, startTransition] = useTransition();

  // Notes mode for request-changes / reject — inline textarea, not a modal.
  const [notesMode, setNotesMode] = useState<
    null | "CHANGES_REQUESTED" | "REJECTED"
  >(null);
  const [notes, setNotes] = useState("");

  // Mark-as-deployed modal state.
  const [deployOpen, setDeployOpen] = useState(false);
  const defaultDeployUrl = useMemo(() => {
    if (!domain) return "";
    const path =
      format === "BLOG_POST"
        ? `/blog/${slug}`
        : format === "NEIGHBORHOOD_PAGE"
          ? `/n/${slug}`
          : `/${slug}`;
    return `https://${domain}${path}`;
  }, [domain, slug, format]);
  const [deployUrl, setDeployUrl] = useState("");

  function decide(body: {
    decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED" | "SHIPPED";
    notes?: string;
    deployedUrl?: string;
  }) {
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/content-approvals/${draftId}/decide`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        const json: { error?: string } = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(json?.error ?? "Action failed.");
          return;
        }
        if (body.decision === "SHIPPED") {
          toast.success("Marked as deployed.");
        } else if (body.decision === "CHANGES_REQUESTED") {
          toast.success("Sent back to operator.");
        } else if (body.decision === "REJECTED") {
          toast.success("Rejected.");
        } else {
          toast.success("Approved.");
        }
        router.refresh();
        router.push("/admin/content-approvals");
      } catch {
        toast.error("Network error.");
      }
    });
  }

  function submitNotes() {
    if (!notesMode) return;
    if (notes.trim().length < 4) {
      toast.error("Add notes describing what to fix.");
      return;
    }
    decide({ decision: notesMode, notes });
  }

  function submitDeploy() {
    const url = (deployUrl || defaultDeployUrl).trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Enter a full URL (https://...).");
      return;
    }
    decide({ decision: "SHIPPED", deployedUrl: url });
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border">
        <TabButton
          active={tab === "preview"}
          onClick={() => setTab("preview")}
          label="Preview"
        />
        <TabButton
          active={tab === "mdx"}
          onClick={() => setTab("mdx")}
          icon={<FileCode className="h-3.5 w-3.5" />}
          label="MDX"
        />
        <TabButton
          active={tab === "prompt"}
          onClick={() => setTab("prompt")}
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          label="Claude Code prompt"
        />
      </div>

      {/* Tab content */}
      {tab === "preview" ? (
        <article className="rounded-2xl border border-border bg-card p-6 md:p-8">
          {htmlBody ? (
            <div
              className="prose-content"
              // Operator content. This is the same HTML that ships to the
              // client site, rendered in a constrained preview container.
              dangerouslySetInnerHTML={{ __html: htmlBody }}
            />
          ) : (
            <p className="text-[12px] text-muted-foreground italic">
              No HTML body captured. Switch to the MDX tab to see the
              markdown form.
            </p>
          )}
          <style>{`
            .prose-content { max-width: 65ch; }
            .prose-content h1 { font-size: 1.875rem; font-weight: 700; line-height: 1.15; margin: 1.25rem 0 .5rem; color: var(--foreground); }
            .prose-content h2 { font-size: 1.375rem; font-weight: 600; line-height: 1.25; margin: 1.5rem 0 .5rem; color: var(--foreground); }
            .prose-content h3 { font-size: 1.125rem; font-weight: 600; margin: 1.25rem 0 .35rem; color: var(--foreground); }
            .prose-content p { font-size: 0.95rem; line-height: 1.65; margin: .65rem 0; color: var(--foreground); }
            .prose-content ul { list-style: disc; padding-left: 1.25rem; margin: .65rem 0; }
            .prose-content ol { list-style: decimal; padding-left: 1.25rem; margin: .65rem 0; }
            .prose-content li { font-size: 0.95rem; line-height: 1.6; margin: .25rem 0; }
            .prose-content a { color: var(--primary); text-decoration: underline; }
            .prose-content blockquote { border-left: 3px solid var(--primary); padding-left: 1rem; color: var(--muted-foreground); font-style: italic; margin: 1rem 0; }
            .prose-content code { background: rgba(0,0,0,.05); padding: 0.1em 0.35em; border-radius: 4px; font-size: .85em; }
            .prose-content pre { background: rgba(0,0,0,.05); padding: 1rem; border-radius: 8px; overflow-x: auto; }
            .prose-content pre code { background: transparent; padding: 0; }
            .prose-content strong { font-weight: 600; color: var(--foreground); }
          `}</style>
        </article>
      ) : null}

      {tab === "mdx" ? (
        <div className="relative rounded-2xl border border-border bg-card p-4">
          <div className="absolute right-3 top-3 z-10">
            <CopyButton value={mdxOutput} label="Copy MDX" />
          </div>
          <textarea
            readOnly
            value={mdxOutput}
            spellCheck={false}
            className="w-full min-h-[420px] resize-y rounded-lg border border-border bg-background px-3 py-2 text-[12px] font-mono leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Paste this into the client&apos;s repo. Frontmatter, body, and inline
            JSON-LD are all included.
          </p>
        </div>
      ) : null}

      {tab === "prompt" ? (
        <div className="relative rounded-2xl border border-border bg-card p-4">
          <div className="absolute right-3 top-3 z-10">
            <CopyButton value={claudePrompt} label="Copy prompt" />
          </div>
          <textarea
            readOnly
            value={claudePrompt}
            spellCheck={false}
            className="w-full min-h-[420px] resize-y rounded-lg border border-border bg-background px-3 py-2 text-[12px] font-mono leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Paste into Claude Code with the client&apos;s repo open. Claude will
            create the file, wire internal links, and commit.
          </p>
        </div>
      ) : null}

      {/* Notes panel for request-changes / reject */}
      {canReview && notesMode ? (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
              {notesMode === "REJECTED"
                ? "Reject — notes for operator"
                : "Request changes — notes for operator"}
            </p>
            <button
              type="button"
              onClick={() => {
                setNotesMode(null);
                setNotes("");
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What needs to change? Be specific — they'll see this in email + portal."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={submitNotes}
              className={
                notesMode === "REJECTED"
                  ? "rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  : "rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              }
            >
              {notesMode === "REJECTED" ? "Confirm reject" : "Send back"}
            </button>
          </div>
        </div>
      ) : null}

      {/* Footer actions */}
      {canReview ? (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-border bg-card/95 backdrop-blur p-3 shadow-sm">
          <button
            type="button"
            disabled={pending || notesMode !== null}
            onClick={() => {
              setNotesMode("CHANGES_REQUESTED");
              setNotes("");
            }}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            Request changes
          </button>
          <button
            type="button"
            disabled={pending || notesMode !== null}
            onClick={() => {
              setNotesMode("REJECTED");
              setNotes("");
            }}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Reject
          </button>
          <div className="mx-1 h-5 w-px bg-border" aria-hidden />
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setDeployUrl(defaultDeployUrl);
              setDeployOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm"
          >
            <Rocket className="h-3.5 w-3.5" />
            Mark as deployed
          </button>
        </div>
      ) : null}

      {/* Deploy confirmation modal */}
      {deployOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeployOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold text-foreground">
                  Mark as deployed?
                </h2>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Have you committed this to{" "}
                  <span className="font-mono text-foreground">
                    {domain ?? "the client domain"}
                  </span>
                  ? Once marked, the operator gets a &quot;shipped&quot; email and the
                  recommendation closes out.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              <label
                htmlFor="deploy-url"
                className="block text-[11px] font-mono uppercase tracking-wide text-muted-foreground"
              >
                Deployed URL
              </label>
              <input
                id="deploy-url"
                type="url"
                value={deployUrl}
                onChange={(e) => setDeployUrl(e.target.value)}
                placeholder="https://client-domain.com/blog/your-slug"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Saved to the draft so the team can trace where it shipped.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeployOpen(false)}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={submitDeploy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm"
              >
                <Rocket className="h-3.5 w-3.5" />
                Confirm — deployed
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "relative inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium transition-colors " +
        (active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground")
      }
      aria-pressed={active}
    >
      {icon}
      {label}
      <span
        aria-hidden
        className={
          "absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors " +
          (active ? "bg-primary" : "bg-transparent")
        }
      />
    </button>
  );
}
