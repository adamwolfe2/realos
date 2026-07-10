import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { ContentFormat } from "@prisma/client";

export const metadata: Metadata = { title: "New draft" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/content/new — short scaffold form. Pre-fills `format` from the
// query string so the "New Draft" dropdown can route here with a chosen
// format. On submit we POST to /api/portal/content which creates the
// ContentDraft, fires the initial Claude pass, and redirects to the
// editor.
//
// This page itself is a server component — the form posts to a server
// action so we can run the auth + creation flow without shipping any
// client JS.
// ---------------------------------------------------------------------------

const FORMAT_OPTIONS: Array<{ value: ContentFormat; label: string }> = [
  { value: "BLOG_POST", label: "Blog Post" },
  { value: "NEIGHBORHOOD_PAGE", label: "Neighborhood Page" },
  { value: "PROPERTY_DESCRIPTION", label: "Property Description" },
  { value: "META_REWRITE", label: "Meta Rewrite" },
  { value: "FAQ_BLOCK", label: "FAQ Block" },
  { value: "AD_COPY", label: "Ad Copy" },
];

const DEFAULT_WORD_COUNT: Record<ContentFormat, number> = {
  BLOG_POST: 1500,
  NEIGHBORHOOD_PAGE: 1200,
  PROPERTY_DESCRIPTION: 220,
  META_REWRITE: 0,
  FAQ_BLOCK: 600,
  AD_COPY: 0,
};

type SearchParams = { format?: string };

export default async function NewContentDraftPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await requireScope();
  const { format: rawFormat } = await props.searchParams;

  const selected: ContentFormat =
    rawFormat && FORMAT_OPTIONS.some((o) => o.value === rawFormat)
      ? (rawFormat as ContentFormat)
      : "BLOG_POST";

  // Pull properties the operator is allowed to anchor a draft to. Optional —
  // some formats (BLOG_POST, FAQ_BLOCK) don't strictly need a property.
  const propertyWhere: Record<string, unknown> = { ...tenantWhere(scope) };
  if (scope.allowedPropertyIds) {
    propertyWhere.id = { in: scope.allowedPropertyIds };
  }
  const properties = await prisma.property.findMany({
    where: propertyWhere as never,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
    take: 200,
  });

  async function createDraftAction(formData: FormData) {
    "use server";
    const { headers } = await import("next/headers");
    const h = await headers();
    const host = h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? "https";
    const cookie = h.get("cookie") ?? "";

    const payload = {
      format: formData.get("format") as string,
      title: (formData.get("title") as string) ?? "",
      brief: (formData.get("brief") as string) ?? "",
      targetQuery: (formData.get("targetQuery") as string) ?? "",
      targetWordCount: Number(formData.get("targetWordCount") ?? 0),
      propertyId: (formData.get("propertyId") as string) || null,
    };

    const res = await fetch(`${proto}://${host}/api/portal/content`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Draft creation failed: ${res.status} ${text}`);
    }
    const json = (await res.json()) as { id: string };
    redirect(`/portal/content/${json.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 ls-page-fade">
      <div>
        <Link
          href="/portal/content"
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          &larr; Content
        </Link>
      </div>

      <header>
        <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
          New draft
        </p>
        <h1 className="text-2xl font-semibold text-foreground mt-1">
          Scaffold a new piece
        </h1>
        <p className="text-[12px] text-muted-foreground mt-1">
          Tell the AI what you want. The assistant will draft the first
          pass, then you can refine it inline.
        </p>
      </header>

      <form
        action={createDraftAction}
        className="space-y-5 rounded-2xl border border-border bg-card p-6"
      >
        <div className="space-y-2">
          <label className="text-[11px] font-mono font-semibold uppercase tracking-wide text-muted-foreground">
            Format
          </label>
          <select
            name="format"
            defaultValue={selected}
            className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-mono font-semibold uppercase tracking-wide text-muted-foreground">
            Title / topic
          </label>
          <input
            name="title"
            required
            maxLength={140}
            placeholder="e.g. 9 questions to ask on your first apartment tour"
            className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-mono font-semibold uppercase tracking-wide text-muted-foreground">
            Brief
          </label>
          <textarea
            name="brief"
            required
            minLength={8}
            maxLength={2000}
            rows={5}
            placeholder="What should this piece accomplish? Who is the audience? Anything the AI MUST or MUST NOT say."
            className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[11px] font-mono font-semibold uppercase tracking-wide text-muted-foreground">
              Target keyword
            </label>
            <input
              name="targetQuery"
              maxLength={200}
              placeholder="apartments in midtown"
              className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-mono font-semibold uppercase tracking-wide text-muted-foreground">
              Target word count
            </label>
            <input
              name="targetWordCount"
              type="number"
              min={0}
              max={5000}
              defaultValue={DEFAULT_WORD_COUNT[selected]}
              className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {properties.length > 0 ? (
          <div className="space-y-2">
            <label className="text-[11px] font-mono font-semibold uppercase tracking-wide text-muted-foreground">
              Anchor property (optional)
            </label>
            <select
              name="propertyId"
              defaultValue=""
              className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— none —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Link
            href="/portal/content"
            className="rounded-lg border border-border bg-background px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            Generate draft
          </button>
        </div>
      </form>
    </div>
  );
}
