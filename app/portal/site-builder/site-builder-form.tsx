"use client";

import { useState, useTransition } from "react";
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

export function SiteBuilderForm({
  orgName,
  moduleChatbot,
  modulePixel,
  initial,
}: {
  orgName: string;
  moduleChatbot: boolean;
  modulePixel: boolean;
  initial: Initial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(() => init(initial, orgName));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function toNullIfEmpty<T>(v: T): T | null {
    return typeof v === "string" && v.trim() === "" ? null : v;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
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
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section title="Hero + headline">
        <Field label="Site title" value={state.siteTitle} onChange={(v) => update("siteTitle", v)} />
        <Field label="Tagline" value={state.tagline} onChange={(v) => update("tagline", v)} />
        <Field label="Hero headline" value={state.heroHeadline} onChange={(v) => update("heroHeadline", v)} />
        <Field label="Hero subheadline" value={state.heroSubheadline} onChange={(v) => update("heroSubheadline", v)} />
        <Field label="Hero image URL" value={state.heroImageUrl} onChange={(v) => update("heroImageUrl", v)} type="url" />
        <TextArea label="About copy" value={state.aboutCopy} onChange={(v) => update("aboutCopy", v)} rows={5} />
      </Section>

      <Section title="Primary CTA + contact">
        <Field label="CTA text" value={state.primaryCtaText} onChange={(v) => update("primaryCtaText", v)} />
        <Field label="CTA URL" value={state.primaryCtaUrl} onChange={(v) => update("primaryCtaUrl", v)} type="url" />
        <Field label="Phone" value={state.phoneNumber} onChange={(v) => update("phoneNumber", v)} />
        <Field label="Contact email" value={state.contactEmail} onChange={(v) => update("contactEmail", v)} type="email" />
      </Section>

      <Section title="SEO + social">
        <Field label="Meta title" value={state.metaTitle} onChange={(v) => update("metaTitle", v)} />
        <Field label="Meta description" value={state.metaDescription} onChange={(v) => update("metaDescription", v)} />
        <Field label="OG image URL" value={state.ogImageUrl} onChange={(v) => update("ogImageUrl", v)} type="url" />
      </Section>

      <Section title="Sections visible on the site">
        <Toggle label="Listings" checked={state.showListings} onChange={(v) => update("showListings", v)} />
        <Toggle label="Floor plans" checked={state.showFloorPlans} onChange={(v) => update("showFloorPlans", v)} />
        <Toggle label="Amenities" checked={state.showAmenities} onChange={(v) => update("showAmenities", v)} />
        <Toggle label="Reviews" checked={state.showReviews} onChange={(v) => update("showReviews", v)} />
        <Toggle label="Blog" checked={state.showBlog} onChange={(v) => update("showBlog", v)} />
      </Section>

      <Section title="Chatbot">
        <Toggle
          label={`Enable chatbot${moduleChatbot ? "" : " (module disabled)"}`}
          checked={state.enableChatbot && moduleChatbot}
          onChange={(v) => update("enableChatbot", v)}
          disabled={!moduleChatbot}
        />
        <Field label="Persona name" value={state.chatbotPersonaName} onChange={(v) => update("chatbotPersonaName", v)} />
        <Field label="Avatar URL" value={state.chatbotAvatarUrl} onChange={(v) => update("chatbotAvatarUrl", v)} type="url" />
        <Field label="Greeting" value={state.chatbotGreeting} onChange={(v) => update("chatbotGreeting", v)} />
        <TextArea
          label="Knowledge base (facts, pricing guidance, CTAs)"
          value={state.chatbotKnowledgeBase}
          onChange={(v) => update("chatbotKnowledgeBase", v)}
          rows={10}
        />
        <NumberField
          label="Idle trigger seconds"
          value={state.chatbotIdleTriggerSeconds}
          onChange={(v) => update("chatbotIdleTriggerSeconds", v)}
          min={0}
          max={600}
        />
      </Section>

      <Section title="Exit intent">
        <Toggle
          label="Enable exit-intent popup"
          checked={state.enableExitIntent}
          onChange={(v) => update("enableExitIntent", v)}
        />
        <Field label="Popup headline" value={state.exitIntentHeadline} onChange={(v) => update("exitIntentHeadline", v)} />
        <Field label="Popup body" value={state.exitIntentBody} onChange={(v) => update("exitIntentBody", v)} />
        <Field label="CTA text" value={state.exitIntentCtaText} onChange={(v) => update("exitIntentCtaText", v)} />
        <Field label="Offer code" value={state.exitIntentOfferCode} onChange={(v) => update("exitIntentOfferCode", v)} />
      </Section>

      <Section title="Pixel">
        <Toggle
          label={`Enable pixel${modulePixel ? "" : " (module disabled)"}`}
          checked={state.enablePixel && modulePixel}
          onChange={(v) => update("enablePixel", v)}
          disabled={!modulePixel}
        />
      </Section>

      <div className="flex items-center gap-3 sticky bottom-0 bg-background py-3 border-t">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-4 py-2 text-xs font-semibold rounded disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save + publish"}
        </button>
        {saved ? (
          <span className="text-xs text-emerald-700">Saved</span>
        ) : null}
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : null}
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border rounded-md p-5">
      <h2 className="text-sm font-semibold mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs tracking-widest uppercase opacity-70">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded px-3 py-2 text-sm bg-background"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs tracking-widest uppercase opacity-70">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="border rounded px-3 py-2 text-sm bg-background"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm max-w-[12rem]">
      <span className="text-xs tracking-widest uppercase opacity-70">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="border rounded px-3 py-2 text-sm bg-background"
      />
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
      className={`flex items-center justify-between gap-3 border rounded-md px-3 py-2 text-sm ${
        disabled ? "opacity-50" : ""
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
