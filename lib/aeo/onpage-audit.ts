/**
 * OnPage AEO audit — pure HTML-pattern checks.
 *
 * No DB, no IO. Given a string of HTML, run 8 boolean checks that measure
 * how citable the page is by AI engines (FAQ schema, JSON-LD,
 * canonical, content depth, Q&A structure, freshness). Each check is
 * worth 12.5 pts; the final score is the simple sum.
 *
 * Design rationale: AI engines reward structured, dated, attributed,
 * quotable content with explicit Q&A markup. The 8 checks are the
 * highest-signal-per-unit-of-work pattern matches the operator can fix
 * inside a CMS:
 *
 *   faq-schema       — explicit FAQPage JSON-LD, the strongest AEO signal
 *   org-schema       — Organization/LocalBusiness JSON-LD; lets the
 *                      engine attribute the source to a real entity
 *   article-schema   — Article (or NewsArticle/BlogPosting) JSON-LD;
 *                      gives engines an author + dateModified pivot
 *   canonical        — non-empty <link rel="canonical">; engines
 *                      deduplicate against this when emitting URLs
 *   meta-description — 50-300 chars; the engine quote target for any
 *                      "what is X" answer
 *   content-depth    — ≥800 visible body words; engines rarely cite
 *                      pages too short to host a quotable answer
 *   qa-structure     — at least one <h2>/<h3> in question form;
 *                      AI engines disproportionately surface these
 *   freshness        — if the page has a date, it's <365 days old;
 *                      stale dates are a real fail, absence is neutral
 *
 * All checks are intentionally regex-based against the raw HTML so the
 * audit runs cheaply server-side without a real DOM parser. False
 * positives are acceptable; we err toward generosity on AI-friendliness.
 */

import "server-only";

export type AeoOnPageCheckKey =
  | "faq-schema"
  | "org-schema"
  | "article-schema"
  | "canonical"
  | "meta-description"
  | "content-depth"
  | "qa-structure"
  | "freshness";

export interface AeoOnPageCheck {
  key: AeoOnPageCheckKey;
  label: string;
  pass: boolean;
  /// Short human-readable explanation. UI surfaces this verbatim.
  reason: string;
}

export interface OnPageAuditResult {
  /// 0-100, sum of passing checks × 12.5.
  score: number;
  checks: AeoOnPageCheck[];
  /// First 200 chars of <title> + meta description, joined with " — ".
  /// Surfaced in the UI so the operator can see what we audited.
  excerpt: string;
}

const POINTS_PER_CHECK = 12.5;

const CHECK_LABELS: Record<AeoOnPageCheckKey, string> = {
  "faq-schema": "FAQPage JSON-LD",
  "org-schema": "Organization JSON-LD",
  "article-schema": "Article JSON-LD",
  canonical: "Canonical URL",
  "meta-description": "Meta description (50-300 chars)",
  "content-depth": "Content depth (≥800 words)",
  "qa-structure": "Q&A structure (questions in H2/H3)",
  freshness: "Freshness (date < 1 year)",
};

function checkFaqSchema(html: string): AeoOnPageCheck {
  // Look for JSON-LD blocks containing "FAQPage" — the strongest AEO
  // signal short of a hand-built knowledge graph.
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (/"@type"\s*:\s*"FAQPage"/.test(match[1])) {
      return {
        key: "faq-schema",
        label: CHECK_LABELS["faq-schema"],
        pass: true,
        reason: "Found FAQPage JSON-LD block.",
      };
    }
  }
  return {
    key: "faq-schema",
    label: CHECK_LABELS["faq-schema"],
    pass: false,
    reason: "No FAQPage JSON-LD found. AI engines disproportionately cite explicit FAQ markup.",
  };
}

function checkOrgSchema(html: string): AeoOnPageCheck {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (/"@type"\s*:\s*"(Organization|LocalBusiness|RealEstateAgent|ApartmentComplex)"/.test(match[1])) {
      return {
        key: "org-schema",
        label: CHECK_LABELS["org-schema"],
        pass: true,
        reason: "Found Organization/LocalBusiness JSON-LD.",
      };
    }
  }
  return {
    key: "org-schema",
    label: CHECK_LABELS["org-schema"],
    pass: false,
    reason: "No Organization/LocalBusiness JSON-LD. Engines attribute citations to schema'd entities.",
  };
}

function checkArticleSchema(html: string): AeoOnPageCheck {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (/"@type"\s*:\s*"(Article|NewsArticle|BlogPosting)"/.test(match[1])) {
      return {
        key: "article-schema",
        label: CHECK_LABELS["article-schema"],
        pass: true,
        reason: "Found Article/NewsArticle/BlogPosting JSON-LD.",
      };
    }
  }
  return {
    key: "article-schema",
    label: CHECK_LABELS["article-schema"],
    pass: false,
    reason: "No Article JSON-LD. Adds author + dateModified for AI citation attribution.",
  };
}

function checkCanonical(html: string): AeoOnPageCheck {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (m && m[1].trim().length > 0) {
    return {
      key: "canonical",
      label: CHECK_LABELS.canonical,
      pass: true,
      reason: `Canonical points to ${m[1].slice(0, 120)}`,
    };
  }
  return {
    key: "canonical",
    label: CHECK_LABELS.canonical,
    pass: false,
    reason: "No <link rel=canonical>. Engines may dedupe to a different URL than yours.",
  };
}

