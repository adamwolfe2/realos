"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TenantSiteConfig } from "@prisma/client";

type Initial = TenantSiteConfig | null;

type FormState = {
  siteTitle: string;
  tagline: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroImageUrl: string;
  aboutCopy: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  phoneNumber: string;
  contactEmail: string;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  showListings: boolean;
  showFloorPlans: boolean;
  showAmenities: boolean;
  showReviews: boolean;
  showBlog: boolean;
  enableExitIntent: boolean;
  enableChatbot: boolean;
  enablePixel: boolean;
  chatbotAvatarUrl: string;
  chatbotPersonaName: string;
  chatbotGreeting: string;
  chatbotKnowledgeBase: string;
  chatbotIdleTriggerSeconds: number;
  exitIntentHeadline: string;
  exitIntentBody: string;
  exitIntentCtaText: string;
  exitIntentOfferCode: string;
};

const META_TITLE_MAX = 60;
const META_DESC_MAX = 160;
const HERO_HEADLINE_RECOMMENDED = 80;

function init(initial: Initial, orgName: string): FormState {
  return {
    siteTitle: initial?.siteTitle ?? orgName,
    tagline: initial?.tagline ?? "",
    heroHeadline: initial?.heroHeadline ?? "",
    heroSubheadline: initial?.heroSubheadline ?? "",
    heroImageUrl: initial?.heroImageUrl ?? "",
    aboutCopy: initial?.aboutCopy ?? "",
    primaryCtaText: initial?.primaryCtaText ?? "Apply Now",
    primaryCtaUrl: initial?.primaryCtaUrl ?? "",
    phoneNumber: initial?.phoneNumber ?? "",
    contactEmail: initial?.contactEmail ?? "",
    metaTitle: initial?.metaTitle ?? "",
    metaDescription: initial?.metaDescription ?? "",
    ogImageUrl: initial?.ogImageUrl ?? "",
    showListings: initial?.showListings ?? true,
    showFloorPlans: initial?.showFloorPlans ?? true,
    showAmenities: initial?.showAmenities ?? true,
    showReviews: initial?.showReviews ?? false,
    showBlog: initial?.showBlog ?? false,
    enableExitIntent: initial?.enableExitIntent ?? true,
    enableChatbot: initial?.enableChatbot ?? false,
    enablePixel: initial?.enablePixel ?? false,
    chatbotAvatarUrl: initial?.chatbotAvatarUrl ?? "",
    chatbotPersonaName: initial?.chatbotPersonaName ?? "",
    chatbotGreeting: initial?.chatbotGreeting ?? "",
    chatbotKnowledgeBase: initial?.chatbotKnowledgeBase ?? "",
    chatbotIdleTriggerSeconds: initial?.chatbotIdleTriggerSeconds ?? 5,
    exitIntentHeadline: initial?.exitIntentHeadline ?? "",
    exitIntentBody: initial?.exitIntentBody ?? "",
    exitIntentCtaText: initial?.exitIntentCtaText ?? "",
    exitIntentOfferCode: initial?.exitIntentOfferCode ?? "",
  };
}

