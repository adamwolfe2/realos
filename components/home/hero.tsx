import { SplitHero } from "@/components/platform/split-hero";
import { ConfigTabs } from "@/components/platform/artifacts/config-tabs";
import { RotatingWord } from "@/components/platform/rotating-word";

export function Hero() {
  return (
    <SplitHero
      eyebrow="For multifamily and student-housing operators"
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
          <strong style={{ color: "#141413", fontWeight: 600 }}>Premium Website</strong>,{" "}
          <strong style={{ color: "#141413", fontWeight: 600 }}>AI Chatbot</strong>,{" "}
          <strong style={{ color: "#141413", fontWeight: 600 }}>Visitor Tracking Pixel</strong>, and{" "}
          <span style={{ color: "#2563EB", fontWeight: 600 }}>#1</span> search visibility. Live in 14 days.
        </>
      }
      ctas={[
        { label: "Book a demo", href: "/onboarding" },
        { label: "See it live", href: "/#live", variant: "secondary" },
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
