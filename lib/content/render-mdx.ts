// ---------------------------------------------------------------------------
// lib/content/render-mdx.ts
//
// Pure (no I/O) utilities for the admin content-approvals workflow.
//
//   - slugifyTitle(title)              -> URL-safe kebab slug, max 60 chars
//   - htmlToMdx(html)                  -> hand-rolled TipTap-HTML → MDX converter
//   - renderMdxFromDraft(draft)        -> full MDX file (frontmatter + body +
//                                         JSON-LD scripts inline)
//   - renderClaudeCodePromptFromDraft(draft, org) -> paste-ready Claude Code
//                                                    instruction string
//
// No external deps. The converter handles the subset of TipTap output the
// operator-editor produces: h1-h3, p, ul/ol/li, blockquote, strong, em,
// inline code, code blocks, and anchor tags. Anything else falls through as
// plain text so we never break the MDX paste.
// ---------------------------------------------------------------------------

import type { ContentDraft, ContentFormat } from "@prisma/client";
import { serializeJsonLdForTemplateLiteral } from "@/lib/seo/serialize-json-ld";

// ---- Slug --------------------------------------------------------------

/** Kebab-case, alphanumeric + dash, max 60 chars. Falls back to "untitled". */
export function slugifyTitle(title: string): string {
  if (!title) return "untitled";
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/['']/g, "") // collapse apostrophes (don't -> dont)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "untitled";
}

// ---- HTML -> MDX -------------------------------------------------------

/** Decode the small set of HTML entities TipTap emits. */
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/** Strip tags, decode entities, collapse whitespace. */
function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

/**
 * Convert inline HTML (a tree of <strong>, <em>, <code>, <a>, <br>) into
 * the equivalent MDX inline syntax. Recursive on nested tags.
 */
function inlineHtmlToMdx(html: string): string {
  let out = html;

  // <br> -> hard break (two trailing spaces + newline)
  out = out.replace(/<br\s*\/?>/gi, "  \n");

  // <a href="...">text</a>  -> [text](href)
  out = out.replace(
    /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, inner: string) => {
      const text = inlineHtmlToMdx(inner);
      return `[${text}](${href})`;
    },
  );

  // <code>text</code> -> `text`
  out = out.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, inner: string) => {
    return `\`${plainText(inner)}\``;
  });

  // <strong> / <b>
  out = out.replace(
    /<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi,
    (_m, _tag, inner: string) => `**${inlineHtmlToMdx(inner)}**`,
  );

  // <em> / <i>
  out = out.replace(
    /<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi,
    (_m, _tag, inner: string) => `*${inlineHtmlToMdx(inner)}*`,
  );

  // anything else: strip
  out = out.replace(/<[^>]+>/g, "");
  return decodeEntities(out).trim();
}

/**
 * Convert the TipTap HTML body into MDX. Walks block-level tags in source
 * order and emits the matching Markdown construct. Unknown tags fall
 * through as plain text — safer than throwing, since MDX is the user-
 * facing output.
 */
export function htmlToMdx(html: string | null | undefined): string {
  if (!html) return "";
  const blocks: string[] = [];
  // Match block-level elements: h1-h6, p, ul, ol, blockquote, pre, hr.
  const blockRe =
    /<(h[1-6]|p|ul|ol|blockquote|pre|hr)([^>]*)>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;

  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const tag = (m[1] ?? "hr").toLowerCase();
    const inner = m[3] ?? "";

    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      const text = inlineHtmlToMdx(inner);
      blocks.push(`${"#".repeat(level)} ${text}`);
    } else if (tag === "p") {
      const text = inlineHtmlToMdx(inner);
      if (text) blocks.push(text);
    } else if (tag === "ul" || tag === "ol") {
      const items: string[] = [];
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let li: RegExpExecArray | null;
      let i = 1;
      while ((li = liRe.exec(inner)) !== null) {
        const text = inlineHtmlToMdx(li[1] ?? "");
        items.push(tag === "ul" ? `- ${text}` : `${i}. ${text}`);
        i += 1;
      }
      if (items.length) blocks.push(items.join("\n"));
    } else if (tag === "blockquote") {
      const text = inlineHtmlToMdx(inner);
      blocks.push(
        text
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n"),
      );
    } else if (tag === "pre") {
      // <pre><code>...</code></pre>
      const codeMatch = /<code[^>]*>([\s\S]*?)<\/code>/i.exec(inner);
      const code = codeMatch ? decodeEntities(codeMatch[1] ?? "") : plainText(inner);
      blocks.push("```\n" + code.replace(/\n+$/, "") + "\n```");
    } else if (tag === "hr") {
      blocks.push("---");
    }
  }

  return blocks.join("\n\n").trim();
}

