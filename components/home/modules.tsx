import { MARKETING } from "@/lib/copy/marketing";

export function Modules() {
  return (
    <section style={{ backgroundColor: "#F1F5F9", borderTop: "1px solid #E2E8F0" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="max-w-3xl mb-14">
          <p className="eyebrow mb-4">Inside the platform</p>
          <h2 className="heading-section" style={{ color: "#1E2A3A" }}>
            Every module the operator stack needs, in one login.
          </h2>
          <p
            className="mt-4"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            Nothing to wire up. Nothing to learn. We run it. You review the
            weekly report.
          </p>
        </div>

        {/* Mobile: horizontal snap carousel. Desktop: grid */}
        <div
          className="md:grid md:grid-cols-2 lg:grid-cols-3 gap-3 flex overflow-x-auto md:overflow-visible pb-3 md:pb-0"
          style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
        >
          {MARKETING.home.modules.map((m) => (
            <div
              key={m.title}
              className="flex-shrink-0 md:flex-shrink p-6"
              style={{
                scrollSnapAlign: "start",
                width: "82vw",
                maxWidth: "320px",
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                boxShadow: "0 0 0 1px #E2E8F0",
              }}
            >
              <h3 className="heading-card" style={{ color: "#1E2A3A" }}>
                {m.title}
              </h3>
              <p
                className="mt-3"
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  lineHeight: 1.6,
                }}
              >
                {m.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
