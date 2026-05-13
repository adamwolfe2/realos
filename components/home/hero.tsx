import { SplitHero } from "@/components/platform/split-hero";
import { ConfigTabs } from "@/components/platform/artifacts/config-tabs";

export function Hero() {
  return (
    <SplitHero
      eyebrow="For multifamily and student housing operators"
      headline={
        <span style={{ display: "block" }}>
          <span style={{ display: "block" }}>Your entire leasing funnel,</span>
          <span style={{ display: "block" }}>
            <span style={{ color: "#2563EB" }}>managed</span> for you.
          </span>
        </span>
      }
      subhead={
        <>
          Marketing site, chatbot, visitor identification, and Google & Meta ads — one platform on your domain, live in 14 days. You review a weekly report. We do the rest.
        </>
      }
      ctas={[
        { label: "Book a demo", href: "/onboarding" },
        { label: "See it live", href: "/demo", variant: "secondary" },
      ]}
      trust={[
        { value: "14 days", label: "Intake to live" },
        { value: "1 login", label: "Not six vendors" },
        { value: "Month-to-month", label: "No long-term lock" },
      ]}
      artifact={<ConfigTabs />}
    />
  );
}