// ---- MDX builder -------------------------------------------------------

type DraftLike = Pick<
  ContentDraft,
  | "id"
  | "format"
  | "brief"
  | "targetQuery"
  | "outputMarkdown"
  | "htmlBody"
  | "output"
  | "createdAt"
>;

type OrgLike = {
  id: string;
  name: string;
  domain?: string | null;
};

type StructuredOutput = {
  title?: string;
  description?: string;
  metaDescription?: string;
  excerpt?: string;
  slug?: string;
  ogImage?: string | null;
  ogImageUrl?: string | null;
  heroImage?: string | null;
  faqs?: Array<{ question: string; answer: string }>;
} & Record<string, unknown>;

/** Best-effort title extraction from the structured `output` JSON or the
 * first H1 in the HTML body. Always returns a non-empty string. */
function deriveTitle(draft: DraftLike): string {
  const out = (draft.output ?? {}) as StructuredOutput;
  if (typeof out.title === "string" && out.title.trim()) return out.title.trim();
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(draft.htmlBody ?? "");
  if (h1 && h1[1]) return plainText(h1[1]);
  // Last resort: first line of the markdown / brief
  const md = (draft.outputMarkdown ?? "").trim();
  if (md) return md.split("\n")[0]?.replace(/^#+\s*/, "").trim() || "Untitled";
  return draft.brief.split("\n")[0]?.slice(0, 80) || "Untitled";
}

function deriveDescription(draft: DraftLike, title: string): string {
  const out = (draft.output ?? {}) as StructuredOutput;
  const candidates = [out.description, out.metaDescription, out.excerpt];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  // Fall back to first paragraph from the body.
  const para = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(draft.htmlBody ?? "");
  if (para && para[1]) return plainText(para[1]).slice(0, 160);
  return title;
}

function deriveOgImage(draft: DraftLike): string | null {
  const out = (draft.output ?? {}) as StructuredOutput;
  return (
    (typeof out.ogImage === "string" && out.ogImage) ||
    (typeof out.ogImageUrl === "string" && out.ogImageUrl) ||
    (typeof out.heroImage === "string" && out.heroImage) ||
    null
  );
}

function deriveFaqs(
  draft: DraftLike,
): Array<{ question: string; answer: string }> {
  const out = (draft.output ?? {}) as StructuredOutput;
  if (Array.isArray(out.faqs)) {
    return out.faqs.filter(
      (f): f is { question: string; answer: string } =>
        !!f &&
        typeof f === "object" &&
        typeof (f as { question?: unknown }).question === "string" &&
        typeof (f as { answer?: unknown }).answer === "string",
    );
  }
  return [];
}

/** YAML-safe single-line string. We don't try to handle multi-line — the
 * frontmatter fields we emit are all short. */
function yamlString(s: string): string {
  const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Emit JSON-LD for a content draft. Shape mirrors what the existing
 * tenant-site neighborhood page produces:
 *   - WebPage  (always)
 *   - FAQPage  (BLOG_POST or NEIGHBORHOOD_PAGE, when faqs present)
 *
 * Returned as <script type="application/ld+json"> blocks. The admin pastes
 * these into the MDX body, where MDX parses them as raw JSX.
 */
function renderJsonLdScripts(
  draft: DraftLike,
  org: OrgLike | null,
  title: string,
  description: string,
): string {
  const blocks: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description,
      inLanguage: "en-US",
      ...(org
        ? {
            isPartOf: {
              "@type": "WebSite",
              name: org.name,
              ...(org.domain
                ? { url: `https://${org.domain.replace(/^https?:\/\//, "")}` }
                : {}),
              publisher: { "@type": "Organization", name: org.name },
            },
          }
        : {}),
    },
  ];

  const faqs = deriveFaqs(draft);
  if (
    faqs.length > 0 &&
    (draft.format === "BLOG_POST" || draft.format === "NEIGHBORHOOD_PAGE")
  ) {
    blocks.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }

  // The script block is compiled as JSX by MDX, so its `__html` backtick body
  // is evaluated at render time. serializeJsonLdForTemplateLiteral both
  // HTML-escapes `<`/`>`/`&` (stops </script> breakout — stored XSS) AND
  // escapes the template-literal metachars so the literal evaluates back to
  // exactly the safe JSON. (Also fixes the prior bug where unescaped
  // backslashes/quotes in content corrupted the JSON on eval.)
  return blocks
    .map(
      (b) =>
        `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: \`${serializeJsonLdForTemplateLiteral(
          b,
        )}\` }} />`,
    )
    .join("\n");
}

