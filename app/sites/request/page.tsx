import type { Metadata } from "next";
import { IntakeForm } from "@/components/site-engine/intake-form";
import { BRAND_NAME } from "@/lib/brand";
import {
  loadDesignLanguageIndex,
  loadPaletteIndex,
  loadPresetIndex,
} from "@/lib/site-engine/visual-direction-catalogs";

export const metadata: Metadata = {
  title: `Request a website build | ${BRAND_NAME}`,
  description:
    "Tell us about your real-estate brand and we'll hand-build a custom marketing site. No templates, no page builders.",
};

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /sites/request — public, shareable intake form. No auth required. The same
// form lives at /portal/sites/request for logged-in customers with org
// pre-fill. Both submit through POST /api/site-requests.
// ---------------------------------------------------------------------------

export default async function PublicSiteRequestPage() {
  const [presetIndex, designLanguageIndex, paletteIndex] = await Promise.all([
    loadPresetIndex(),
    loadDesignLanguageIndex(),
    loadPaletteIndex(),
  ]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-12 md:py-16">
        <header className="space-y-3 mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {BRAND_NAME} · Site Engine
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            Tell us about your brand. We'll hand-build the site.
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl">
            Every site we build is custom — no templates, no page builders. This
            intake captures everything we need to start the build. Takes 5–15
            minutes; auto-saves as you go.
          </p>
        </header>

        <IntakeForm
          storageKeySuffix="public"
          visualDirectionCatalogs={{
            presets: presetIndex.presets,
            designLanguages: designLanguageIndex.designLanguages,
            palettes: paletteIndex.palettes,
          }}
        />

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          Already a {BRAND_NAME} customer?{" "}
          <a
            href="/portal/sites/request"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Submit through your portal
          </a>{" "}
          and we'll pre-fill from your account.
        </footer>
      </div>
    </main>
  );
}
