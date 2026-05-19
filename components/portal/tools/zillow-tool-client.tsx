"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/admin/page-header";
import { ZillowReportView } from "@/components/portal/tools/zillow-report-view";
import type { ZillowListing } from "@/lib/zillow/scrape";
import type { CalculationOutputs } from "@/lib/zillow/calculations";

// Mirrors the server-side rules in lib/zillow/url.ts but kept lightweight
// for client-side validation — we still validate canonically on the server.
const ZPID_REGEX = /\/(\d+)_zpid\b/i;
function looksLikeZillow(input: string): boolean {
  try {
    const u = new URL(input);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (!(host === "zillow.com" || host.endsWith(".zillow.com"))) return false;
    return ZPID_REGEX.test(u.pathname);
  } catch {
    return false;
  }
}

type Result =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      listing: ZillowListing;
      calculations: CalculationOutputs;
      savedId: string | null;
    };

export function ZillowToolClient({
  initialReport,
}: {
  initialReport?: {
    id: string;
    listing: ZillowListing;
    calculations: CalculationOutputs;
  } | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const [result, setResult] = useState<Result>(
    initialReport
      ? {
          kind: "ready",
          listing: initialReport.listing,
          calculations: initialReport.calculations,
          savedId: initialReport.id,
        }
      : { kind: "idle" },
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setValidationError("Paste a Zillow listing URL.");
      return;
    }
    if (!looksLikeZillow(trimmed)) {
      setValidationError(
        "That doesn't look like a Zillow listing URL. It should be an https://www.zillow.com/... link with a numeric zpid.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/tools/zillow/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          (data && typeof data.error === "string" && data.error) ||
          "Something went wrong generating the report.";
        setResult({ kind: "error", message: msg });
        return;
      }
      setResult({
        kind: "ready",
        listing: data.listing,
        calculations: data.calculations,
        savedId: null,
      });
    } catch {
      setResult({
        kind: "error",
        message: "Network error reaching the server. Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSave() {
    if (result.kind !== "ready" || result.savedId) return;
    setSaving(true);
    try {
      // Resubmit with save=true. We re-scrape to keep the saved payload
      // truly server-derived (rather than trusting the client to hand us
      // back the original JSON we'd have to re-validate anyway).
      const res = await fetch("/api/portal/tools/zillow/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.listing.url, save: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setResult({
          kind: "error",
          message:
            (data && typeof data.error === "string" && data.error) ||
            "Couldn't save the report.",
        });
        return;
      }
      setResult({
        kind: "ready",
        listing: data.listing,
        calculations: data.calculations,
        savedId: data.saved?.id ?? null,
      });
      // Refresh server-rendered "Saved reports" list above the form.
      startTransition(() => router.refresh());
    } catch {
      setResult({
        kind: "error",
        message: "Network error while saving.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard
        label="New report"
        description="Paste a Zillow listing URL. We'll pull the headline facts and run quick investor math."
      >
        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-2"
        >
          <Input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="https://www.zillow.com/homedetails/.../12345_zpid/"
            aria-label="Zillow URL"
            aria-invalid={validationError ? true : undefined}
            disabled={submitting}
            className="flex-1"
            required
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? "Generating…" : "Generate report"}
          </Button>
        </form>
        {validationError && (
          <p className="text-[12px] mt-2 text-destructive">{validationError}</p>
        )}
        {result.kind === "error" && (
          <p className="text-[12px] mt-2 text-destructive">{result.message}</p>
        )}
      </SectionCard>

      {result.kind === "ready" && (
        <ZillowReportView
          listing={result.listing}
          calculations={result.calculations}
          savedId={result.savedId}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
