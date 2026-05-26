// ---------------------------------------------------------------------------
// Inline copies of the site-engine-kit prompts that the LeaseStack admin
// surfaces as "Run this prompt" / "Paste the result back" tools. Kept here
// (instead of fetched from the kit repo at runtime) so the admin works
// offline and doesn't depend on the kit being checked out.
//
// Sync rule: when site-engine-kit/prompts/00 or /01 changes materially,
// bump the PROMPT_VERSION + update the constant here. Major behavior
// changes also need an admin-UI version bump so cached/in-flight runs
// don't conflate output shapes.
// ---------------------------------------------------------------------------

export const PROMPT_VERSION = "1.0.0";

export const PROMPT_00_TRIAGE = `# Prompt 00 — Submission Triage (v${PROMPT_VERSION})

You are reviewing a new \`SiteRequest\` submitted via the LeaseStack intake form. Score it and recommend the next action.

## Input

The JSON payload below this prompt — the full SiteRequest + IntakeResponse from the LeaseStack admin.

## Scoring rubric (0–3 each)

1. CONTACT_COMPLETENESS — name, email, phone, company all present?
2. BRAND_CLARITY — they know their brand OR picked a preset visually?
3. INSPIRATION_PROVIDED — 2+ inspiration URLs OR explicit preset choice?
4. CONTENT_READINESS — voice sample? bio? services? testimonials?
5. ASSETS_UPLOADED — logo? hero image? headshot if solo agent?
6. COMPLIANCE_READY — vertical clear? license info for residential RE?
7. BUDGET_FIT — tier matches stated needs?
8. TIMELINE_REALISTIC — 14+ days for Tier 1, 28+ for Tier 2?
9. DOMAIN_STATUS — they have one OR have a clear plan?
10. SOURCE_QUALITY — warm referral outranks cold inbound?

## Output

Return ONLY a JSON object — no prose:

\`\`\`json
{
  "totalScore": 0,
  "breakdown": { /* per-dimension scores */ },
  "verdict": "GO | NEEDS_INFO | DISQUALIFY",
  "reasoningOneLine": "",
  "missingItems": [],
  "redFlags": [],
  "estimatedTier": "tier1 | tier2 | tier3",
  "estimatedBuildHours": 0,
  "recommendedNextAction": "",
  "draftEmailIfNeedsInfo": "",
  "draftEmailIfDisqualify": ""
}
\`\`\`

## Thresholds

- 24–30 → GO (status → QUALIFIED)
- 14–23 → NEEDS_INFO (auto-email asking for specifics)
- 0–13 → DISQUALIFY (politely decline)

## Red flags (force DISQUALIFY regardless of score)

- Budget mismatch (wants $5K, has $500)
- Timeline impossible (live in 3 days)
- Out-of-vertical (not RE or RE-adjacent)
- Compliance impossible (no license but wants to sell as agent)
- Bad-faith signals (asking for free work, clone competitor 1:1)

## Email rules

NEEDS_INFO: reference brand name, list 2-4 missing items, 7-day window, calendar link, sign from Adam Wolfe / AM Collective.

DISQUALIFY: thank them, honest fit, offer alternatives if appropriate, leave door open, never condescending.

---

INPUT BELOW (paste the intake JSON the admin handed you):

`;

export const PROMPT_01_REVERSE_PRD = `# Prompt 01 — Reverse PRD Extraction (v${PROMPT_VERSION})

Extract a structural PRD from a live inspiration site so we can reuse its information architecture, copy patterns, motion, and visual hierarchy in a new build — without copying its content verbatim.

## Input

The URL pasted below this prompt. Use WebFetch (or equivalent) to load it. Also load /about, /services, /contact, and any obvious top-nav children.

## Extract per top-level section

For each section of the homepage, document:

1. Section type — hero, social-proof, value-prop, services, testimonials, case-study, neighborhood map, agent roster, FAQ, contact band, footer.
2. Hierarchy — eyebrow, headline, sub-headline, body, CTA. Capture wording patterns, not exact words.
3. Layout — split / centered / asymmetric / parallax / video-bg / collage. Column counts at desktop + mobile collapse behavior.
4. Imagery — b&w vs color, environmental vs portrait, full-bleed vs contained, ratio.
5. Type stack — display, body, mono accents, weights, tracking.
6. Color story — bg, ink, accent, hairline.
7. Motion — page-load reveal, scroll parallax, hover patterns, section transitions.
8. Iconography — none / line / glyph / illustrative.
9. Density — generous whitespace / editorial / dense.
10. Tone of voice — confident / clinical / warm / reverent / playful.

## Output

Return ONLY a JSON object:

\`\`\`json
{
  "url": "",
  "extractedAt": "ISO-8601",
  "siteMeta": { "brand": "", "vertical": "", "promiseInOneLine": "" },
  "tokens": {
    "colors": { "bg": "", "ink": "", "accent": "", "hairline": "", "muted": "" },
    "type": {
      "display": { "family": "", "weight": "", "tracking": "" },
      "body": { "family": "", "weight": "", "tracking": "" },
      "mono": { "family": "" }
    },
    "radius": "0|sm|md|lg|full",
    "density": "generous|editorial|dense"
  },
  "informationArchitecture": [
    { "section": "hero", "layout": "", "hierarchy": {}, "imageryNotes": "", "motion": "" }
  ],
  "voicePatterns": { "headlineStyle": "", "ctaCopy": [], "bodyExamples": [] },
  "motionInventory": [],
  "componentInventory": [],
  "presetMatch": "editorial-luxury|editorial-cream|cinematic-portfolio|soft-luxury|modern-premium|pnw-editorial|other"
}
\`\`\`

## Rules

- Never copy exact body copy. Paraphrase patterns.
- If multiple presets could fit, pick the closest single match.
- The output gets pasted back into LeaseStack's "Inspiration PRDs" panel.

---

URL TO EXTRACT FROM (paste the URL below):

`;
