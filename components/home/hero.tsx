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
        // spec `soft-blur-in.json`. Apple keynote signature, exact values
        // (900ms, 25ms stagger, blur 12→0, y 16→0, ease 0.22,1,0.36,1).
        <SoftBlurIn
          segments={[
            { text: "Your leasing data." },
            { text: "Working for you.", color: "#2563EB" },
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
        { value: "100%", label: "Spend tracked to lease" },
        { value: "4-8 wk", label: "Pacing alert lead time" },
        { value: "$0",    label: "Pilot. No commitment." },
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
