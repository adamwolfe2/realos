import Link from "next/link";
import { MARKETING } from "@/lib/copy/marketing";
import { BrandIcon, DeliverableIcon, type DeliverableIconKind, type DeliverableBrand } from "./shared-icons";

export function LiveExample() {
  const { liveExample } = MARKETING.home;
  return (
    <section
      id="live"
      style={{
        backgroundColor: "#f5f4ed",
        borderTop: "1px solid #f0eee6",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-20 md:py-24">
        <div className="max-w-3xl mb-12">
          <p className="eyebrow mb-4">{liveExample.eyebrow}</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            {liveExample.headline}
          </h2>
          <p
            className="mt-4 max-w-2xl"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
            }}
          >
            {liveExample.body}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LiveCard
            href={liveExample.siteHref}
            label={liveExample.siteLabel}
            caption={liveExample.siteCaption}
            badge="Live deployment"
            icon="home"
            brands={["vercel", "cal"]}
            external
          />
          <LiveCard
            href={liveExample.portalHref}
            label={liveExample.portalLabel}
            caption={liveExample.portalCaption}
            badge="Operator portal"
            icon="report"
            brands={["slack", "resend", "appfolio"]}
          />
        </div>
      </div>
    </section>
  );
}

function LiveCard({
  href,
  label,
  caption,
  badge,
  icon,
  brands,
  external = false,
}: {
  href: string;
  label: string;
  caption: string;
  badge: string;
  icon: DeliverableIconKind;
  brands: DeliverableBrand[];
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener" : undefined}
      className="group block p-7"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 0 0 1px #f0eee6",
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
      }}
    >
      <div className="flex items-center gap-2 mb-5">
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "10px",
            backgroundColor: "rgba(47,111,229,0.12)",
            color: "#2F6FE5",
          }}
        >
          <DeliverableIcon kind={icon} />
        </span>
        <span className="ml-auto inline-flex items-center gap-1">
          {brands.map((b, idx) => (
            <BrandIcon key={`${label}-${b}-${idx}`} brand={b} />
          ))}
        </span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className="mb-2 inline-flex items-center gap-2"
            style={{
              color: "#87867f",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#3a7d44",
              }}
            />
            {badge}
          </p>
          <h3 className="heading-sub" style={{ color: "#141413" }}>
            {label}
          </h3>
          <p
            className="mt-3 max-w-md"
            style={{
              color: "#5e5d59",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              lineHeight: 1.6,
            }}
          >
            {caption}
          </p>
        </div>
        <span
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            color: "#5e5d59",
            boxShadow: "0 0 0 1px #e8e6dc",
          }}
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d={
                external
                  ? "M5 9L9 5M9 5H5.5M9 5V8.5"
                  : "M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
              }
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}
