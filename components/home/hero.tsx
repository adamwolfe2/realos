import { SplitHero } from "@/components/platform/split-hero";
import { ConfigTabs } from "@/components/platform/artifacts/config-tabs";
import { MARKETING } from "@/lib/copy/marketing";

export function Hero() {
  const { hero } = MARKETING.home;

  return (
    <SplitHero
      eyebrow={hero.eyebrow}
      headline={
        <span style={{ display: "block" }}>
          <span style={{ display: "block" }}>Your leasing data.</span>
          <span style={{ display: "block", color: "#2563EB" }}>
            Finally working for you.
          </span>
        </span>
      }
      subhead={<>{hero.subhead}</>}
      ctas={[
        { label: hero.primaryCta, href: hero.primaryHref },
        { label: hero.secondaryCta, href: hero.secondaryHref, variant: "secondary" },
      ]}
      trust={[
        { value: "100%", label: "Spend tracked to lease" },
        { value: "4-8 wk", label: "Pacing alert lead time" },
        { value: "$0",    label: "Pilot. No commitment." },
      ]}
      artifact={<ConfigTabs />}
    />
  );
}
