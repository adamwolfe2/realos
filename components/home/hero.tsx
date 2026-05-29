import { SplitHero } from "@/components/platform/split-hero";
import { ConfigTabs } from "@/components/platform/artifacts/config-tabs";
import { SoftBlurIn } from "@/components/ui/animate-text";
import { SoftFramedArtifact } from "@/components/platform/soft-framed-artifact";
import { MARKETING } from "@/lib/copy/marketing";

export function Hero() {
  const { hero } = MARKETING.home;

  return (
    <SplitHero
      eyebrow={hero.eyebrow}
      headline={
        // Per-character "Soft Blur In" reveal — pixel-point/animate-text
        // spec `soft-blur-in.json`. 2026-05-28 copy audit: changed from
        // "Your leasing data. Working for you." (poetic but vague) to a
        // specific value-prop split: what we do + what you get.
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
        { value: "14 days", label: "Intake to live" },
        { value: "1 portal", label: "Site, ads, chatbot, pixel" },
        { value: "$0",      label: "Pilot. Cancel anytime." },
      ]}
      // Norman feedback (2026-05-21): the raw ConfigTabs artifact read
      // "unprofessional" sitting on the white hero with no frame.
      // Wrapping in SoftFramedArtifact (Cluely-style soft lavender outer
      // card + crisp white inner mockup + floating LIVE pill) gives it
      // the same lifted, premium feel as the SanityCheckSection below.
      artifact={
        // `bare` because ConfigTabs ships its own white card + shadow —
        // the lavender frame just provides the halo of padding around
        // it. Otherwise the surfaces would double-frame.
        <SoftFramedArtifact
          tone="lavender"
          padding="md"
          pillLabel="LIVE DEMO"
          bare
        >
          <ConfigTabs />
        </SoftFramedArtifact>
      }
    />
  );
}
