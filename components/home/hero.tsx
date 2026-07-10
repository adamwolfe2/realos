import { SplitHero } from "@/components/platform/split-hero";
import { ConfigTabs } from "@/components/platform/artifacts/config-tabs";
import { SoftBlurIn } from "@/components/ui/animate-text";
import { SoftFramedArtifact } from "@/components/platform/soft-framed-artifact";
import { MARKETING } from "@/lib/copy/marketing";

// Hero — keeps the per-character SoftBlurIn animation, primary CTAs,
// updated trust strip, AND the interactive ConfigTabs walkthrough as
// the right-column artifact. The standalone PlatformWalkthrough section
// is no longer rendered below — having the same widget twice on one
// page split the viewer's attention without adding meaning.

export function Hero() {
  const { hero } = MARKETING.home;

  return (
    <SplitHero
      eyebrow={hero.eyebrow}
      headline={
        <SoftBlurIn
          segments={[
            { text: "Take control of your" },
            { text: "online leasing.", color: "#0f62fe" },
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
      // Soft lavender frame around the interactive walkthrough. `bare`
      // because ConfigTabs ships its own white card + shadow; the
      // lavender frame just provides the halo of padding.
      artifact={
        <SoftFramedArtifact tone="lavender" padding="md" bare>
          <ConfigTabs />
        </SoftFramedArtifact>
      }
    />
  );
}
