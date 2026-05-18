"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PopupPosition,
  PopupStatus,
  PopupTrigger,
} from "@prisma/client";
import {
  setPopupStatus,
  updatePopup,
  deletePopup,
} from "@/lib/actions/popup-actions";
import { PopupPreview } from "./popup-preview";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PopupEditor — the /portal/popups/[id] surface.
//
// Left: tabbed form (Copy / Design / Triggers / Capture / Targeting).
// Right: live preview that updates on every keystroke.
//
// Why one big client component instead of a multi-form wizard:
// the preview only feels alive when state lives in one place. Splitting
// the form across server-rendered tabs would force a round-trip on every
// edit. The save action is still a server action — useTransition gives
// us pending UI without a loading spinner cascade.
// ---------------------------------------------------------------------------

type Property = { id: string; name: string };

export type PopupEditorInitial = {
  id: string;
  name: string;
  status: PopupStatus;
  headline: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  offerCode: string | null;
  secondaryText: string | null;
  trigger: PopupTrigger;
  triggerThreshold: number;
  targetUrlPatterns: string[];
  frequency: string;
  position: PopupPosition;
  primaryColor: string;
  textColor: string;
  backgroundColor: string;
  heroImageUrl: string | null;
  captureEmail: boolean;
  capturePhone: boolean;
  propertyId: string | null;
};

type TabKey = "copy" | "design" | "triggers" | "capture" | "targeting";

