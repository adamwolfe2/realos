"use client";

import type { PopupTemplate } from "@/lib/popups/templates";
import { PopupPreview } from "./popup-preview";

// ---------------------------------------------------------------------------
// PopupTemplateThumbnail — tiny scaled-down preview for the template picker.
//
// We reuse PopupPreview directly so the picker can never drift from the
// live preview / embed renderer. The scale wrapper keeps the popup visually
// readable while fitting into the 16:10 picker card.
// ---------------------------------------------------------------------------

export function PopupTemplateThumbnail({ template }: { template: PopupTemplate }) {
  const d = template.defaults;
  return (
    <div className="absolute inset-0 origin-top-left scale-[0.62] w-[161%] h-[161%]">
      <PopupPreview
        contained
        headline={d.headline}
        body={d.body}
        ctaText={d.ctaText}
        ctaUrl={d.ctaUrl}
        offerCode={d.offerCode ?? null}
        secondaryText={d.secondaryText ?? null}
        position={d.position}
        primaryColor={d.primaryColor}
        textColor={d.textColor}
        backgroundColor={d.backgroundColor}
        heroImageUrl={d.heroImageUrl ?? null}
        captureEmail={d.captureEmail}
        capturePhone={d.capturePhone}
        eyebrowText={d.eyebrowText ?? null}
        accentColor={d.accentColor ?? null}
        theme={d.theme}
        featuredLabel={d.featuredLabel ?? null}
        featuredValue={d.featuredValue ?? null}
        featuredUnit={d.featuredUnit ?? null}
        featuredCaption={d.featuredCaption ?? null}
        secondaryCtaText={d.secondaryCtaText ?? null}
        secondaryCtaUrl={d.secondaryCtaUrl ?? null}
        secondaryCtaIcon={d.secondaryCtaIcon ?? null}
        primaryCtaIcon={d.primaryCtaIcon ?? null}
        dismissText={d.dismissText ?? null}
        gradientColors={d.gradientColors ?? null}
      />
    </div>
  );
}
