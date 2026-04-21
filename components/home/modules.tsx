import { MARKETING } from "@/lib/copy/marketing";

export function Modules() {
  return (
    <section style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-24 md:py-32">
        <div className="max-w-3xl mb-14">
          <p className="eyebrow mb-4">Inside the platform</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            Every module the operator stack needs, in one login.
          </h2>
          <p
            className="mt-4"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            Nothing to wire up. Nothing to learn. We run it. You review the
            weekly report.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {MARKETING.home.modules.map((m) => (
            <div
              key={m.title}
              className="p-6"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                boxShadow: "0 0 0 1px #f0eee6",
              }}
            >
              <h3 className="heading-card" style={{ color: "#141413" }}>
                {m.title}
              </h3>
              <p
                className="mt-3"
                style={{
                  color: "#5e5d59",
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