export function PopupEditor({
  initial,
  properties,
}: {
  initial: PopupEditorInitial;
  properties: Property[];
}) {
  const router = useRouter();
  const [state, setState] = useState<PopupEditorInitial>(initial);
  const [tab, setTab] = useState<TabKey>("copy");
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PopupEditorInitial>(
    key: K,
    value: PopupEditorInitial[K],
  ) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updatePopup(state.id, state);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  function toggleStatus(next: PopupStatus) {
    startTransition(async () => {
      const result = await setPopupStatus(state.id, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      set("status", next);
      router.refresh();
    });
  }

  function handleDelete() {
    if (
      !confirm(
        `Delete "${state.name}"? This removes the popup and its analytics. Cannot be undone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deletePopup(state.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/portal/popups");
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-4">
      {/* LEFT — controls */}
      <div className="space-y-3">
        {/* Header + actions */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <input
              value={state.name}
              onChange={(e) => set("name", e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-base font-semibold tracking-tight text-foreground focus:outline-none"
              placeholder="Popup name"
            />
            <StatusPill status={state.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-3.5 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {pending ? "Saving…" : savedAt ? "Saved" : "Save changes"}
            </button>
            {state.status !== PopupStatus.ACTIVE ? (
              <button
                type="button"
                onClick={() => toggleStatus(PopupStatus.ACTIVE)}
                disabled={pending}
                className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Publish live
              </button>
            ) : (
              <button
                type="button"
                onClick={() => toggleStatus(PopupStatus.PAUSED)}
                disabled={pending}
                className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Pause
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="ml-auto inline-flex items-center text-xs text-destructive hover:underline disabled:opacity-50"
            >
              Delete
            </button>
          </div>
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          {(
            [
              ["copy", "Copy"],
              ["design", "Design"],
              ["triggers", "Triggers"],
              ["capture", "Capture"],
              ["targeting", "Targeting"],
            ] as Array<[TabKey, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors",
                tab === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3.5">
          {tab === "copy" ? (
            <>
              <Field label="Headline">
                <input
                  value={state.headline}
                  onChange={(e) => set("headline", e.target.value)}
                  maxLength={120}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Body">
                <textarea
                  value={state.body}
                  onChange={(e) => set("body", e.target.value)}
                  maxLength={600}
                  rows={4}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="CTA text">
                  <input
                    value={state.ctaText}
                    onChange={(e) => set("ctaText", e.target.value)}
                    maxLength={40}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="CTA url">
                  <input
                    value={state.ctaUrl}
                    onChange={(e) => set("ctaUrl", e.target.value)}
                    maxLength={500}
                    placeholder="/apply or https://…"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
              </div>
              <Field
                label="Offer code"
                hint="Shown as a click-to-copy chip. Leave blank to hide."
              >
                <input
                  value={state.offerCode ?? ""}
                  onChange={(e) =>
                    set("offerCode", e.target.value || null)
                  }
                  maxLength={40}
                  placeholder="FALL300"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                />
              </Field>
              <Field label="Dismiss link (optional)">
                <input
                  value={state.secondaryText ?? ""}
                  onChange={(e) =>
                    set("secondaryText", e.target.value || null)
                  }
                  maxLength={40}
                  placeholder="No thanks"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
            </>
          ) : null}

          {tab === "design" ? (
            <>
              <Field label="Position">
                <select
                  value={state.position}
                  onChange={(e) =>
                    set("position", e.target.value as PopupPosition)
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="CENTER">Center modal</option>
                  <option value="BOTTOM_RIGHT">Bottom right toast</option>
                  <option value="BOTTOM_LEFT">Bottom left toast</option>
                  <option value="TOP_BANNER">Top banner</option>
                </select>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <ColorField
                  label="Accent"
                  value={state.primaryColor}
                  onChange={(v) => set("primaryColor", v)}
                />
                <ColorField
                  label="Text"
                  value={state.textColor}
                  onChange={(v) => set("textColor", v)}
                />
                <ColorField
                  label="Background"
                  value={state.backgroundColor}
                  onChange={(v) => set("backgroundColor", v)}
                />
              </div>
              <Field label="Hero image URL (optional)">
                <input
                  value={state.heroImageUrl ?? ""}
                  onChange={(e) =>
                    set("heroImageUrl", e.target.value || null)
                  }
                  placeholder="https://images.unsplash.com/…"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                />
              </Field>
            </>
          ) : null}

          {tab === "triggers" ? (
            <>
              <Field label="Trigger">
                <select
                  value={state.trigger}
                  onChange={(e) =>
                    set("trigger", e.target.value as PopupTrigger)
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="EXIT_INTENT">Exit intent (mouse leaves top)</option>
                  <option value="SCROLL_DEPTH">Scroll depth (% of page)</option>
                  <option value="TIME_ON_PAGE">Time on page (seconds)</option>
                  <option value="IMMEDIATE">Immediate</option>
                </select>
              </Field>
              {state.trigger === "SCROLL_DEPTH" ||
              state.trigger === "TIME_ON_PAGE" ? (
                <Field
                  label={
                    state.trigger === "SCROLL_DEPTH"
                      ? "Scroll threshold (%)"
                      : "Time threshold (seconds)"
                  }
                >
                  <input
                    type="number"
                    min={0}
                    max={state.trigger === "SCROLL_DEPTH" ? 100 : 600}
                    value={state.triggerThreshold}
                    onChange={(e) =>
                      set("triggerThreshold", Number(e.target.value) || 0)
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </Field>
              ) : null}
              <Field
                label="Frequency"
                hint="Once per session prevents popup fatigue."
              >
                <select
                  value={state.frequency}
                  onChange={(e) => set("frequency", e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="session">Once per browser session</option>
                  <option value="once_per_day">Once per day</option>
                  <option value="always">Every page load</option>
                </select>
              </Field>
            </>
          ) : null}

          {tab === "capture" ? (
            <>
              <CheckRow
                label="Capture email"
                hint="Show an email input above the CTA. Submissions become leads."
                checked={state.captureEmail}
                onChange={(v) => set("captureEmail", v)}
              />
              <CheckRow
                label="Also capture phone (optional)"
                hint="Adds a phone field below email."
                checked={state.capturePhone}
                disabled={!state.captureEmail}
                onChange={(v) => set("capturePhone", v)}
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Submissions are written to <code>/portal/leads</code> with
                source set to <code>popup:{state.id.slice(0, 6)}…</code>
                so you can attribute downstream conversions back to this
                campaign.
              </p>
            </>
          ) : null}

          {tab === "targeting" ? (
            <>
              <Field
                label="Property scope"
                hint="Leave on Portfolio to fire on every site this org has installed the embed. Pick a property to scope the popup to that property's embed only."
              >
                <select
                  value={state.propertyId ?? ""}
                  onChange={(e) =>
                    set("propertyId", e.target.value || null)
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Portfolio — every property</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="URL allowlist (one per line)"
                hint="Empty = every page. Otherwise the popup only fires on pages whose URL path contains one of these substrings."
              >
                <textarea
                  value={state.targetUrlPatterns.join("\n")}
                  onChange={(e) =>
                    set(
                      "targetUrlPatterns",
                      e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  rows={4}
                  placeholder="/floor-plans&#10;/apply"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono resize-none"
                />
              </Field>
            </>
          ) : null}
        </div>
      </div>

      {/* RIGHT — live preview */}
      <div className="space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Live preview · updates as you type
        </div>
        <div className="relative h-[640px] rounded-xl border border-dashed border-border bg-gradient-to-br from-[#F9FAFB] to-[#EFF6FF] overflow-hidden">
          {/* Fake browser chrome to set context */}
          <div className="absolute top-0 inset-x-0 h-8 bg-white/70 border-b border-border flex items-center gap-1.5 px-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]/70" />
            <span className="ml-3 text-[10px] font-mono text-muted-foreground truncate">
              {state.propertyId ? "your-property.example" : "your-site.com"}
            </span>
          </div>
          <div className="absolute inset-0 pt-8">
            <PopupPreview
              contained
              headline={state.headline}
              body={state.body}
              ctaText={state.ctaText}
              offerCode={state.offerCode}
              secondaryText={state.secondaryText}
              position={state.position}
              primaryColor={state.primaryColor}
              textColor={state.textColor}
              backgroundColor={state.backgroundColor}
              heroImageUrl={state.heroImageUrl}
              captureEmail={state.captureEmail}
              capturePhone={state.capturePhone}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── tiny presentational helpers ────────────────────────────────────────
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="block text-[11px] text-muted-foreground leading-snug">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 rounded-md border border-border cursor-pointer"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
        />
      </span>
    </label>
  );
}

function CheckRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-2.5 rounded-md border border-border bg-background p-3 cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">
          {hint}
        </span>
      </span>
    </label>
  );
}

function StatusPill({ status }: { status: PopupStatus }) {
  const tone =
    status === PopupStatus.ACTIVE
      ? "bg-emerald-50 text-emerald-700"
      : status === PopupStatus.PAUSED
        ? "bg-amber-50 text-amber-700"
        : status === PopupStatus.ARCHIVED
          ? "bg-muted text-muted-foreground"
          : "bg-primary/10 text-primary";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest shrink-0",
        tone,
      )}
    >
      {status}
    </span>
  );
}
