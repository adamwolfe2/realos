import type { TenantWithSite } from "@/lib/tenancy/tenant-context";
import { TrackedLink } from "./tracked-link";

export function ApplyCta({ tenant }: { tenant: TenantWithSite }) {
  const config = tenant.tenantSiteConfig;
  const applyHref = config?.primaryCtaUrl ?? "/apply";
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 py-20">
      <div
        className="rounded-2xl p-10 md:p-16 text-white flex flex-col md:flex-row gap-6 md:items-center md:justify-between"
        style={{
          background:
            "linear-gradient(135deg, var(--tenant-primary), var(--tenant-secondary))",
        }}
      >
        <div>
          <h2 className="font-serif text-3xl md:text-4xl font-bold">
            Ready to move in?
          </h2>
          <p className="opacity-90 mt-2 max-w-xl">
            Applications take five minutes. We get back to every applicant
            within one business day.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <TrackedLink
            href={applyHref}
            event="apply_clicked"
            params={{ source: "apply_cta", tenantId: tenant.id }}
            className="inline-block px-6 py-3 text-sm font-semibold rounded bg-white text-slate-900"
          >
            {config?.primaryCtaText ?? "Apply Now"}
          </TrackedLink>
          <TrackedLink
            href="/schedule"
            event="tour_scheduled"
            params={{ source: "apply_cta", tenantId: tenant.id }}
            className="inline-block px-6 py-3 text-sm font-semibold rounded border border-white/30"
          >
            Schedule a tour
          </TrackedLink>
        </div>
      </div>
    </section>
  );
}
