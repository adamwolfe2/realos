import { SplitHero } from "@/components/platform/split-hero";
import { SoftBlurIn } from "@/components/ui/animate-text";
import { MARKETING } from "@/lib/copy/marketing";

// Hero — keeps the per-character SoftBlurIn animation, primary CTAs, and
// updated trust strip. The ConfigTabs artifact was extracted into its own
// PlatformWalkthrough section below; the hero now ships with a calm
// brand-pixel artifact slot (PixelSwirl renders behind via SplitHero).

export function Hero() {
  const { hero } = MARKETING.home;

  return (
    <SplitHero
      eyebrow={hero.eyebrow}
      headline={
        <SoftBlurIn
          segments={[
            { text: "Replace your marketing stack." },
            { text: "Live in 14 days.", color: "#2563EB" },
          ]}
        />
      }
      subhead={<>{hero.subhead}</>}
      headlineSelfAnimated
      ctas={[
        { label: hero.primaryCta, href: hero.primaryHref },
        { label: hero.secondaryCta, href: hero.secondaryHref, variant: "secondary" },
      ]}
      trust={[
        { value: "14 days", label: "Live on your domain" },
        { value: "100%",    label: "Ad spend tracked to lease" },
        { value: "$0",      label: "Pilot. No commitment." },
      ]}
      // Artifact slot retained but rendered empty — the platform
      // walkthrough (ConfigTabs) now ships as its own dedicated section
      // immediately below the hero so the live demo gets a full title +
      // pill of its own instead of competing with the hero copy.
      artifact={<HeroVisual />}
    />
  );
}

// HeroVisual — calm decorative panel for the artifact slot. Uses brand
// tokens only; no interactive content here since the live walkthrough
// has its own section.
function HeroVisual() {
  return (
    <div
      aria-hidden
      className="relative w-full"
      style={{
        aspectRatio: "5 / 4",
        borderRadius: 22,
        background:
          "linear-gradient(160deg, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0.02) 55%, #FFFFFF 100%)",
        boxShadow:
          "0 0 0 1px rgba(15,23,42,0.06), 0 24px 60px rgba(37,99,235,0.08)",
        overflow: "hidden",
      }}
    >
      {/* Concentric ring motif — same vocabulary as the brand glyphs */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 70% 60%, rgba(37,99,235,0.18), transparent 55%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(0deg, rgba(37,99,235,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(ellipse 70% 70% at 50% 50%, #000 60%, transparent 100%)",
        }}
      />
    </div>
  );
}
