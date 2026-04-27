"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bug, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// BugReportButton — floating button that opens a modal for filing a bug
// straight from any portal/admin page. POSTs to /api/bug-report which files
// a GitHub issue and emails the ops inbox.
// ---------------------------------------------------------------------------

type Severity = "low" | "medium" | "high" | "blocker";

const SEVERITIES: Array<{ value: Severity; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "blocker", label: "Blocker" },
];

type SubmitState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok"; githubUrl: string | null }
  | { kind: "error"; message: string };

export function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const titleRef = useRef<HTMLInputElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (open) {
      setState({ kind: "idle" });
      titleRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "sending" });
    try {
      const viewport =
        typeof window !== "undefined"
          ? `${window.innerWidth}x${window.innerHeight}`
          : undefined;
      const res = await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          severity,
          pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
          pagePath: pathname ?? undefined,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          viewport,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      setState({ kind: "ok", githubUrl: body.githubUrl ?? null });
      setTitle("");
      setDescription("");
      setSeverity("medium");
      setTimeout(() => {
        setOpen(false);
        setState({ kind: "idle" });
      }, 2000);
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to send report",
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report a bug"
        title="Report a bug"
        className={cn(
          "fixed z-40 bottom-4 right-4 md:bottom-6 md:right-6",
          "inline-flex items-center gap-2 rounded-full",
          "bg-foreground text-background",
          "px-4 py-2.5 text-xs font-semibold tracking-wide",
          "shadow-lg shadow-black/20 hover:shadow-xl",
          "hover:bg-foreground/90 transition-all",
          "border border-foreground/10"
        )}
      >
        <Bug className="w-4 h-4" aria-hidden="true" />
        <span>Report bug</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report a bug"
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:justify-end p-4 md:p-6"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className={cn(
              "relative w-full md:w-[420px] max-h-[90vh] overflow-y-auto",
              "rounded-lg bg-card border border-border shadow-2xl"
            )}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Bug className="w-4 h-4" aria-hidden="true" />
                  Report a bug
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Goes straight to the engineering inbox. Include what you
                  expected to see and what you actually saw.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {state.kind === "ok" ? (
              <div className="p-6 text-center space-y-3">
                <p className="text-sm font-semibold text-emerald-700">
                  Report received.
                </p>
                <p className="text-xs text-muted-foreground">
                  Adam has been notified by email
                  {state.githubUrl ? " and a GitHub issue was filed" : ""}.
                </p>
                {state.githubUrl ? (
                  <a
                    href={state.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline underline-offset-2"
                  >
                    View on GitHub
                  </a>
                ) : null}
              </div>
            ) : (
              <form onSubmit={submit} className="p-5 space-y-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                    Title
                  </span>
                  <input
                    ref={titleRef}
                    type="text"
                    required
                    minLength={3}
                    maxLength={200}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Short summary of the issue"
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                    Severity
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {SEVERITIES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSeverity(s.value)}
                        className={cn(
                          "px-2 py-1.5 text-xs font-medium rounded border transition-colors",
                          severity === s.value
                            ? "bg-primary text-primary-foreground border-foreground"
                            : "bg-card text-muted-foreground border-border hover:text-foreground"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                    What happened
                  </span>
                  <textarea
                    required
                    minLength={5}
                    maxLength={8000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Steps to reproduce, expected vs actual behavior, anything else that helps."
                    rows={6}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                  />
                </label>

                <div className="text-[11px] text-muted-foreground border-t border-border pt-3">
                  We'll automatically include your current page URL, viewport
                  size, and user agent.
                </div>

                {state.kind === "error" ? (
                  <p className="text-xs text-destructive">{state.message}</p>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={state.kind === "sending"}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 disabled:opacity-40"
                  >
                    {state.kind === "sending" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Send report"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