export type RenderedMdx = {
  slug: string;
  title: string;
  description: string;
  ogImage: string | null;
  mdx: string;
};

/**
 * Build the full MDX file string. Layout:
 *
 *   ---
 *   title: "..."
 *   description: "..."
 *   slug: "..."
 *   date: "YYYY-MM-DD"
 *   ogImage: "..."           # optional
 *   ---
 *
 *   <script type="application/ld+json" ... />
 *   <script type="application/ld+json" ... />  # FAQ if applicable
 *
 *   # body...
 */
export function renderMdxFromDraft(
  draft: DraftLike,
  org: OrgLike | null = null,
): RenderedMdx {
  const title = deriveTitle(draft);
  const description = deriveDescription(draft, title);
  const slug = slugifyTitle(title);
  const ogImage = deriveOgImage(draft);
  const dateIso = (draft.createdAt instanceof Date
    ? draft.createdAt
    : new Date(draft.createdAt)
  )
    .toISOString()
    .slice(0, 10);

  const frontmatterLines = [
    "---",
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description)}`,
    `slug: ${yamlString(slug)}`,
    `date: ${yamlString(dateIso)}`,
    ...(ogImage ? [`ogImage: ${yamlString(ogImage)}`] : []),
    "---",
  ];

  const body =
    (draft.outputMarkdown && draft.outputMarkdown.trim()) ||
    htmlToMdx(draft.htmlBody) ||
    "";

  const jsonLd = renderJsonLdScripts(draft, org, title, description);

  const mdx = [frontmatterLines.join("\n"), "", jsonLd, "", body, ""].join("\n");
  return { slug, title, description, ogImage, mdx };
}

// ---- Claude Code prompt ------------------------------------------------

/** Folder for each format on a typical Next.js content site. */
function contentPathFor(format: ContentFormat, slug: string): string {
  switch (format) {
    case "BLOG_POST":
      return `src/content/blog/${slug}.mdx`;
    case "NEIGHBORHOOD_PAGE":
      return `src/content/neighborhoods/${slug}.mdx`;
    case "PROPERTY_DESCRIPTION":
      return `src/content/properties/${slug}.mdx`;
    case "FAQ_BLOCK":
      return `src/content/faqs/${slug}.mdx`;
    case "META_REWRITE":
      return `src/content/meta/${slug}.mdx`;
    case "AD_COPY":
      return `src/content/ads/${slug}.mdx`;
    default:
      return `src/content/${slug}.mdx`;
  }
}

function publicPathFor(format: ContentFormat, slug: string): string {
  switch (format) {
    case "BLOG_POST":
      return `/blog/${slug}`;
    case "NEIGHBORHOOD_PAGE":
      return `/n/${slug}`;
    case "PROPERTY_DESCRIPTION":
      return `/properties/${slug}`;
    case "FAQ_BLOCK":
      return `/faq#${slug}`;
    case "META_REWRITE":
      return `/`;
    case "AD_COPY":
      return `/`;
    default:
      return `/${slug}`;
  }
}

/**
 * Return a paste-ready Claude Code prompt. The admin opens their client's
 * repo in Claude Code, drops this in, and Claude does the file creation +
 * commit.
 */
export function renderClaudeCodePromptFromDraft(
  draft: DraftLike,
  org: OrgLike | null,
): string {
  const rendered = renderMdxFromDraft(draft, org);
  const filePath = contentPathFor(draft.format, rendered.slug);
  const urlPath = publicPathFor(draft.format, rendered.slug);
  const domain = org?.domain ? org.domain.replace(/^https?:\/\//, "") : "<client-domain>";
  const orgName = org?.name ?? "the client";

  const internalLinks = [
    "- /contact-us",
    draft.format === "BLOG_POST" ? "- /services/..." : null,
    draft.format === "NEIGHBORHOOD_PAGE" ? "- /apply" : null,
    draft.format === "NEIGHBORHOOD_PAGE" ? "- /schedule" : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `Add a new ${draft.format.replace(/_/g, " ").toLowerCase()} to the ${orgName} site:`,
    `- File: ${filePath}`,
    `- URL: https://${domain}${urlPath}`,
    `- Title: ${rendered.title}`,
    `- Description: ${rendered.description}`,
    "",
    "Internal links to wire (if these routes exist):",
    internalLinks,
    "",
    "After creating the file:",
    "  1. Add it to any blog/sitemap index if one exists.",
    "  2. Verify the frontmatter validates against the existing content schema.",
    "  3. Run the dev server, visit the URL, and confirm the page renders.",
    "  4. Commit with message: `content: add " + rendered.slug + "`",
    "",
    "Content:",
    "",
    rendered.mdx,
  ].join("\n");
}
