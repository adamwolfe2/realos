import type { Metadata } from "next";
import Link from "next/link";
import { requireAgency } from "@/lib/tenancy/scope";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { createBriefFromForm } from "../actions";

export const metadata: Metadata = { title: "Generate a brief" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /admin/briefs/new — form to kick off a new prospect brief.
//
// Form posts to the createBriefFromForm server action, which runs the
// full data-collection synchronously (~60-120 sec) and redirects to
// the finished brief URL. The composer-style "loading…" UX is intentional
// — we want the operator to see the share URL in the browser the moment
// it's ready so they can paste-and-go.
// ---------------------------------------------------------------------------

export default async function NewBriefPage() {
  await requireAgency();
  return (
    <div className="max-w-2xl mx-auto w-full space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href="/admin/briefs"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <span aria-hidden>←</span> Briefs
          </Link>
        }
        title="Generate a brief"
        description="Paste a prospect's domain. We'll run the AEO scan (4 engines × 5 prompts), DataForSEO Google AI Overview, Firecrawl rendered HTML, and the 8-check AEO Page Health, then drop you on the share URL. Takes about 90 seconds."
      />

      <SectionCard
        label="Brief inputs"
        description="Required: domain. Everything else has a sensible default."
      >
        <form action={createBriefFromForm} className="space-y-4">
          <Field
            label="Domain"
            name="domain"
            required
            placeholder="255-cal.com"
            hint="Just the domain — we'll prepend https://www. The brand name is derived from the domain unless you override it below."
          />
          <Field
            label="Brand override (optional)"
            name="brand"
            placeholder="255 Cal"
            hint="Defaults to a title-cased version of the domain. Override when the brand differs from the URL (e.g. the building is '555 California Street' but the domain is '555california.com')."
          />
          <Field
            label="Vertical (optional)"
            name="vertical"
            placeholder="Class-A office tower · San Francisco FiDi"
            hint="Free-text label shown on the brief's headline strip. Helps the prospect orient quickly."
          />
          <Field
            label="Full address (optional)"
            name="fullAddress"
            placeholder="255 California Street, San Francisco"
            hint="Used inside the AI prompts so engines anchor on the right physical location."
          />
          <TextareaField
            label="Comp set (optional)"
            name="compSet"
            placeholder={"555 California Street\n101 California Street\nSalesforce Tower"}
            hint="One competitor per line. We scan each AI engine's response for these names and surface a 'who got named instead' bar chart. Defaults to the SF Class-A office cohort."
          />
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center h-10 px-6 rounded-md text-[13px] font-semibold text-white"
              style={{ backgroundColor: "#2563EB" }}
            >
              Generate brief
            </button>
            <p className="text-[11.5px] text-muted-foreground">
              You&apos;ll be redirected to the share URL when it&apos;s ready
              (≈90 sec).
            </p>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  required = false,
  hint,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-foreground mb-1.5">
        {label}
        {required ? <span style={{ color: "#DC2626" }}> *</span> : null}
      </span>
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        required={required}
        className="w-full h-10 px-3 rounded-md border border-border bg-background text-[13.5px] focus:outline-none focus:ring-1 focus:ring-foreground/30"
      />
      {hint ? (
        <span className="block mt-1 text-[11.5px] text-muted-foreground leading-snug">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function TextareaField({
  label,
  name,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-foreground mb-1.5">
        {label}
      </span>
      <textarea
        name={name}
        placeholder={placeholder}
        rows={5}
        className="w-full px-3 py-2 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-1 focus:ring-foreground/30 font-mono"
      />
      {hint ? (
        <span className="block mt-1 text-[11.5px] text-muted-foreground leading-snug">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
