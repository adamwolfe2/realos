import { MARKETING } from "@/lib/copy/marketing";
import { BrandIcon, DeliverableIcon, type DeliverableIconKind, type DeliverableBrand } from "./shared-icons";

const WEEKLY_VISUALS: Array<{
  icon: DeliverableIconKind;
  brands: DeliverableBrand[];
}> = [
  { icon: "report", brands: ["resend"] },
  { icon: "cal",    brands: ["cal", "appfolio"] },
  { icon: "ads",    brands: ["meta", "google", "tiktok", "figma"] },
  { icon: "chat",   brands: ["claude"] },
];

export function Weekly() {
  const { weekly } = MARKETING.home;
  return (
    <section
      style={{
        backgroundColor: "#F1F5F9",
        borderTop: "1px solid #E2E8F0",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">{weekly.eyebrow}</p>
          <h2 className="heading-section" style={{ color: "#1E2A3A" }}>
            {weekly.headline}
          </h2>
          <p
            className="mt-4 max-w-2xl"
            style={{
              color: "#64748B",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            {weekly.body}
          </p>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {weekly.items.map((item, i) => {
            const v = WEEKLY_VISUALS[i] ?? WEEKLY_VISUALS[0];
            return (
              <li
                key={item.title}
                className="p-6 md:p-7 flex flex-col gap-3"
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  boxShadow: "0 0 0 1px #E2E8F0",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center flex-shrink-0"
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(37,99,235,0.12)",
                      color: "#2563EB",
                    }}
                  >
                    <DeliverableIcon kind={v.icon} />
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1">
                    {v.brands.map((b, idx) => (
                      <BrandIcon key={`${item.title}-${b}-${idx}`} brand={b} />
                    ))}
                  </span>
                </div>
                <p
                  className="flex items-center justify-between gap-2"
                  style={{
                    color: "#94A3B8",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                  }}
                >
                  <span style={{ color: "#1E2A3A" }}>{item.day}</span>
                  <span>{item.time}</span>
                </p>
                <h3
                  style={{
                    color: "#1E2A3A",
                    fontFamily: "var(--font-display)",
                    fontSize: "19px",
                    fontWeight: 600,
                    lineHeight: 1.3,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    color: "#64748B",
                    fontFamily: "var(--font-sans)",
                    fontSize: "14.5px",
                    lineHeight: 1.6,
                  }}
                >
                  {item.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
