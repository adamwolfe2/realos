"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  type IntakeFormInput,
  IDENTITY_TYPES,
  VERTICALS,
  TIMELINE_OPTIONS,
  TIER_OPTIONS,
} from "@/lib/site-engine/intake-schema";
import {
  VisualDirectionPicker,
  type VisualDirectionValue,
  type DesignLanguageOption,
  type PaletteOption,
  type PresetOption,
  type UploadedScreenshot,
} from "@/components/site-engine/visual-direction-picker";

// ---------------------------------------------------------------------------
// Site-engine intake form.
//
// Used by both the public page (/sites/request) and the logged-in page
// (/portal/sites/request). The only difference between the two surfaces
// is the `defaults` prop — pre-fill from the user's org when available.
//
// State is held in plain useState (no react-hook-form) so we can keep the
// page bundle small and the form auto-saves to localStorage every change.
// The actual zod validation runs server-side; the form does light client
// checks to surface obvious mistakes early but never blocks submission.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "site-engine.intake.v1";

type Asset = {
  type: IntakeFormInput["assets"][number]["type"];
  filename: string;
  mimeType: string;
  size: number;
  blobUrl: string;
  pathname?: string;
  label?: string;
};

export interface IntakeFormProps {
  /** Pre-filled values (org branding when logged in, ?ref= from URL, etc). */
  defaults?: Partial<IntakeFormInput>;
  /** Hide the submitter card when the user is logged in (we have it already). */
  hideSubmitterFields?: boolean;
  /** Where to send the user after a successful submission. Defaults to the public status URL returned by the API. */
  redirectAfter?: "status_url" | "portal";
  /** Persist localStorage drafts under a per-user key so logged-in customers don't share a draft with random visitors on the same device. */
  storageKeySuffix?: string;
  /** Catalog data for the visual-direction picker. Pass empty arrays to disable a mode. */
  visualDirectionCatalogs: {
    presets: PresetOption[];
    designLanguages: DesignLanguageOption[];
    palettes: PaletteOption[];
  };
  className?: string;
}

const SECTION_ORDER = [
  "identity",
  "brand",
  "compliance",
  "style",
  "colors",
  "visualRefs",
  "assets",
  "voice",
  "content",
  "integrations",
  "domain",
  "timeline",
  "wrap",
] as const;

type SectionId = (typeof SECTION_ORDER)[number];

const SECTION_LABELS: Record<SectionId, string> = {
  identity: "1. About you",
  brand: "2. Brand basics",
  compliance: "3. Compliance",
  style: "4. Style",
  colors: "5. Colors",
  visualRefs: "6. Visual references",
  assets: "7. Assets",
  voice: "8. Voice",
  content: "9. Content",
  integrations: "10. Integrations",
  domain: "11. Domain",
  timeline: "12. Timeline",
  wrap: "13. Anything else",
};

// Section state is held in-memory only (React useState) and is NOT
// persisted to localStorage or the DB — only the form payload is. So
// splitting `visual` into `style`/`colors`/`visualRefs` is purely a
// client-side wizard restructure; no schema migration or legacy section
// id remap is required for in-flight or resumed drafts.

const EMPTY_FORM: IntakeFormInput = {
  submittedByName: "",
  submittedByEmail: "",
  submittedByPhone: undefined,
  submittedByCompany: undefined,
  identityType: undefined,
  tier: "TIER1_MARKETING",
  brandName: "",
  tagline: undefined,
  brandColorHex: undefined,
  vertical: undefined,
  licenseNumber: undefined,
  brokerageName: undefined,
  licenseState: undefined,
  serviceAreas: [],
  hqCity: undefined,
  hqState: undefined,
  currentSiteUrl: undefined,
  domain: undefined,
  domainNeeded: undefined,
  dnsAccess: undefined,
  inspirationUrls: [],
  presetChoice: undefined,
  visualDirection: {},
  voiceSample: undefined,
  bio: undefined,
  services: [],
  testimonials: [],
  keyStats: [],
  calendlyUrl: undefined,
  crmChoice: undefined,
  mlsPreference: undefined,
  ga4Id: undefined,
  timelineExpectation: undefined,
  budgetConfirmed: undefined,
  budgetTier: undefined,
  anythingElse: undefined,
  assets: [],
  source: undefined,
  utmSource: undefined,
  utmMedium: undefined,
  utmCampaign: undefined,
  referrer: undefined,
};