function isValidUrl(v: string): boolean {
  if (!v) return true;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

function isValidEmail(v: string): boolean {
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function SiteBuilderForm({
  orgName,
  orgSlug,
  primaryDomain,
  moduleChatbot,
  modulePixel,
  initial,
}: {
  orgName: string;
  orgSlug: string;
  primaryDomain: string | null;
  moduleChatbot: boolean;
  modulePixel: boolean;
  initial: Initial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initialSnapshot = useMemo(() => init(initial, orgName), [initial, orgName]);
  const [state, setState] = useState<FormState>(initialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const isDirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(initialSnapshot),
    [state, initialSnapshot],
  );

  const validation = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!isValidUrl(state.heroImageUrl))
      errors.heroImageUrl = "Not a valid URL";
    if (!isValidUrl(state.primaryCtaUrl))
      errors.primaryCtaUrl = "Not a valid URL";
    if (!isValidUrl(state.ogImageUrl)) errors.ogImageUrl = "Not a valid URL";
    if (!isValidUrl(state.chatbotAvatarUrl))
      errors.chatbotAvatarUrl = "Not a valid URL";
    if (!isValidEmail(state.contactEmail))
      errors.contactEmail = "Not a valid email";
    if (state.metaTitle.length > META_TITLE_MAX)
      errors.metaTitle = `Trim to ${META_TITLE_MAX} characters`;
    if (state.metaDescription.length > META_DESC_MAX)
      errors.metaDescription = `Trim to ${META_DESC_MAX} characters`;
    return errors;
  }, [state]);

  const hasValidationErrors = Object.keys(validation).length > 0;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  }

  function discard() {
    setState(initialSnapshot);
    setSavedAt(null);
    setError(null);
  }

  function toNullIfEmpty<T>(v: T): T | null {
    return typeof v === "string" && v.trim() === "" ? null : v;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (hasValidationErrors) return;
    setError(null);
    startTransition(async () => {
      const payload: Record<string, unknown> = {
        siteTitle: toNullIfEmpty(state.siteTitle),
        tagline: toNullIfEmpty(state.tagline),
        heroHeadline: toNullIfEmpty(state.heroHeadline),
        heroSubheadline: toNullIfEmpty(state.heroSubheadline),
        heroImageUrl: toNullIfEmpty(state.heroImageUrl),
        aboutCopy: toNullIfEmpty(state.aboutCopy),
        primaryCtaText: toNullIfEmpty(state.primaryCtaText),
        primaryCtaUrl: toNullIfEmpty(state.primaryCtaUrl),
        phoneNumber: toNullIfEmpty(state.phoneNumber),
        contactEmail: toNullIfEmpty(state.contactEmail),
        metaTitle: toNullIfEmpty(state.metaTitle),
        metaDescription: toNullIfEmpty(state.metaDescription),
        ogImageUrl: toNullIfEmpty(state.ogImageUrl),
        showListings: state.showListings,
        showFloorPlans: state.showFloorPlans,
        showAmenities: state.showAmenities,
        showReviews: state.showReviews,
        showBlog: state.showBlog,
        enableExitIntent: state.enableExitIntent,
        enableChatbot: moduleChatbot ? state.enableChatbot : false,
        enablePixel: modulePixel ? state.enablePixel : false,
        chatbotAvatarUrl: toNullIfEmpty(state.chatbotAvatarUrl),
        chatbotPersonaName: toNullIfEmpty(state.chatbotPersonaName),
        chatbotGreeting: toNullIfEmpty(state.chatbotGreeting),
        chatbotKnowledgeBase: toNullIfEmpty(state.chatbotKnowledgeBase),
        chatbotIdleTriggerSeconds: state.chatbotIdleTriggerSeconds,
        exitIntentHeadline: toNullIfEmpty(state.exitIntentHeadline),
        exitIntentBody: toNullIfEmpty(state.exitIntentBody),
        exitIntentCtaText: toNullIfEmpty(state.exitIntentCtaText),
        exitIntentOfferCode: toNullIfEmpty(state.exitIntentOfferCode),
      };

      const res = await fetch("/api/tenant/site-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to save");
        return;
      }
      setSavedAt(new Date());
      router.refresh();
    });
  }

  const previewUrl = primaryDomain
    ? `https://${primaryDomain}`
    : `https://${orgSlug}.${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "leasestack.co"}`;

  return (
    <form onSubmit={submit} className="space-y-6 pb-24">
      <Section
        title="Identity"
        description="The name + tagline visible across the marketing site and tab title."
      >
        <Field
          label="Site title"
          value={state.siteTitle}
          onChange={(v) => update("siteTitle", v)}
          help="Shown in the browser tab and as the OG site name. Often the property or company name."
        />
        <Field
          label="Tagline"
          value={state.tagline}
          onChange={(v) => update("tagline", v)}
          help="One short sentence under the site title."
        />
      </Section>

      <Section
        title="Hero"
        description="Top-of-page banner. The first thing every visitor sees."
      >
        <Field
          label="Headline"
          value={state.heroHeadline}
          onChange={(v) => update("heroHeadline", v)}
          counter={{
            current: state.heroHeadline.length,
            max: HERO_HEADLINE_RECOMMENDED,
            soft: true,
          }}
        />
        <Field
          label="Subheadline"
          value={state.heroSubheadline}
          onChange={(v) => update("heroSubheadline", v)}
        />
        <Field
          label="Hero image URL"
          value={state.heroImageUrl}
          onChange={(v) => update("heroImageUrl", v)}
          type="url"
          error={validation.heroImageUrl}
          help="HTTPS, ideally 16:9. Hosted anywhere (Vercel Blob, S3, Cloudinary)."
        />
      </Section>

      <Section
        title="About + content"
        description="Long-form copy below the hero. Markdown not supported (yet)."
      >
        <TextArea
          label="About copy"
          value={state.aboutCopy}
          onChange={(v) => update("aboutCopy", v)}
          rows={8}
          counter={{ current: state.aboutCopy.length, soft: true }}
        />
      </Section>

      <Section
        title="Primary CTA + contact"
        description="The single button that turns visitors into leads."
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label="CTA text"
            value={state.primaryCtaText}
            onChange={(v) => update("primaryCtaText", v)}
            help='Common: "Apply Now", "Schedule a Tour", "Get in Touch".'
          />
          <Field
            label="CTA URL"
            value={state.primaryCtaUrl}
            onChange={(v) => update("primaryCtaUrl", v)}
            type="url"
            error={validation.primaryCtaUrl}
            help="External Apply link, or /apply for the in-app flow."
          />
          <Field
            label="Phone"
            value={state.phoneNumber}
            onChange={(v) => update("phoneNumber", v)}
          />
          <Field
            label="Contact email"
            value={state.contactEmail}
            onChange={(v) => update("contactEmail", v)}
            type="email"
            error={validation.contactEmail}
          />
        </div>
      </Section>

      <Section
        title="SEO + social preview"
        description="What Google + social platforms show when this site is shared."
      >
        <Field
          label="Meta title"
          value={state.metaTitle}
          onChange={(v) => update("metaTitle", v)}
          counter={{ current: state.metaTitle.length, max: META_TITLE_MAX }}
          error={validation.metaTitle}
          help="Shown in Google results and as the page tab. Keep under 60 chars."
        />
        <TextArea
          label="Meta description"
          value={state.metaDescription}
          onChange={(v) => update("metaDescription", v)}
          rows={2}
          counter={{ current: state.metaDescription.length, max: META_DESC_MAX }}
          error={validation.metaDescription}
          help="One-sentence summary under the title in Google results. Under 160."
        />
        <Field
          label="OG image URL"
          value={state.ogImageUrl}
          onChange={(v) => update("ogImageUrl", v)}
          type="url"
          error={validation.ogImageUrl}
          help="Square or 1.91:1 ratio. Used by Twitter, LinkedIn, Slack previews."
        />
      </Section>

      <Section
        title="Sections visible on the site"
        description="Toggle which sections render on the tenant marketing site."
      >
        <div className="grid sm:grid-cols-2 gap-2">
          <Toggle
            label="Listings"
            checked={state.showListings}
            onChange={(v) => update("showListings", v)}
          />
          <Toggle
            label="Floor plans"
            checked={state.showFloorPlans}
            onChange={(v) => update("showFloorPlans", v)}
          />
          <Toggle
            label="Amenities"
            checked={state.showAmenities}
            onChange={(v) => update("showAmenities", v)}
          />
          <Toggle
            label="Reviews"
            checked={state.showReviews}
            onChange={(v) => update("showReviews", v)}
          />
          <Toggle
            label="Blog"
            checked={state.showBlog}
            onChange={(v) => update("showBlog", v)}
          />
        </div>
      </Section>

      <Section
        title="Chatbot"
        description={
          moduleChatbot
            ? "Floating widget that captures leads conversationally."
            : "Module disabled. Ask agency to enable it on this workspace."
        }
      >
        <Toggle
          label="Show chatbot widget on the site"
          checked={state.enableChatbot && moduleChatbot}
          onChange={(v) => update("enableChatbot", v)}
          disabled={!moduleChatbot}
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label="Persona name"
            value={state.chatbotPersonaName}
            onChange={(v) => update("chatbotPersonaName", v)}
            help='Bot identity, e.g. "Sarah" or "Concierge".'
          />
          <Field
            label="Avatar URL"
            value={state.chatbotAvatarUrl}
            onChange={(v) => update("chatbotAvatarUrl", v)}
            type="url"
            error={validation.chatbotAvatarUrl}
          />
          <Field
            label="Greeting"
            value={state.chatbotGreeting}
            onChange={(v) => update("chatbotGreeting", v)}
          />
          <NumberField
            label="Idle trigger seconds"
            value={state.chatbotIdleTriggerSeconds}
            onChange={(v) => update("chatbotIdleTriggerSeconds", v)}
            min={0}
            max={600}
            help="Seconds before the bot proactively pops up."
          />
        </div>
        <TextArea
          label="Knowledge base"
          value={state.chatbotKnowledgeBase}
          onChange={(v) => update("chatbotKnowledgeBase", v)}
          rows={10}
          counter={{ current: state.chatbotKnowledgeBase.length, soft: true }}
          help="Facts, pricing guidance, tour-booking instructions, things the bot must know. Plain text."
        />
      </Section>

      <Section
        title="Exit intent"
        description="Popup when the visitor's mouse leaves the window."
      >
        <Toggle
          label="Enable exit-intent popup"
          checked={state.enableExitIntent}
          onChange={(v) => update("enableExitIntent", v)}
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label="Popup headline"
            value={state.exitIntentHeadline}
            onChange={(v) => update("exitIntentHeadline", v)}
          />
          <Field
            label="CTA text"
            value={state.exitIntentCtaText}
            onChange={(v) => update("exitIntentCtaText", v)}
          />
          <Field
            label="Popup body"
            value={state.exitIntentBody}
            onChange={(v) => update("exitIntentBody", v)}
          />
          <Field
            label="Offer code"
            value={state.exitIntentOfferCode}
            onChange={(v) => update("exitIntentOfferCode", v)}
            help="Optional discount/promo code shown in the popup."
          />
        </div>
      </Section>

      <Section title="Visitor pixel" description="First-party tracking pixel.">
        <Toggle
          label={`Enable pixel${modulePixel ? "" : " (module disabled)"}`}
          checked={state.enablePixel && modulePixel}
          onChange={(v) => update("enablePixel", v)}
          disabled={!modulePixel}
        />
      </Section>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground min-w-0 truncate">
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : pending ? (
              "Saving..."
            ) : isDirty ? (
              "Unsaved changes"
            ) : savedAt ? (
              <span className="text-emerald-700">
                Saved {savedAt.toLocaleTimeString()}
              </span>
            ) : (
              "All changes saved"
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted/40"
            >
              Preview site
            </a>
            <button
              type="button"
              onClick={discard}
              disabled={!isDirty || pending}
              className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-muted/40 disabled:opacity-40"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={pending || !isDirty || hasValidationErrors}
              className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-40"
            >
              {pending ? "Saving..." : hasValidationErrors ? "Fix errors first" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        ) : null}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

type Counter = {
  current: number;
  max?: number;
  // soft = warn but don't block (suggested limit). hard counter blocks save.
  soft?: boolean;
};

function CharCounter({ counter }: { counter: Counter }) {
  if (counter.max == null) {
    return (
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {counter.current.toLocaleString()} chars
      </span>
    );
  }
  const over = counter.current > counter.max;
  return (
    <span
      className={`text-[10px] tabular-nums ${
        over
          ? counter.soft
            ? "text-amber-700"
            : "text-destructive"
          : "text-muted-foreground"
      }`}
    >
      {counter.current}/{counter.max}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  help,
  error,
  counter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  help?: string;
  error?: string;
  counter?: Counter;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {counter ? <CharCounter counter={counter} /> : null}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-md border bg-card px-3 py-2 text-sm ${
          error ? "border-destructive" : "border-border"
        }`}
      />
      {error ? (
        <span className="text-[11px] text-destructive">{error}</span>
      ) : help ? (
        <span className="text-[11px] text-muted-foreground">{help}</span>
      ) : null}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  help,
  error,
  counter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  help?: string;
  error?: string;
  counter?: Counter;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {counter ? <CharCounter counter={counter} /> : null}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={`rounded-md border bg-card px-3 py-2 text-sm ${
          error ? "border-destructive" : "border-border"
        }`}
      />
      {error ? (
        <span className="text-[11px] text-destructive">{error}</span>
      ) : help ? (
        <span className="text-[11px] text-muted-foreground">{help}</span>
      ) : null}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  help,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  help?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="rounded-md border border-border bg-card px-3 py-2 text-sm"
      />
      {help ? (
        <span className="text-[11px] text-muted-foreground">{help}</span>
      ) : null}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 border border-border bg-card rounded-md px-3 py-2 text-sm ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/30"
      }`}
    >
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