function checkMetaDescription(html: string): AeoOnPageCheck {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  const len = m ? m[1].trim().length : 0;
  if (len >= 50 && len <= 300) {
    return {
      key: "meta-description",
      label: CHECK_LABELS["meta-description"],
      pass: true,
      reason: `${len}-char meta description.`,
    };
  }
  return {
    key: "meta-description",
    label: CHECK_LABELS["meta-description"],
    pass: false,
    reason:
      len === 0
        ? "Missing meta description. This is the most common AI-quoted snippet."
        : `Meta description is ${len} chars — sweet spot is 50-300.`,
  };
}

function stripTags(html: string): string {
  // Drop <script>, <style>, <noscript> blocks entirely (their text is not
  // visible content), then strip the rest of the tags.
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return cleaned.replace(/\s+/g, " ").trim();
}

function checkContentDepth(html: string): AeoOnPageCheck {
  const text = stripTags(html);
  const words = text.length === 0 ? 0 : text.split(/\s+/).length;
  if (words >= 800) {
    return {
      key: "content-depth",
      label: CHECK_LABELS["content-depth"],
      pass: true,
      reason: `${words.toLocaleString()} words of visible body content.`,
    };
  }
  return {
    key: "content-depth",
    label: CHECK_LABELS["content-depth"],
    pass: false,
    reason: `Only ${words.toLocaleString()} words. AI engines rarely cite pages too short to host a quotable answer (target ≥800).`,
  };
}

function checkQaStructure(html: string): AeoOnPageCheck {
  const headings = html.matchAll(/<h(2|3)[^>]*>([\s\S]*?)<\/h\1>/gi);
  for (const h of headings) {
    const text = h[2].replace(/<[^>]+>/g, "").trim();
    if (/^(what|when|where|why|how|is|are|do|does|can|should|will)\b.*\?$/i.test(text)) {
      return {
        key: "qa-structure",
        label: CHECK_LABELS["qa-structure"],
        pass: true,
        reason: `Found Q-form heading: "${text.slice(0, 80)}".`,
      };
    }
  }
  return {
    key: "qa-structure",
    label: CHECK_LABELS["qa-structure"],
    pass: false,
    reason:
      'No H2/H3 in question form (e.g. "What is …?"). AI engines disproportionately cite explicit Q&A.',
  };
}

function checkFreshness(html: string): AeoOnPageCheck {
  // Look for a <time> element with a datetime attribute, or a meta
  // tag with an article:published_time / article:modified_time / OG date.
  const candidates: string[] = [];
  const timeMatches = html.matchAll(/<time[^>]+datetime=["']([^"']+)["']/gi);
  for (const m of timeMatches) candidates.push(m[1]);
  const metaMatches = html.matchAll(
    /<meta[^>]+(?:property|name)=["'](?:article:published_time|article:modified_time|og:updated_time|date|dc\.date)["'][^>]+content=["']([^"']+)["']/gi,
  );
  for (const m of metaMatches) candidates.push(m[1]);
  if (candidates.length === 0) {
    // Absence of a date is neutral, not a fail. Treat as pass with
    // a clarifying reason so operators see the rationale.
    return {
      key: "freshness",
      label: CHECK_LABELS.freshness,
      pass: true,
      reason: "No date metadata on page — neutral (not penalized).",
    };
  }
  const now = Date.now();
  const oneYear = 365 * 24 * 60 * 60 * 1000;
  let freshest = 0;
  for (const c of candidates) {
    const t = Date.parse(c);
    if (!Number.isFinite(t)) continue;
    if (t > freshest) freshest = t;
  }
  if (freshest === 0) {
    return {
      key: "freshness",
      label: CHECK_LABELS.freshness,
      pass: true,
      reason: "Date metadata present but unparseable — neutral.",
    };
  }
  if (now - freshest <= oneYear) {
    const days = Math.round((now - freshest) / (24 * 60 * 60 * 1000));
    return {
      key: "freshness",
      label: CHECK_LABELS.freshness,
      pass: true,
      reason: `Last updated ${days} days ago.`,
    };
  }
  const months = Math.round((now - freshest) / (30 * 24 * 60 * 60 * 1000));
  return {
    key: "freshness",
    label: CHECK_LABELS.freshness,
    pass: false,
    reason: `Last updated ~${months} months ago. Stale dates discourage citation.`,
  };
}

function buildExcerpt(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
  const descMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
  );
  const desc = descMatch ? descMatch[1].trim() : "";
  const parts = [title, desc].filter((p) => p.length > 0);
  return parts.join(" — ").slice(0, 220);
}

/**
 * Run all 8 OnPage AEO checks. Pure: takes a string of HTML, returns
 * the score + per-check breakdown + a short excerpt.
 */
export function runOnPageAuditChecks(html: string): OnPageAuditResult {
  const checks: AeoOnPageCheck[] = [
    checkFaqSchema(html),
    checkOrgSchema(html),
    checkArticleSchema(html),
    checkCanonical(html),
    checkMetaDescription(html),
    checkContentDepth(html),
    checkQaStructure(html),
    checkFreshness(html),
  ];
  const passCount = checks.filter((c) => c.pass).length;
  const score = Math.round(passCount * POINTS_PER_CHECK);
  return {
    score,
    checks,
    excerpt: buildExcerpt(html),
  };
}

export const ONPAGE_AUDIT_POINTS_PER_CHECK = POINTS_PER_CHECK;
export const ONPAGE_AUDIT_CHECK_LABELS = CHECK_LABELS;
