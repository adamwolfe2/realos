import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// /preview/content/[id] — public read-only preview of a ContentDraft.
//
// Norman feedback (May 22): "It would be awesome for the user to be able
// to check out the blogs before they're posted and see what it looks like!"
// Linked from the Content tab of every shared report so a client can click
// a "DRAFTING" blog row and read the actual content.
//
// Security model: same as /r/[token] share links — the CUID is unguessable
// (~120 bits of entropy). No auth required, no listing endpoint that would
// let someone enumerate IDs.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "Content preview",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ContentPreviewPage({ params }: Props) {
  const { id } = await params;
  if (!/^[a-z0-9]{20,40}$/i.test(id)) notFound();

  const draft = await prisma.contentDraft
    .findUnique({
      where: { id },
      select: {
        id: true,
        format: true,
        status: true,
        brief: true,
        targetQuery: true,
        htmlBody: true,
        outputMarkdown: true,
        output: true,
        updatedAt: true,
        org: { select: { name: true, logoUrl: true } },
        property: { select: { name: true } },
      },
    })
    .catch(() => null);

  if (!draft) notFound();

  // Resolve a title — output.title (operator-set) wins, falling back to
  // the human-readable format string ("Blog Post", etc).
  const out =
    draft.output && typeof draft.output === "object"
      ? (draft.output as Record<string, unknown>)
      : null;
  const title =
    typeof out?.title === "string" && out.title.length > 0
      ? out.title
      : humanFormat(draft.format);

  // Body resolution: htmlBody (TipTap-rendered) wins, then markdown
  // converted to HTML (a tiny converter for headings + paragraphs +
  // lists — enough for blog content; we don't ship a full md lib for
  // a preview route), then output.body, then a clear empty-state.
  const htmlBody = draft.htmlBody?.trim();
  const markdown = draft.outputMarkdown?.trim();
  const outBody =
    typeof out?.body === "string" && out.body.length > 0 ? out.body : null;
  const renderedHtml = htmlBody
    ? htmlBody
    : markdown
      ? markdownToHtml(markdown)
      : outBody
        ? markdownToHtml(outBody)
        : null;

  return (
    <div className="min-h-screen bg-[var(--parchment,#FAF8F2)] py-4 sm:py-8 px-3 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Preview chrome — explicit banner so the reader knows this is
            a draft, not the live published page. */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-baseline gap-2 flex-wrap min-w-0">
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground">
                Preview · {draft.status.toLowerCase().replace(/_/g, " ")}
              </span>
              <span className="text-[12px] text-blue-900 font-medium">
                {humanFormat(draft.format)} ·{" "}
                {draft.property?.name ?? draft.org?.name ?? "Draft"}
              </span>
            </div>
            <span className="text-[11px] text-blue-900/70 tabular-nums">
              Updated{" "}
              {new Date(draft.updatedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* The draft */}
        <article className="rounded-2xl border border-border bg-card p-5 sm:p-8 space-y-4">
          <header className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
              {title}
            </h1>
            {draft.targetQuery ? (
              <p className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                Target query · {draft.targetQuery}
              </p>
            ) : null}
            {draft.brief ? (
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {draft.brief}
              </p>
            ) : null}
          </header>

          <div className="border-t border-border" />

          {renderedHtml ? (
            <div
              className="ls-prose"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              This draft hasn&apos;t been written yet. Once the agent
              generates a body, it&apos;ll appear here.
            </p>
          )}
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

        {/* Minimal blog typography — scoped via .ls-prose so we don't
            disturb the rest of the app's typography. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .ls-prose { color: #1F2937; font-size: 15px; line-height: 1.7; }
              .ls-prose h1, .ls-prose h2, .ls-prose h3 { color: #0F172A; font-weight: 700; letter-spacing: -0.01em; margin-top: 1.6em; margin-bottom: 0.5em; line-height: 1.25; }
              .ls-prose h1 { font-size: 1.6em; }
              .ls-prose h2 { font-size: 1.35em; }
              .ls-prose h3 { font-size: 1.15em; }
              .ls-prose p { margin: 0 0 1em; }
              .ls-prose ul, .ls-prose ol { margin: 0 0 1em 1.5em; }
              .ls-prose li { margin-bottom: 0.4em; }
              .ls-prose strong { color: #0F172A; font-weight: 600; }
              .ls-prose a { color: #1D4ED8; text-decoration: underline; text-underline-offset: 2px; }
              .ls-prose blockquote { border-left: 3px solid #2563EB; padding-left: 12px; margin: 1em 0; color: #475569; font-style: italic; }
              .ls-prose code { background: #F1F5F9; padding: 1px 5px; border-radius: 3px; font-size: 0.9em; }
              .ls-prose hr { border: none; border-top: 1px solid #E5E7EB; margin: 2em 0; }
            `,
          }}
        />
      </div>
    </div>
  );
}

// markdownToHtml — minimal Markdown → HTML for headings, paragraphs,
// lists, links, bold/italic, blockquotes, hr. Enough fidelity for an
// SEO blog draft. We intentionally avoid pulling a heavy lib like
// remark for a preview route; this keeps the page server-rendered
// without an extra dependency.
function markdownToHtml(md: string): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    const joined = inlineMd(para.join(" ").trim());
    if (joined.length > 0) out.push(`<p>${joined}</p>`);
    para = [];
  };
  const flushLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };
  const inlineMd = (s: string) =>
    escape(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
      );

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line === "") {
      flushPara();
      flushLists();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      flushLists();
      const lvl = Math.min(heading[1].length, 6);
      out.push(`<h${lvl}>${inlineMd(heading[2])}</h${lvl}>`);
      continue;
    }
    if (/^---+$/.test(line)) {
      flushPara();
      flushLists();
      out.push("<hr />");
      continue;
    }
    const ulItem = /^[-*]\s+(.*)$/.exec(line);
    if (ulItem) {
      flushPara();
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inlineMd(ulItem[1])}</li>`);
      continue;
    }
    const olItem = /^\d+\.\s+(.*)$/.exec(line);
    if (olItem) {
      flushPara();
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${inlineMd(olItem[1])}</li>`);
      continue;
    }
    const quote = /^>\s+(.*)$/.exec(line);
    if (quote) {
      flushPara();
      flushLists();
      out.push(`<blockquote>${inlineMd(quote[1])}</blockquote>`);
      continue;
    }
    para.push(line);
  }
  flushPara();
  flushLists();
  return out.join("\n");
}

function humanFormat(format: string): string {
  return format
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
