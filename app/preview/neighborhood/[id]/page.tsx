import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// /preview/neighborhood/[id] — public read-only preview of a
// NeighborhoodPage row, including DRAFT pages that haven't been
// published yet. Linked from the Content tab of the shared report.
// Same security model as /preview/content/[id] — unguessable CUIDs.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Neighborhood page preview",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Section = { heading?: string; body?: string };
type Faq = { question?: string; answer?: string };

type Props = { params: Promise<{ id: string }> };

export default async function NeighborhoodPreviewPage({ params }: Props) {
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/i.test(id)) notFound();

  const page = await prisma.neighborhoodPage
    .findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        metaDescription: true,
        city: true,
        neighborhood: true,
        intro: true,
        sections: true,
        faqs: true,
        status: true,
        updatedAt: true,
        org: { select: { name: true } },
        property: { select: { name: true } },
      },
    })
    .catch(() => null);

  if (!page) notFound();

  // Sections + FAQs land in the DB as JSON. We tolerate either the
  // shape produced by the generator or operator-edited variations.
  const sections: Section[] = Array.isArray(page.sections)
    ? (page.sections as Section[])
    : [];
  const faqs: Faq[] = Array.isArray(page.faqs) ? (page.faqs as Faq[]) : [];

  return (
    <div className="min-h-screen bg-[var(--parchment,#FAF8F2)] py-4 sm:py-8 px-3 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-2 flex-wrap min-w-0">
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground">
                Preview · {page.status.toLowerCase()}
              </span>
              <span className="text-[12px] text-blue-900 font-medium">
                Neighborhood page ·{" "}
                {page.property?.name ?? page.org?.name ?? "Draft"}
              </span>
            </div>
            <span className="text-[11px] text-blue-900/70 tabular-nums">
              Updated{" "}
              {new Date(page.updatedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <article className="rounded-2xl border border-border bg-card p-5 sm:p-8 space-y-5">
          <header className="space-y-2">
            <p className="text-[11px] uppercase tracking-widest font-semibold text-primary">
              {page.neighborhood} · {page.city}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
              {page.title}
            </h1>
            {page.metaDescription ? (
              <p className="text-[12px] text-muted-foreground leading-relaxed italic">
                {page.metaDescription}
              </p>
            ) : null}
          </header>

          <div className="border-t border-border" />

          {page.intro ? (
            <p className="text-[15px] leading-relaxed text-foreground">
              {page.intro}
            </p>
          ) : null}

          {sections.length > 0 ? (
            <div className="space-y-5">
              {sections.map((s, i) => (
                <section key={i} className="space-y-2">
                  {s.heading ? (
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                      {s.heading}
                    </h2>
                  ) : null}
                  {s.body ? (
                    <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
                      {s.body}
                    </p>
                  ) : null}
                </section>
              ))}
            </div>
          ) : null}

          {faqs.length > 0 ? (
            <div className="space-y-3 pt-2 border-t border-border">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Frequently asked questions
              </h2>
              <div className="space-y-2.5">
                {faqs.map((f, i) => (
                  <details
                    key={i}
                    className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                  >
                    <summary className="cursor-pointer font-semibold text-[14px] text-foreground">
                      {f.question ?? `Question ${i + 1}`}
                    </summary>
                    {f.answer ? (
                      <p className="mt-2 text-[14px] leading-relaxed text-foreground whitespace-pre-wrap">
                        {f.answer}
                      </p>
                    ) : null}
                  </details>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <footer className="text-center text-[11px] text-muted-foreground space-x-2 pb-4">
          <span>Generated by LeaseStack</span>
          <span aria-hidden="true">·</span>
          <Link
            href="https://www.leasestack.co"
            className="underline underline-offset-2 hover:text-foreground"
          >
            leasestack.co
          </Link>
        </footer>
      </div>
    </div>
  );
}
