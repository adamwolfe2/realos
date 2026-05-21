"use client";

// ---------------------------------------------------------------------------
// ContentQuotaOverride — admin surface for bumping a client's monthly
// content quotas without touching their plan tier.
//
// Lives on /admin/clients/[id]. Renders one row per ContentFormat with the
// plan-default limit, the current override (if any), and an input. Empty
// input → null override (revert to plan default). PATCHes the org via
// /api/admin/clients/[orgId]/content-quota.
// ---------------------------------------------------------------------------

import { useState, useTransition } from "react";

const FORMATS = [
  { key: "BLOG_POST", label: "Blog posts" },
  { key: "NEIGHBORHOOD_PAGE", label: "Neighborhood pages" },
  { key: "PROPERTY_DESCRIPTION", label: "Property descriptions" },
  { key: "META_REWRITE", label: "Meta rewrites" },
  { key: "FAQ_BLOCK", label: "FAQ blocks" },
  { key: "AD_COPY", label: "Ad copy" },
] as const;

type FormatKey = (typeof FORMATS)[number]["key"];

export type ContentQuotaOverrideProps = {
  orgId: string;
  planTier: string;
  planDefaults: Record<FormatKey, number>;
  currentOverrides: Partial<Record<FormatKey, number>>;
};

export function ContentQuotaOverride({
  orgId,
  planTier,
  planDefaults,
  currentOverrides,
}: ContentQuotaOverrideProps) {
  const [values, setValues] = useState<Record<FormatKey, string>>(() => {
    const initial = {} as Record<FormatKey, string>;
    for (const { key } of FORMATS) {
      const v = currentOverrides[key];
      initial[key] = typeof v === "number" ? String(v) : "";
    }
    return initial;
  });
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saved" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  function update(key: FormatKey, raw: string) {
    setValues((prev) => ({ ...prev, [key]: raw }));
    setStatus({ kind: "idle" });
  }

  function onSave() {
    const overrides: Record<string, number | null> = {};
    for (const { key } of FORMATS) {
      const raw = values[key].trim();
      if (raw === "") {
        overrides[key] = null;
        continue;
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        setStatus({
          kind: "error",
          message: `Invalid value for ${key} — use a non-negative integer or leave blank.`,
        });
        return;
      }
      overrides[key] = parsed;
    }

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/clients/${encodeURIComponent(orgId)}/content-quota`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ overrides }),
          },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setStatus({
            kind: "error",
            message: body.error ?? `Save failed (${res.status})`,
          });
          return;
        }
        setStatus({ kind: "saved" });
      } catch (err) {
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : "Save failed",
        });
      }
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          Content quota overrides
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Plan default tier:{" "}
          <span className="font-medium text-foreground">{planTier}</span>.
          Leave a field blank to use the plan default.
        </p>
      </header>

      <ul className="divide-y divide-border">
        {FORMATS.map(({ key, label }) => (
          <li
            key={key}
            className="grid grid-cols-[1fr_auto_auto] gap-3 items-center py-2"
          >
            <span className="text-sm text-foreground">{label}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              default {planDefaults[key]}
            </span>
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder={String(planDefaults[key])}
              value={values[key]}
              onChange={(e) => update(key, e.target.value)}
              className="w-24 rounded border border-border bg-background px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={`${label} override`}
            />
          </li>
        ))}
      </ul>

      <footer className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs" aria-live="polite">
          {status.kind === "saved" ? (
            <span className="text-foreground">Saved.</span>
          ) : status.kind === "error" ? (
            <span className="text-destructive">{status.message}</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-medium disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save overrides"}
        </button>
      </footer>
    </section>
  );
}