export function IntakeForm({
  defaults,
  hideSubmitterFields = false,
  redirectAfter = "status_url",
  storageKeySuffix = "anon",
  visualDirectionCatalogs,
  className,
}: IntakeFormProps) {
  const router = useRouter();
  const storageKey = `${STORAGE_KEY}.${storageKeySuffix}`;

  const [form, setForm] = React.useState<IntakeFormInput>(() => ({
    ...EMPTY_FORM,
    ...defaults,
  }));
  // Inspiration screenshots live as a parallel state slice. On submit they're
  // merged into form.assets with type=INSPIRATION so the existing storage
  // path / build packet flow remain unchanged.
  const [inspirationUploads, setInspirationUploads] = React.useState<
    UploadedScreenshot[]
  >([]);
  // Multi-modal picker state.
  const [visualDirection, setVisualDirection] = React.useState<VisualDirectionValue>(
    () => ({
      inspirationUrls: defaults?.inspirationUrls ?? [],
      uploadedScreenshots: [],
      chosenPresetSlug: null,
      chosenDesignLanguageSlug: null,
      chosenPaletteSlug: null,
      negativeInputs: "",
    }),
  );
  const [currentSection, setCurrentSection] =
    React.useState<SectionId>("identity");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Keep the form.inspirationUrls field in sync with the picker so legacy
  // submission paths + the zod schema continue to validate.
  React.useEffect(() => {
    setForm((prev) => ({ ...prev, inspirationUrls: visualDirection.inspirationUrls }));
  }, [visualDirection.inspirationUrls]);

  // Keep inspirationUploads in sync with the picker's uploadedScreenshots.
  React.useEffect(() => {
    setInspirationUploads(visualDirection.uploadedScreenshots);
  }, [visualDirection.uploadedScreenshots]);

  // Capture attribution from URL once on mount.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const patch: Partial<IntakeFormInput> = {};
    if (params.get("ref")) patch.source = params.get("ref")!;
    if (params.get("utm_source")) patch.utmSource = params.get("utm_source")!;
    if (params.get("utm_medium")) patch.utmMedium = params.get("utm_medium")!;
    if (params.get("utm_campaign"))
      patch.utmCampaign = params.get("utm_campaign")!;
    if (Object.keys(patch).length) {
      setForm((prev) => ({ ...prev, ...patch }));
    }
  }, []);

  // Hydrate from localStorage on mount.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<IntakeFormInput>;
      setForm((prev) => ({ ...prev, ...parsed, ...defaults }));
    } catch {
      // Corrupt draft — ignore.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist to localStorage on every change (debounced via microtask).
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(form));
      } catch {
        // Quota exceeded — skip.
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [form, storageKey]);

  const update = React.useCallback(
    <K extends keyof IntakeFormInput>(key: K, value: IntakeFormInput[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      // Merge picker state into the form payload:
      //   - inspiration uploads → assets[] with type=INSPIRATION (so the
      //     build packet's inspiration-screenshots/ folder picks them up)
      //   - visualDirection.* (preset / design language / palette / negatives)
      //     → top-level form.visualDirection (server reads + persists)
      const inspirationAssets = inspirationUploads.map((u) => ({
        type: "INSPIRATION" as const,
        filename: u.filename,
        mimeType: u.mimeType,
        size: u.size,
        blobUrl: u.blobUrl,
        label: u.label,
      }));
      const payload = {
        ...form,
        inspirationUrls: visualDirection.inspirationUrls,
        // Don't double-add: filter any stale INSPIRATION-typed entries first.
        assets: [
          ...form.assets.filter((a) => a.type !== "INSPIRATION"),
          ...inspirationAssets,
        ],
        visualDirection: {
          chosenPresetSlug: visualDirection.chosenPresetSlug ?? undefined,
          chosenDesignLanguageSlug:
            visualDirection.chosenDesignLanguageSlug ?? undefined,
          chosenPaletteSlug: visualDirection.chosenPaletteSlug ?? undefined,
          negativeInputs: visualDirection.negativeInputs.trim() || undefined,
        },
      };
      const res = await fetch("/api/site-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        const detail =
          json.issues?.fieldErrors
            ? Object.entries(json.issues.fieldErrors)
                .map(([k, v]) => `${k}: ${(v as string[])?.join(", ")}`)
                .join("; ")
            : json.error || `Submission failed (${res.status})`;
        throw new Error(detail);
      }
      // Clear the draft on success.
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* noop */
      }
      const target =
        redirectAfter === "portal"
          ? `/portal/sites/${encodeURIComponent(json.slug)}`
          : json.statusUrl;
      router.push(target);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Submission failed",
      );
      setSubmitting(false);
    }
  };

  const sectionIndex = SECTION_ORDER.indexOf(currentSection);
  const isFirst = sectionIndex === 0;
  const isLast = sectionIndex === SECTION_ORDER.length - 1;

  const goNext = () => {
    if (!isLast) {
      setCurrentSection(SECTION_ORDER[sectionIndex + 1]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const goPrev = () => {
    if (!isFirst) {
      setCurrentSection(SECTION_ORDER[sectionIndex - 1]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-6", className)}
      noValidate
    >
      {/* Section pills — 13 steps wrap on desktop, scroll horizontally on
          narrow screens so the labels never collide. */}
      <nav
        className="flex gap-1.5 overflow-x-auto md:flex-wrap pb-1 -mx-1 px-1"
        aria-label="Form sections"
      >
        {SECTION_ORDER.map((id, i) => {
          const active = id === currentSection;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setCurrentSection(id)}
              className={cn(
                "shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors whitespace-nowrap",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : i <= sectionIndex
                    ? "bg-muted text-foreground border-border"
                    : "bg-card text-muted-foreground border-border hover:bg-muted/40",
              )}
            >
              {SECTION_LABELS[id]}
            </button>
          );
        })}
      </nav>

      <div className="rounded-lg border border-border bg-card p-6">
        {currentSection === "identity" && (
          <IdentitySection
            form={form}
            update={update}
            hideSubmitterFields={hideSubmitterFields}
          />
        )}
        {currentSection === "brand" && (
          <BrandSection form={form} update={update} />
        )}
        {currentSection === "compliance" && (
          <ComplianceSection form={form} update={update} />
        )}
        {currentSection === "style" && (
          <div className="space-y-5">
            <header>
              <h2 className="text-base font-semibold">Pick your style</h2>
              <p className="text-sm text-muted-foreground">
                Choose one preset or pick from the design language library —
                what do you want your site to feel like?
              </p>
            </header>
            <VisualDirectionPicker
              mode="style"
              value={visualDirection}
              onChange={setVisualDirection}
              presets={visualDirectionCatalogs.presets}
              designLanguages={visualDirectionCatalogs.designLanguages}
              palettes={visualDirectionCatalogs.palettes}
            />
          </div>
        )}
        {currentSection === "colors" && (
          <div className="space-y-5">
            <header>
              <h2 className="text-base font-semibold">Pick your colors</h2>
              <p className="text-sm text-muted-foreground">
                Optional. We'll pull defaults from your brand. Override here if
                you want something specific.
              </p>
            </header>
            <VisualDirectionPicker
              mode="colors"
              value={visualDirection}
              onChange={setVisualDirection}
              presets={visualDirectionCatalogs.presets}
              designLanguages={visualDirectionCatalogs.designLanguages}
              palettes={visualDirectionCatalogs.palettes}
            />
          </div>
        )}
        {currentSection === "visualRefs" && (
          <div className="space-y-5">
            <header>
              <h2 className="text-base font-semibold">Show us what you like</h2>
              <p className="text-sm text-muted-foreground">
                Optional. Paste inspiration URLs or upload screenshots. Helps us
                match the feel you want.
              </p>
            </header>
            <VisualDirectionPicker
              mode="references"
              value={visualDirection}
              onChange={setVisualDirection}
              presets={visualDirectionCatalogs.presets}
              designLanguages={visualDirectionCatalogs.designLanguages}
              palettes={visualDirectionCatalogs.palettes}
            />
          </div>
        )}
        {currentSection === "assets" && (
          <AssetsSection form={form} update={update} />
        )}
        {currentSection === "voice" && (
          <VoiceSection form={form} update={update} />
        )}
        {currentSection === "content" && (
          <ContentSection form={form} update={update} />
        )}
        {currentSection === "integrations" && (
          <IntegrationsSection form={form} update={update} />
        )}
        {currentSection === "domain" && (
          <DomainSection form={form} update={update} />
        )}
        {currentSection === "timeline" && (
          <TimelineSection form={form} update={update} />
        )}
        {currentSection === "wrap" && (
          <WrapSection form={form} update={update} />
        )}
      </div>

      {submitError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {submitError}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Auto-saved locally. Step {sectionIndex + 1} of {SECTION_ORDER.length}.
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={goPrev}
            disabled={isFirst || submitting}
          >
            Back
          </Button>
          {isLast ? (
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          ) : (
            <Button type="button" onClick={goNext} disabled={submitting}>
              Next
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

type UpdateFn = <K extends keyof IntakeFormInput>(
  key: K,
  value: IntakeFormInput[K],
) => void;

interface SectionProps {
  form: IntakeFormInput;
  update: UpdateFn;
}

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
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function IdentitySection({
  form,
  update,
  hideSubmitterFields,
}: SectionProps & { hideSubmitterFields: boolean }) {
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-base font-semibold">About you</h2>
        <p className="text-sm text-muted-foreground">
          Tells us who's submitting and what kind of operation this is for.
        </p>
      </header>
      {!hideSubmitterFields && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Your name">
            <Input
              value={form.submittedByName}
              onChange={(e) => update("submittedByName", e.target.value)}
              required
              autoComplete="name"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.submittedByEmail}
              onChange={(e) => update("submittedByEmail", e.target.value)}
              required
              autoComplete="email"
            />
          </Field>
          <Field label="Phone (optional)">
            <Input
              type="tel"
              value={form.submittedByPhone ?? ""}
              onChange={(e) =>
                update("submittedByPhone", e.target.value || undefined)
              }
              autoComplete="tel"
            />
          </Field>
          <Field label="Company">
            <Input
              value={form.submittedByCompany ?? ""}
              onChange={(e) =>
                update("submittedByCompany", e.target.value || undefined)
              }
              autoComplete="organization"
            />
          </Field>
        </div>
      )}

      <Field label="What best describes your operation?">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {IDENTITY_TYPES.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => update("identityType", id)}
              className={cn(
                "px-3 py-2 rounded-md border text-sm text-left transition-colors",
                form.identityType === id
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-background hover:bg-muted/40",
              )}
            >
              {humanizeIdentity(id)}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Which build tier?">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {TIER_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => update("tier", t)}
              className={cn(
                "px-3 py-3 rounded-md border text-sm text-left transition-colors",
                form.tier === t
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-background hover:bg-muted/40",
              )}
            >
              <div className="font-semibold">{tierLabel(t)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {tierDescription(t)}
              </div>
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function BrandSection({ form, update }: SectionProps) {
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-base font-semibold">Brand basics</h2>
        <p className="text-sm text-muted-foreground">
          The fundamentals — how do you go to market?
        </p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Brand name">
          <Input
            value={form.brandName}
            onChange={(e) => update("brandName", e.target.value)}
            required
          />
        </Field>
        <Field label="Tagline / positioning" hint="One sentence is enough.">
          <Input
            value={form.tagline ?? ""}
            onChange={(e) => update("tagline", e.target.value || undefined)}
          />
        </Field>
        <Field label="Primary brand color" hint="Hex, e.g. #1a1a2e">
          <Input
            value={form.brandColorHex ?? ""}
            onChange={(e) =>
              update("brandColorHex", e.target.value || undefined)
            }
            placeholder="#000000"
          />
        </Field>
        <Field label="Vertical">
          <SelectChips
            value={form.vertical}
            options={VERTICALS}
            onChange={(v) => update("vertical", v as IntakeFormInput["vertical"])}
            humanize={(v) => v.replaceAll("_", " ")}
          />
        </Field>
      </div>
      <Field label="Service areas" hint="Cities or neighborhoods (comma separated).">
        <Input
          value={form.serviceAreas.join(", ")}
          onChange={(e) =>
            update(
              "serviceAreas",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          placeholder="Bend, Sisters, Sunriver"
        />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="HQ city">
          <Input
            value={form.hqCity ?? ""}
            onChange={(e) => update("hqCity", e.target.value || undefined)}
          />
        </Field>
        <Field label="HQ state">
          <Input
            value={form.hqState ?? ""}
            onChange={(e) => update("hqState", e.target.value || undefined)}
          />
        </Field>
      </div>
    </div>
  );
}

function ComplianceSection({ form, update }: SectionProps) {
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-base font-semibold">Compliance</h2>
        <p className="text-sm text-muted-foreground">
          Real estate sites need license + brokerage info in the footer.
          Skip what doesn't apply.
        </p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="License #">
          <Input
            value={form.licenseNumber ?? ""}
            onChange={(e) =>
              update("licenseNumber", e.target.value || undefined)
            }
          />
        </Field>
        <Field label="Brokerage name">
          <Input
            value={form.brokerageName ?? ""}
            onChange={(e) =>
              update("brokerageName", e.target.value || undefined)
            }
          />
        </Field>
        <Field label="License state">
          <Input
            value={form.licenseState ?? ""}
            onChange={(e) =>
              update("licenseState", e.target.value || undefined)
            }
            placeholder="OR"
          />
        </Field>
      </div>
    </div>
  );
}

function AssetsSection({ form, update }: SectionProps) {
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [nextType, setNextType] = React.useState<Asset["type"]>("LOGO");

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    setUploadError(null);
    try {
      const next: Asset[] = [...form.assets];
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/site-requests/upload", {
          method: "POST",
          body,
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || `Upload failed: ${file.name}`);
        }
        next.push({
          type: nextType,
          filename: json.filename,
          mimeType: json.mimeType,
          size: json.size,
          blobUrl: json.url,
          pathname: json.pathname,
        });
      }
      update("assets", next);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAsset = (idx: number) => {
    update(
      "assets",
      form.assets.filter((_, i) => i !== idx),
    );
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-base font-semibold">Assets</h2>
        <p className="text-sm text-muted-foreground">
          Logo, hero photos, headshots, property photos, brand guide PDF.
          Anything you have — we'll process and crop them during build.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-sm font-medium">Asset type</Label>
        <select
          value={nextType}
          onChange={(e) => setNextType(e.target.value as Asset["type"])}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="LOGO">Logo</option>
          <option value="HERO">Hero photo</option>
          <option value="HEADSHOT">Headshot</option>
          <option value="PROPERTY_PHOTO">Property photo</option>
          <option value="LISTING_PHOTO">Listing photo</option>
          <option value="BRAND_GUIDE">Brand guide (PDF)</option>
          <option value="INSPIRATION">Inspiration screenshot</option>
          <option value="OTHER">Other</option>
        </select>
        <Input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
          className="max-w-xs"
        />
        {uploading ? (
          <span className="text-xs text-muted-foreground">Uploading…</span>
        ) : null}
      </div>

      {uploadError ? (
        <div className="text-sm text-destructive">{uploadError}</div>
      ) : null}

      {form.assets.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          No assets uploaded yet. You can submit without any — we'll work with
          what we have and ask for more during triage.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {form.assets.map((a, i) => (
            <li
              key={`${a.blobUrl}-${i}`}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0 flex items-center gap-3">
                {a.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.blobUrl}
                    alt={a.filename}
                    className="size-10 object-cover rounded border border-border"
                  />
                ) : (
                  <div className="size-10 rounded border border-border bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                    PDF
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{a.filename}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.type.replaceAll("_", " ").toLowerCase()} ·{" "}
                    {(a.size / 1024).toFixed(0)} KB
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeAsset(i)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VoiceSection({ form, update }: SectionProps) {
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-base font-semibold">Voice</h2>
        <p className="text-sm text-muted-foreground">
          Paste 200+ words you've already written — a bio, an old listing
          description, anything. We use it to match your tone in the copy.
        </p>
      </header>
      <Field label="Writing sample">
        <textarea
          value={form.voiceSample ?? ""}
          onChange={(e) =>
            update("voiceSample", e.target.value || undefined)
          }
          rows={6}
          className="w-full rounded-md border border-input bg-transparent p-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder="Paste a paragraph you've written before…"
        />
      </Field>
      <Field label="Short bio (optional)">
        <textarea
          value={form.bio ?? ""}
          onChange={(e) => update("bio", e.target.value || undefined)}
          rows={4}
          className="w-full rounded-md border border-input bg-transparent p-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
      </Field>
    </div>
  );
}

function ContentSection({ form, update }: SectionProps) {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-base font-semibold">Content</h2>
        <p className="text-sm text-muted-foreground">
          Anything we should highlight on the site.
        </p>
      </header>

      <RepeaterFields
        label="Services"
        items={form.services}
        onChange={(v) => update("services", v)}
        fields={[
          { key: "title", label: "Title", placeholder: "Buyer representation" },
          { key: "description", label: "Description (optional)", textarea: true },
        ]}
        addLabel="Add service"
        emptyText="No services listed yet."
      />

      <RepeaterFields
        label="Testimonials"
        items={form.testimonials}
        onChange={(v) => update("testimonials", v)}
        fields={[
          { key: "name", label: "Name" },
          { key: "role", label: "Role / source" },
          { key: "quote", label: "Quote", textarea: true },
        ]}
        addLabel="Add testimonial"
        emptyText="No testimonials yet."
      />

      <RepeaterFields
        label="Key stats"
        items={form.keyStats}
        onChange={(v) => update("keyStats", v)}
        fields={[
          { key: "label", label: "Label", placeholder: "Homes sold" },
          { key: "value", label: "Value", placeholder: "$420M" },
        ]}
        addLabel="Add stat"
        emptyText="No stats yet."
      />
    </div>
  );
}

function IntegrationsSection({ form, update }: SectionProps) {
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-base font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Optional. Skip what doesn't apply.
        </p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Calendly / booking URL">
          <Input
            value={form.calendlyUrl ?? ""}
            onChange={(e) =>
              update("calendlyUrl", e.target.value || undefined)
            }
            placeholder="https://calendly.com/…"
          />
        </Field>
        <Field label="CRM">
          <Input
            value={form.crmChoice ?? ""}
            onChange={(e) => update("crmChoice", e.target.value || undefined)}
            placeholder="Follow Up Boss, HubSpot, …"
          />
        </Field>
        <Field label="MLS preference">
          <Input
            value={form.mlsPreference ?? ""}
            onChange={(e) =>
              update("mlsPreference", e.target.value || undefined)
            }
          />
        </Field>
        <Field label="GA4 measurement id">
          <Input
            value={form.ga4Id ?? ""}
            onChange={(e) => update("ga4Id", e.target.value || undefined)}
            placeholder="G-XXXXXXXXXX"
          />
        </Field>
      </div>
    </div>
  );
}

function DomainSection({ form, update }: SectionProps) {
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-base font-semibold">Domain</h2>
        <p className="text-sm text-muted-foreground">
          We can register a fresh one or hook into yours.
        </p>
      </header>
      <Field label="Domain (if you have one)">
        <Input
          value={form.domain ?? ""}
          onChange={(e) => update("domain", e.target.value || undefined)}
          placeholder="example.com"
        />
      </Field>
      <CheckboxRow
        checked={!!form.domainNeeded}
        onChange={(v) => update("domainNeeded", v)}
        label="I need you to register a new domain for me"
      />
      <CheckboxRow
        checked={!!form.dnsAccess}
        onChange={(v) => update("dnsAccess", v)}
        label="I have access to my registrar / DNS settings"
      />
    </div>
  );
}

function TimelineSection({ form, update }: SectionProps) {
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-base font-semibold">Timeline + budget</h2>
        <p className="text-sm text-muted-foreground">
          When do you want this live? What's the budget context?
        </p>
      </header>
      <Field label="Target timeline">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {TIMELINE_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() =>
                update(
                  "timelineExpectation",
                  form.timelineExpectation === t ? undefined : t,
                )
              }
              className={cn(
                "px-3 py-2 rounded-md border text-sm capitalize transition-colors",
                form.timelineExpectation === t
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:bg-muted/40",
              )}
            >
              {humanizeTimeline(t)}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Budget tier (optional)">
        <Input
          value={form.budgetTier ?? ""}
          onChange={(e) => update("budgetTier", e.target.value || undefined)}
          placeholder="e.g. <$10k, $10–25k, $25k+"
        />
      </Field>
      <CheckboxRow
        checked={!!form.budgetConfirmed}
        onChange={(v) => update("budgetConfirmed", v)}
        label="I've confirmed budget approval with anyone who needs to sign off"
      />
    </div>
  );
}

function WrapSection({ form, update }: SectionProps) {
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-base font-semibold">Anything else?</h2>
        <p className="text-sm text-muted-foreground">
          Constraints, must-haves, hard requirements, weird edge cases.
        </p>
      </header>
      <Field label="Notes for the build team">
        <textarea
          value={form.anythingElse ?? ""}
          onChange={(e) =>
            update("anythingElse", e.target.value || undefined)
          }
          rows={6}
          className="w-full rounded-md border border-input bg-transparent p-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
      </Field>
      <div className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Heads up:</strong> once you submit
        we'll email a confirmation with a status link. We'll triage within 1
        business day and follow up with next steps.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function SelectChips<T extends string>({
  value,
  options,
  onChange,
  humanize,
}: {
  value: T | undefined;
  options: readonly T[];
  onChange: (v: T | undefined) => void;
  humanize?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(active ? undefined : opt)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors capitalize",
              active
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted/40",
            )}
          >
            {humanize ? humanize(opt) : opt}
          </button>
        );
      })}
    </div>
  );
}

function CheckboxRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-input"
      />
      <span>{label}</span>
    </label>
  );
}

type RepeaterField = {
  key: string;
  label: string;
  placeholder?: string;
  textarea?: boolean;
};

function RepeaterFields<T extends Record<string, string | undefined>>({
  label,
  items,
  onChange,
  fields,
  addLabel,
  emptyText,
}: {
  label: string;
  items: T[];
  onChange: (next: T[]) => void;
  fields: RepeaterField[];
  addLabel: string;
  emptyText: string;
}) {
  const add = () => {
    const blank: Record<string, string> = {};
    fields.forEach((f) => {
      blank[f.key] = "";
    });
    onChange([...items, blank as T]);
  };

  const updateAt = (idx: number, key: string, value: string) => {
    const next = items.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
    onChange(next);
  };

  const removeAt = (idx: number) =>
    onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          {addLabel}
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it, idx) => (
            <li
              key={idx}
              className="rounded-md border border-border bg-background p-3 space-y-2"
            >
              {fields.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs text-muted-foreground">
                    {f.label}
                  </Label>
                  {f.textarea ? (
                    <textarea
                      value={(it[f.key] as string) ?? ""}
                      onChange={(e) => updateAt(idx, f.key, e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-md border border-input bg-transparent p-2 text-sm"
                      placeholder={f.placeholder}
                    />
                  ) : (
                    <Input
                      value={(it[f.key] as string) ?? ""}
                      onChange={(e) => updateAt(idx, f.key, e.target.value)}
                      className="mt-1"
                      placeholder={f.placeholder}
                    />
                  )}
                </div>
              ))}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAt(idx)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

function humanizeIdentity(id: (typeof IDENTITY_TYPES)[number]) {
  switch (id) {
    case "solo_agent":
      return "Solo agent";
    case "team":
      return "Team";
    case "brokerage":
      return "Brokerage";
    case "property_manager":
      return "Property manager";
    case "developer":
      return "Developer";
    default:
      return "Other";
  }
}

function humanizeTimeline(t: (typeof TIMELINE_OPTIONS)[number]) {
  switch (t) {
    case "asap":
      return "ASAP";
    case "1_month":
      return "Within 1 month";
    case "3_month":
      return "Within 3 months";
    default:
      return "Flexible";
  }
}

function tierLabel(t: (typeof TIER_OPTIONS)[number]) {
  switch (t) {
    case "TIER1_MARKETING":
      return "Marketing site";
    case "TIER2_PORTAL":
      return "Marketing + portal";
    default:
      return "Full custom";
  }
}

function tierDescription(t: (typeof TIER_OPTIONS)[number]) {
  switch (t) {
    case "TIER1_MARKETING":
      return "Single-brand marketing site + contact / capture forms.";
    case "TIER2_PORTAL":
      return "Marketing + lead-capture forms + a lightweight tenant portal stub.";
    default:
      return "Multi-page, custom integrations, listing search, advanced flows.";
  }
}
