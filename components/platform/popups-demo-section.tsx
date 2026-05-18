"use client";

import { useState } from "react";
import { PopupPreview } from "@/components/portal/popups/popup-preview";

// ---------------------------------------------------------------------------
// PopupsDemoSection — the interactive showcase at /features/popups.
//
// Visitors can change every field of the popup design and see it update
// live. No login, no signup. Used as the centerpiece "try it yourself"
// moment on the marketing page so prospects feel the editor before
// they're on a sales call.
//
// Lives entirely in client state — no DB writes. Mirrors the portal
// editor's field set so what a prospect plays with here is exactly
// what they'd get in /portal/popups.
// ---------------------------------------------------------------------------

const PRESETS = [
  {
    key: "promo",
    label: "Lease-up promo",
    headline: "First month free if you tour this week.",
    body: "Three units left in our most-requested floor plan. Book a 15-minute tour before Friday and we'll waive your first month's rent.",
    ctaText: "Book a tour",
    offerCode: "TOUR1FREE",
    primaryColor: "#2563EB",
    position: "CENTER" as const,
    captureEmail: true,
    heroImageUrl: null,
  },
  {
    key: "referral",
    label: "Resident referral",
    headline: "Refer a roommate. Get $300 off your next month.",
    body: "Send them this link. When they sign, the discount lands on your next statement. Simple as that.",
    ctaText: "Get my referral link",
    offerCode: "REFER300",
    primaryColor: "#16A34A",
    position: "BOTTOM_RIGHT" as const,
    captureEmail: false,
    heroImageUrl: null,
  },
  {
    key: "exitsave",
    label: "Exit-intent save",
    headline: "Before you go — see one floor plan we hold back.",
    body: "Our last 2-bed corner unit didn't make the public listing. Want it sent to your inbox?",
    ctaText: "Send me the floor plan",
    offerCode: null as string | null,
    primaryColor: "#0F172A",
    position: "CENTER" as const,
    captureEmail: true,
    heroImageUrl: null,
  },
  {
    key: "banner",
    label: "Move-in deadline banner",
    headline: "Fall applications close September 1.",
    body: "",
    ctaText: "Apply now",
    offerCode: null as string | null,
    primaryColor: "#DC2626",
    position: "TOP_BANNER" as const,
    captureEmail: false,
    heroImageUrl: null,
  },
];

export function PopupsDemoSection() {
  const [active, setActive] = useState<typeof PRESETS[number]>(PRESETS[0]);
  const [headline, setHeadline] = useState(active.headline);
  const [body, setBody] = useState(active.body);
  const [ctaText, setCtaText] = useState(active.ctaText);
  const [offerCode, setOfferCode] = useState<string | null>(active.offerCode);
  const [primaryColor, setPrimaryColor] = useState(active.primaryColor);
  const [position, setPosition] = useState<typeof active.position>(active.position);
  const [captureEmail, setCaptureEmail] = useState(active.captureEmail);
  const [showPopup, setShowPopup] = useState(true);

  function applyPreset(p: typeof PRESETS[number]) {
    setActive(p);
    setHeadline(p.headline);
    setBody(p.body);
    setCtaText(p.ctaText);
    setOfferCode(p.offerCode);
    setPrimaryColor(p.primaryColor);
    setPosition(p.position);
    setCaptureEmail(p.captureEmail);
    setShowPopup(true);
  }

  return (
    <section className="max-w-6xl mx-auto px-6 pb-12 md:pb-20">
      {/* Preset chips */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mr-2">
          Try a preset:
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p)}
            className={[
              "inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors",
              active.key === p.key
                ? "bg-primary text-primary-foreground"
                : "bg-white text-foreground border border-border hover:bg-muted/60",
            ].join(" ")}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-5">
        {/* LEFT — editor */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-white p-5 space-y-4">
            <Field label="Headline">
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={120}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Body">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={400}
                rows={3}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm resize-none"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CTA text">
                <input
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  maxLength={40}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Offer code">
                <input
                  value={offerCode ?? ""}
                  onChange={(e) => setOfferCode(e.target.value || null)}
                  maxLength={40}
                  placeholder="(none)"
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm font-mono"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Position">
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as typeof position)}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                >
                  <option value="CENTER">Center modal</option>
                  <option value="BOTTOM_RIGHT">Bottom right</option>
                  <option value="BOTTOM_LEFT">Bottom left</option>
                  <option value="TOP_BANNER">Top banner</option>
                </select>
              </Field>
              <Field label="Accent color">
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-10 rounded-md border border-border cursor-pointer"
                  />
                  <input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 min-w-0 rounded-md border border-border bg-white px-2 py-1.5 text-xs font-mono"
                  />
                </span>
              </Field>
            </div>
            <label className="flex items-start gap-2.5 rounded-md border border-border bg-white p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={captureEmail}
                onChange={(e) => setCaptureEmail(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-primary"
              />
              <span className="text-xs text-foreground">
                <span className="block font-medium">Capture email</span>
                <span className="block text-muted-foreground mt-0.5">
                  Shows an email field that posts to your lead pipeline.
                </span>
              </span>
            </label>
            <button
              type="button"
              onClick={() => setShowPopup(true)}
              className="w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              {showPopup ? "Popup is showing →" : "Show popup"}
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
            This editor lives entirely in your browser. Nothing's saved. In the
            actual {`{`}portal{`}`}, every change is one click away from being
            live on any site you've embedded the script tag on.
          </p>
        </div>

        {/* RIGHT — preview */}
        <div className="relative h-[600px] rounded-2xl border border-dashed border-border bg-gradient-to-br from-[#F9FAFB] to-[#EFF6FF] overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-9 bg-white/70 border-b border-border flex items-center gap-1.5 px-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]/70" />
            <span className="ml-3 text-[10px] font-mono text-muted-foreground truncate">
              your-property.com
            </span>
          </div>
          <div className="absolute inset-0 pt-9">
            {/* Faux page content so the popup has something to render over */}
            <div className="p-8 space-y-4 opacity-30">
              <div className="h-6 w-2/3 bg-foreground/20 rounded" />
              <div className="h-3 w-full bg-foreground/15 rounded" />
              <div className="h-3 w-5/6 bg-foreground/15 rounded" />
              <div className="h-3 w-4/6 bg-foreground/15 rounded" />
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="aspect-video bg-foreground/15 rounded-lg" />
                <div className="aspect-video bg-foreground/15 rounded-lg" />
              </div>
            </div>
            {showPopup ? (
              <PopupPreview
                contained
                headline={headline}
                body={body}
                ctaText={ctaText}
                offerCode={offerCode}
                secondaryText={null}
                position={position}
                primaryColor={primaryColor}
                textColor="#0F172A"
                backgroundColor="#FFFFFF"
                heroImageUrl={null}
                captureEmail={captureEmail}
                capturePhone={false}
                onDismiss={() => setShowPopup(false)}
                onCtaClick={() => setShowPopup(false)}
                onSubmit={() => setShowPopup(false)}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
