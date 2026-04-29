import { SplitHero } from "@/components/platform/split-hero";
import { ConfigTabs } from "@/components/platform/artifacts/config-tabs";
import { RotatingWord } from "@/components/platform/rotating-word";

export function Hero() {
  return (
    <SplitHero
      eyebrow="For real estate operators and brokers"
      headline={
        <span style={{ display: "block" }}>
          <span style={{ display: "block" }}>
            The <span style={{ color: "#2563EB" }}>#1</span> Real Estate
          </span>
          <span style={{ display: "block" }}>
            Ecosystem for{" "}
            <RotatingWord
              words={["Marketing", "Leasing", "Leads", "Conversion", "Ads", "Growth", "Discovery", "Occupancy"]}
            />
          </span>
        </span>
      }
      subhead={
        <>
          LeaseStack syncs your site, ads, chatbot, online presence, and buyer & seller audience data on one platform, built for real estate operators and brokers who love AI.
        </>
      }
      ctas={[
        { label: "Book a demo", href: "/onboarding" },
        { label: "See it live", href: "/demo", variant: "secondary" },
      ]}
      trust={[
        { value: "14 days", label: "Call to live" },
        { value: "One",     label: "One login" },
        { value: "Zero",    label: "No contracts" },
      ]}
      artifact={<ConfigTabs />}
    />
  );
}
