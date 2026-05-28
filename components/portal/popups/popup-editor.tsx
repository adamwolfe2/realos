"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PopupPosition,
  PopupStatus,
  PopupTheme,
  PopupTrigger,
} from "@prisma/client";
import {
  setPopupStatus,
  updatePopup,
  deletePopup,
} from "@/lib/actions/popup-actions";
import { getPopupTemplate } from "@/lib/popups/templates";
import { PopupPreview } from "./popup-preview";
import type { PopupPreviewIcon } from "./popup-preview";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PopupEditor — the /portal/popups/[id] surface.
//
// Left: tabbed form (Copy / Design / Featured / Triggers / Capture / Targeting).
// Right: live preview that updates on every keystroke.
//
// Phase 1: added Featured tab + Theme / Accent / Gradient controls on
// Design + dual-CTA + dismiss-text + eyebrow on Copy. All new fields are
// optional; old popups load with NULL values and render identically.
// ---------------------------------------------------------------------------

type Property = { id: string; name: string };

type IconValue = "calendar" | "phone" | "external" | "arrow" | "none" | null;

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
  // Phase 1 additions
  eyebrowText: string | null;
  accentColor: string | null;
  theme: PopupTheme;
  template: string | null;
  featuredLabel: string | null;
  featuredValue: string | null;
  featuredUnit: string | null;
  featuredCaption: string | null;
  secondaryCtaText: string | null;
  secondaryCtaUrl: string | null;
  secondaryCtaIcon: IconValue;
  primaryCtaIcon: IconValue;
  dismissText: string | null;
  gradientColors: string[] | null;
};

type TabKey = "copy" | "design" | "featured" | "triggers" | "capture" | "targeting";

