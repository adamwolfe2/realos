import { ConfigTabs } from "@/components/platform/artifacts/config-tabs";
import { SoftFramedArtifact } from "@/components/platform/soft-framed-artifact";

// PlatformWalkthrough — standalone section that hosts the ConfigTabs
// live demo. Extracted from the hero per Norman brief (2026-05-28) so
// the demo gets its own title and breathing room instead of competing
// with the hero copy.

export function PlatformWalkthrough() {
  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="max-w-3xl mb-8 md:mb-12">
          <p className="eyebrow mb-3">Platform walkthrough</p>
          <h2
            className="heading-section"
            style={{
              color: "#1E2A3A",
              fontSize: "clamp(28px, 3.6vw, 42px)",
              fontWeight: 700,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
            }}
          >
            Configure your dashboard in minutes.
          </h2>
          <p
            className="mt-4 max-w-2xl"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              lineHeight: 1.6,
            }}
          >
            Tabs flip through the surfaces that ship day one. Connect your stack, name your properties, and the dashboard lights up with live insights.
          </p>
        </div>

        <SoftFramedArtifact
          tone="lavender"
          padding="md"
          pillLabel="PLATFORM WALKTHROUGH"
          bare
        >
          <ConfigTabs />
        </SoftFramedArtifact>
      </div>
    </section>
  );
}
