"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

interface CheckResult {
  ok: boolean;
  url: string | null;
  status: "DETECTED_OK" | "DETECTED_WRONG_SLUG" | "NOT_DETECTED" | "NO_URL" | "FETCH_FAILED";
  message: string;
  detectedSlug: string | null;
  checkedAt: string;
}

interface Props {
  /** Optional explicit URL to probe. Falls through to the org's
   *  first marketable property when omitted. */
  url?: string | null;
  /** Operator's org slug — shown when a wrong-slug paste is detected
   *  so the operator can immediately see what they need to fix. */
  orgSlug: string;
}

/**
 * Embed-detection status chip for the popup campaign editor.
 *
 * Probes the operator's marketing website server-side via
 * /api/portal/popups/check-embed and renders one of four states:
 *
 *   GREEN  — embed snippet detected with the correct data-tenant slug.
 *            Popups will fire on real visitors when their triggers hit.
 *   YELLOW — embed detected but pointed at a different tenant slug.
 *            Operator pasted the wrong snippet (common when they
 *            manage multiple LeaseStack orgs and copy-pasted from the
 *            other portal). Shows the detected slug + the expected
 *            slug so the fix is obvious.
 *   RED    — embed not detected. Operator hasn't pasted the snippet,
 *            or it's pasted on a different page than we're probing.
 *   GRAY   — no marketing URL configured, or the site is unreachable.
 *
 * The chip is also a button — click to re-check (bypassing the 5min
 * server-side cache) after fixing the install snippet.
 */
export function EmbedDetectionChip({ url, orgSlug }: Props) {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function probe(force = false) {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (force) qs.set("force", "1");
      if (url) qs.set("url", url);
      const res = await fetch(
        "/api/portal/popups/check-embed" + (qs.toString() ? "?" + qs.toString() : ""),
        { method: "GET", credentials: "same-origin" },
      );
      if (!res.ok) {
        setError(`Probe failed (HTTP ${res.status})`);
        return;
      }
      const data = (await res.json()) as CheckResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Probe failed");
    } finally {
      setLoading(false);
    }
  }

  // Probe on mount. We intentionally don't poll — embed status doesn't
  // change without operator intervention, and re-fetching on a 5s
  // interval would hammer their marketing site from every editor tab.
  useEffect(() => {
    probe(false);
    // url is stable per editor mount; orgSlug never changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !result) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-[12px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking embed on your site…
      </div>
    );
  }

  if (error && !result) {
    return (
      <button
        type="button"
        onClick={() => probe(true)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-[12px] text-muted-foreground hover:text-foreground"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Couldn&apos;t check embed — retry
      </button>
    );
  }

  if (!result) return null;

  const variants = {
    DETECTED_OK: {
      Icon: CheckCircle2,
      tone: "border-emerald-500/40 bg-emerald-50 text-emerald-900",
      iconTone: "text-emerald-600",
      label: "Embed detected on your site",
    },
    DETECTED_WRONG_SLUG: {
      Icon: AlertTriangle,
      tone: "border-amber-500/40 bg-amber-50 text-amber-900",
      iconTone: "text-amber-600",
      label: `Wrong slug on site (found "${result.detectedSlug}", expected "${orgSlug}")`,
    },
    NOT_DETECTED: {
      Icon: XCircle,
      tone: "border-red-500/40 bg-red-50 text-red-900",
      iconTone: "text-red-600",
      label: "Embed not detected on your site",
    },
    NO_URL: {
      Icon: AlertTriangle,
      tone: "border-border bg-secondary text-muted-foreground",
      iconTone: "text-muted-foreground",
      label: "No website URL configured",
    },
    FETCH_FAILED: {
      Icon: AlertTriangle,
      tone: "border-border bg-secondary text-muted-foreground",
      iconTone: "text-muted-foreground",
      label: "Couldn't reach your site",
    },
  } as const;

  const v = variants[result.status];

  return (
    <div className={`flex flex-wrap items-start gap-2 rounded-xl border px-3 py-2 text-[12.5px] ${v.tone}`}>
      <v.Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${v.iconTone}`} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{v.label}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug opacity-80">{result.message}</p>
        {result.url ? (
          <p className="mt-1 text-[11px] opacity-70">
            Checked{" "}
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              {result.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
            {" "}· {new Date(result.checkedAt).toLocaleTimeString()}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => probe(true)}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-md border border-current/20 px-2 py-1 text-[11px] font-medium opacity-80 hover:opacity-100 disabled:opacity-40"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
        Re-check
      </button>
    </div>
  );
}
