import type { Metadata } from "next";
import Link from "next/link";
import { requireModule } from "@/lib/portal/module-gate";
import { PageHeader } from "@/components/admin/page-header";
import { POPUP_TEMPLATES } from "@/lib/popups/templates";
import { createPopupFromForm } from "@/lib/actions/popup-actions";
import { PopupTemplateThumbnail } from "@/components/portal/popups/popup-template-thumbnail";

export const metadata: Metadata = { title: "New popup" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/popups/new
//
// 4-card template picker. Each card is its own <form> that posts to the
// existing createPopupFromForm server action with the chosen templateId.
// The action seeds the new PopupCampaign with the template's defaults
// and redirects into the editor.
//
// "Start from scratch" at the bottom is a plain form with no templateId —
// produces the exact same blank row v1 did, so we don't regress that path.
// ---------------------------------------------------------------------------

export default async function NewPopupPage() {
  const gate = await requireModule("modulePopups");
  if (gate) return gate;

  return (
    <div className="space-y-4 ls-page-fade">
      <PageHeader
        eyebrow={
          <Link
            href="/portal/popups"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <span aria-hidden="true">←</span> All popups
          </Link>
        }
        title="Pick a template"
        description="Templates are starting points — every field is editable in the next step. Pick the one that's closest to the popup you want and we'll seed the design, copy, and trigger for you."
      />

      <section
        aria-label="Popup templates"
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        {POPUP_TEMPLATES.map((t) => (
          <form key={t.id} action={createPopupFromForm} className="contents">
            <input type="hidden" name="templateId" value={t.id} />
            <input type="hidden" name="name" value={t.defaults.name} />
            <button
              type="submit"
              className="group text-left rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)] transition-all focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <div className="aspect-[16/10] bg-gradient-to-br from-[#F8FAFC] to-[#EFF6FF] border-b border-border relative overflow-hidden">
                <PopupTemplateThumbnail template={t} />
              </div>
              <div className="p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
                    {t.label}
                  </h3>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
                    {t.badge}
                  </span>
                </div>
                <p className="text-[12px] text-muted-foreground leading-snug">
                  {t.description}
                </p>
              </div>
            </button>
          </form>
        ))}
      </section>

      <div className="pt-2 text-center">
        <form action={createPopupFromForm} className="inline-block">
          <button
            type="submit"
            className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Or start from scratch with a blank popup →
          </button>
        </form>
      </div>
    </div>
  );
}