const ICON_OPTIONS: { value: IconValue; label: string }[] = [
  { value: null, label: "No icon" },
  { value: "external", label: "External link" },
  { value: "calendar", label: "Calendar" },
  { value: "phone", label: "Phone" },
  { value: "arrow", label: "Arrow" },
];

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

  const template = useMemo(
    () => getPopupTemplate(state.template),
    [state.template],
  );

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

  function resetToTemplateDefaults() {
    if (!template) return;
    if (
      !confirm(
        `Reset visual + copy fields to the "${template.label}" template defaults? Your trigger and targeting settings are preserved.`,
      )
    ) {
      return;
    }
    const d = template.defaults;
    setState((s) => ({
      ...s,
      eyebrowText: d.eyebrowText ?? null,
      headline: d.headline,
      body: d.body,
      ctaText: d.ctaText,
      ctaUrl: d.ctaUrl,
      primaryCtaIcon: (d.primaryCtaIcon as IconValue) ?? null,
      secondaryCtaText: d.secondaryCtaText ?? null,
      secondaryCtaUrl: d.secondaryCtaUrl ?? null,
      secondaryCtaIcon: (d.secondaryCtaIcon as IconValue) ?? null,
      dismissText: d.dismissText ?? null,
      theme: d.theme,
      primaryColor: d.primaryColor,
      textColor: d.textColor,
      backgroundColor: d.backgroundColor,
      accentColor: d.accentColor ?? null,
      gradientColors: d.gradientColors ?? null,
      featuredLabel: d.featuredLabel ?? null,
      featuredValue: d.featuredValue ?? null,
      featuredUnit: d.featuredUnit ?? null,
      featuredCaption: d.featuredCaption ?? null,
      position: d.position,
    }));
  }

  // Hide the Featured tab when neither template nor current values suggest
  // a price card — keeps the editor uncluttered for tour / referral templates.
  const showFeaturedTab =
    Boolean(
      state.featuredValue ||
        state.featuredLabel ||
        state.featuredCaption ||
        template?.defaults.featuredValue,
    );

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
          {template ? (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                Template
              </span>
              <span className="truncate">{template.label}</span>
              <button
                type="button"
                onClick={resetToTemplateDefaults}
                className="ml-auto text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Reset to defaults
              </button>
            </div>
          ) : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1">
          {(
            [
              ["copy", "Copy"],
              ["design", "Design"],
              showFeaturedTab ? (["featured", "Featured"] as const) : null,
              ["triggers", "Triggers"],
              ["capture", "Capture"],
              ["targeting", "Targeting"],
            ].filter(Boolean) as Array<readonly [TabKey, string]>
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
          {tab === "copy" ? <CopyTab state={state} set={set} /> : null}
          {tab === "design" ? <DesignTab state={state} set={set} /> : null}
          {tab === "featured" ? <FeaturedTab state={state} set={set} /> : null}
          {tab === "triggers" ? <TriggersTab state={state} set={set} /> : null}
          {tab === "capture" ? <CaptureTab state={state} set={set} /> : null}
          {tab === "targeting" ? (
            <TargetingTab state={state} set={set} properties={properties} />
          ) : null}
        </div>
      </div>

      {/* RIGHT — live preview */}
      <div className="space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Live preview · updates as you type
        </div>
        <div className="relative h-[640px] rounded-xl border border-dashed border-border bg-gradient-to-br from-[#F9FAFB] to-[#EFF6FF] overflow-hidden">
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
              ctaUrl={state.ctaUrl}
              offerCode={state.offerCode}
              secondaryText={state.secondaryText}
              position={state.position}
              primaryColor={state.primaryColor}
              textColor={state.textColor}
              backgroundColor={state.backgroundColor}
              heroImageUrl={state.heroImageUrl}
              captureEmail={state.captureEmail}
              capturePhone={state.capturePhone}
              eyebrowText={state.eyebrowText}
              accentColor={state.accentColor}
              theme={state.theme}
              featuredLabel={state.featuredLabel}
              featuredValue={state.featuredValue}
              featuredUnit={state.featuredUnit}
              featuredCaption={state.featuredCaption}
              secondaryCtaText={state.secondaryCtaText}
              secondaryCtaUrl={state.secondaryCtaUrl}
              secondaryCtaIcon={state.secondaryCtaIcon as PopupPreviewIcon}
              primaryCtaIcon={state.primaryCtaIcon as PopupPreviewIcon}
              dismissText={state.dismissText}
              gradientColors={state.gradientColors}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────

type SetFn = <K extends keyof PopupEditorInitial>(
  key: K,
  value: PopupEditorInitial[K],
) => void;

function CopyTab({
  state,
  set,
}: {
  state: PopupEditorInitial;
  set: SetFn;
}) {
  return (
    <>
      <Field label="Eyebrow (optional)" hint="Small caps label above the headline.">
        <input
          value={state.eyebrowText ?? ""}
          onChange={(e) => set("eyebrowText", e.target.value || null)}
          maxLength={60}
          placeholder="LIMITED AVAILABILITY"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm tracking-widest"
        />
      </Field>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Primary CTA text">
          <input
            value={state.ctaText}
            onChange={(e) => set("ctaText", e.target.value)}
            maxLength={40}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Primary CTA url">
          <input
            value={state.ctaUrl}
            onChange={(e) => set("ctaUrl", e.target.value)}
            maxLength={500}
            placeholder="/apply or https://…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>
      <IconField
        label="Primary CTA icon"
        value={state.primaryCtaIcon}
        onChange={(v) => set("primaryCtaIcon", v)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
        <Field label="Secondary CTA text (optional)">
          <input
            value={state.secondaryCtaText ?? ""}
            onChange={(e) => set("secondaryCtaText", e.target.value || null)}
            maxLength={40}
            placeholder="Schedule Tour"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Secondary CTA url">
          <input
            value={state.secondaryCtaUrl ?? ""}
            onChange={(e) => set("secondaryCtaUrl", e.target.value || null)}
            maxLength={500}
            placeholder="/tour"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>
      <IconField
        label="Secondary CTA icon"
        value={state.secondaryCtaIcon}
        onChange={(v) => set("secondaryCtaIcon", v)}
      />

      <Field label="Offer code" hint="Shown as a click-to-copy chip. Leave blank to hide.">
        <input
          value={state.offerCode ?? ""}
          onChange={(e) => set("offerCode", e.target.value || null)}
          maxLength={40}
          placeholder="FALL300"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
        />
      </Field>
      <Field label="Dismiss link text" hint='Tertiary text link below the CTAs. e.g. "Not yet, thanks".'>
        <input
          value={state.dismissText ?? ""}
          onChange={(e) => set("dismissText", e.target.value || null)}
          maxLength={60}
          placeholder="Not yet, thanks"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>
    </>
  );
}

function DesignTab({
  state,
  set,
}: {
  state: PopupEditorInitial;
  set: SetFn;
}) {
  return (
    <>
      <Field label="Theme">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(
            [
              [PopupTheme.LIGHT, "Light"],
              [PopupTheme.DARK, "Dark"],
              [PopupTheme.GRADIENT, "Gradient"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => set("theme", value)}
              className={cn(
                "rounded-md border px-2 py-2 text-xs font-semibold transition-colors",
                state.theme === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Position">
        <select
          value={state.position}
          onChange={(e) => set("position", e.target.value as PopupPosition)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="CENTER">Center modal</option>
          <option value="BOTTOM_RIGHT">Bottom right toast</option>
          <option value="BOTTOM_LEFT">Bottom left toast</option>
          <option value="TOP_BANNER">Top banner</option>
        </select>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ColorField
          label="Primary"
          value={state.primaryColor}
          onChange={(v) => set("primaryColor", v)}
        />
        <ColorField
          label="Accent"
          value={state.accentColor ?? state.primaryColor}
          onChange={(v) => set("accentColor", v)}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {state.theme === PopupTheme.GRADIENT || state.theme === PopupTheme.DARK ? (
        <GradientStopsField
          value={state.gradientColors}
          onChange={(v) => set("gradientColors", v)}
        />
      ) : null}

      <Field label="Hero image URL (optional)">
        <input
          value={state.heroImageUrl ?? ""}
          onChange={(e) => set("heroImageUrl", e.target.value || null)}
          placeholder="https://cdn.your-property.com/hero.jpg"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
        />
      </Field>
    </>
  );
}

function FeaturedTab({
  state,
  set,
}: {
  state: PopupEditorInitial;
  set: SetFn;
}) {
  return (
    <>
      <p className="text-[11px] text-muted-foreground leading-snug -mt-1">
        Render a featured value card between the body and CTAs. Use it to highlight
        a rate, discount, or limited-time price. Leave the value blank to hide.
      </p>
      <Field label="Featured label" hint='Tiny uppercase label above the value. e.g. "RATES AS LOW AS".'>
        <input
          value={state.featuredLabel ?? ""}
          onChange={(e) => set("featuredLabel", e.target.value || null)}
          maxLength={60}
          placeholder="RATES AS LOW AS"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm tracking-widest"
        />
      </Field>
      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <Field label="Featured value">
          <input
            value={state.featuredValue ?? ""}
            onChange={(e) => set("featuredValue", e.target.value || null)}
            maxLength={40}
            placeholder="$765"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-bold"
          />
        </Field>
        <Field label="Unit">
          <input
            value={state.featuredUnit ?? ""}
            onChange={(e) => set("featuredUnit", e.target.value || null)}
            maxLength={20}
            placeholder="/mo"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>
      <Field label="Caption" hint="Muted sub-line below the value.">
        <input
          value={state.featuredCaption ?? ""}
          onChange={(e) => set("featuredCaption", e.target.value || null)}
          maxLength={120}
          placeholder="+ $85/mo amenity fee"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>
    </>
  );
}

function TriggersTab({
  state,
  set,
}: {
  state: PopupEditorInitial;
  set: SetFn;
}) {
  return (
    <>
      <Field label="Trigger">
        <select
          value={state.trigger}
          onChange={(e) => set("trigger", e.target.value as PopupTrigger)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="EXIT_INTENT">Exit intent (mouse leaves top)</option>
          <option value="SCROLL_DEPTH">Scroll depth (% of page)</option>
          <option value="TIME_ON_PAGE">Time on page (seconds)</option>
          <option value="IDLE_TIME">Idle time (no scroll/click for N seconds)</option>
          <option value="IMMEDIATE">Immediate</option>
        </select>
      </Field>
      {state.trigger === "SCROLL_DEPTH" ||
      state.trigger === "TIME_ON_PAGE" ||
      state.trigger === "IDLE_TIME" ? (
        <Field
          label={
            state.trigger === "SCROLL_DEPTH"
              ? "Scroll threshold (%)"
              : state.trigger === "TIME_ON_PAGE"
                ? "Time threshold (seconds)"
                : "Idle threshold (seconds)"
          }
        >
          <input
            type="number"
            min={0}
            max={state.trigger === "SCROLL_DEPTH" ? 100 : 600}
            value={state.triggerThreshold}
            onChange={(e) => set("triggerThreshold", Number(e.target.value) || 0)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
      ) : null}
      <Field label="Frequency" hint="Once per session prevents popup fatigue.">
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
  );
}

function CaptureTab({
  state,
  set,
}: {
  state: PopupEditorInitial;
  set: SetFn;
}) {
  return (
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
        Submissions are written to <code>/portal/leads</code> with source set to{" "}
        <code>popup:{state.id.slice(0, 6)}…</code> so you can attribute downstream
        conversions back to this campaign.
      </p>
    </>
  );
}

function TargetingTab({
  state,
  set,
  properties,
}: {
  state: PopupEditorInitial;
  set: SetFn;
  properties: Property[];
}) {
  return (
    <>
      <Field
        label="Property scope"
        hint="Leave on Portfolio to fire on every site this org has installed the embed. Pick a property to scope the popup to that property's embed only."
      >
        <select
          value={state.propertyId ?? ""}
          onChange={(e) => set("propertyId", e.target.value || null)}
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

function GradientStopsField({
  value,
  onChange,
}: {
  value: string[] | null;
  onChange: (v: string[] | null) => void;
}) {
  const stops = value ?? [];
  function setAt(i: number, hex: string) {
    const next = stops.slice();
    next[i] = hex;
    onChange(next);
  }
  function addStop() {
    if (stops.length >= 4) return;
    onChange([...stops, "#FFFFFF"]);
  }
  function removeStop(i: number) {
    const next = stops.filter((_, idx) => idx !== i);
    onChange(next.length === 0 ? null : next);
  }
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Gradient stops
      </div>
      {stops.length >= 2 ? (
        <div
          className="h-2 rounded-full"
          style={{ background: `linear-gradient(90deg, ${stops.join(", ")})` }}
        />
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Add at least 2 stops to render the gradient accent bar.
        </p>
      )}
      <div className="space-y-1.5">
        {stops.map((stop, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="color"
              value={stop}
              onChange={(e) => setAt(i, e.target.value)}
              className="h-8 w-8 rounded-md border border-border cursor-pointer"
            />
            <input
              value={stop}
              onChange={(e) => setAt(i, e.target.value)}
              className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => removeStop(i)}
              className="text-[10px] text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {stops.length < 4 ? (
        <button
          type="button"
          onClick={addStop}
          className="text-[11px] font-medium text-primary hover:underline"
        >
          + Add stop
        </button>
      ) : null}
    </div>
  );
}

function IconField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: IconValue;
  onChange: (v: IconValue) => void;
}) {
  return (
    <Field label={label}>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          onChange((raw || null) as IconValue);
        }}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        {ICON_OPTIONS.map((o) => (
          <option key={o.value ?? "none"} value={o.value ?? ""}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
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
