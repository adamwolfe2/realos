import { SplitHero } from "@/components/platform/split-hero";
import { ConfigTabs } from "@/components/platform/artifacts/config-tabs";
import { SoftBlurIn } from "@/components/ui/animate-text";
import { SoftFramedArtifact } from "@/components/platform/soft-framed-artifact";
import { MARKETING } from "@/lib/copy/marketing";
import { getBookDemoHref } from "@/lib/marketing/book-demo";

// Hero — keeps the per-character SoftBlurIn animation, primary CTAs, and
// the interactive ConfigTabs walkthrough as the right-column artifact.
// The standalone PlatformWalkthrough section is no longer rendered below
// — having the same widget twice on one page split the viewer's
// attention without adding meaning.
//
// Deslop pass (2026-07-21): hero discipline caps this section at four
// text elements (eyebrow, headline, subhead, CTAs). The trust stat strip
// that used to sit inside the hero column now renders as its own band,
// <TrustStrip />, directly below (see app/(platform)/page.tsx).

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
        { label: "Book a demo", href: getBookDemoHref(), variant: "secondary" },
      ]}
      // Frame around the interactive walkthrough. `bare` because
      // ConfigTabs ships its own white card + shadow; the frame just
      // provides the halo of padding.
      artifact={
        <SoftFramedArtifact tone="lavender" padding="md" bare>
          <ConfigTabs />
        </SoftFramedArtifact>
      }
    />
  );
}
