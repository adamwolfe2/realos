import { Building2 } from "lucide-react";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// ---------------------------------------------------------------------------
// EnterpriseBand — single-row banner for the 20+ property / multi-brand
// case. Deliberately NOT a card grid: the builder above is the centerpiece,
// this is a quiet exit ramp for the operators it doesn't fit.
// ---------------------------------------------------------------------------

export function EnterpriseBand() {
  return (
    <section
      style={{
        backgroundColor: "#FFFFFF",
        borderTop: "1px solid var(--hair)",
      }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-10 md:py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-[2px] p-6 md:p-8" style={{ border: "1px solid var(--hair)" }}>
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className="shrink-0 inline-flex items-center justify-center rounded-[2px]"
              style={{
                width: 40,
                height: 40,
                backgroundColor: "var(--color-surface, #f4f4f4)",
                color: "var(--color-primary)",
              }}
            >
              <Building2 size={18} strokeWidth={2} />
            </span>
            <div>
              <h2
                style={{
                  color: "#1E2A3A",
                  fontFamily: "var(--font-sans)",
                  fontSize: "18px",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                }}
              >
                Running 20 or more properties?
              </h2>
              <p
                className="mt-1"
                style={{
                  color: "#64748B",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  lineHeight: 1.55,
                  maxWidth: "60ch",
                }}
              >
                Volume pricing, custom PMS integrations, white-label
                workspaces, and a dedicated operator success contact for
                multi-brand owners.
              </p>
            </div>
          </div>
          <BookDemoLink
            className="inline-flex items-center justify-center h-11 px-6 rounded-md text-sm font-semibold shrink-0 transition-colors active:scale-[0.98]"
            style={{
              border: "1px solid var(--hair-strong)",
              color: "#1E2A3A",
              backgroundColor: "#FFFFFF",
            }}
          >
            Book a demo
          </BookDemoLink>
        </div>
      </div>
    </section>
  );
}
