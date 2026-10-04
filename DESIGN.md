# LeaseStack Design System

> Single source of truth for the LeaseStack portal + marketing surfaces. Tokens live in `app/globals.css` (`@theme` + `:root`), fonts in `app/layout.tsx`, charts in `components/portal/ui/chart-theme.ts`. **Reuse the tokens and components below — never reinvent them inline.**

> **Heritage note:** This system began as a warm-parchment "inspired by Claude" theme (terracotta + Fraunces serif). That era is **gone**. The portal now reads as a clean white/blue software product. Several variables keep their old names for back-compat (`--blue-60`, `--blue-50`, `--gray-10-hover`, `--canvas`) but are **retargeted to blue/cool-gray values** — trust the value, not the name.

> **⚑ Carbon-forward retarget (2026-07-09):** the token *values* below were retargeted toward IBM Carbon (light) for an enterprise, production-grade read. **Brand blue `#2563EB → #0f62fe`** (hover `#0043ce`); **ink `#0F172A → #161616`**; hairlines/surfaces → Carbon grays (`#e0e0e0`, `#f4f4f4`); semantic → Carbon (`#24a148` / `#f1c21b` / `#da1e28`). **Shape sharpened:** cards `14px → 2px`, buttons/inputs/select `8/6px → 0`, alerts `12px → 2px` (pills stay `999px`); elevation is **flat #e0e0e0 border over soft shadow** (no gradient/glow on buttons or default cards). Display weights lightened (`700 → 400/600`), eyebrow `.22em → .12em` Gray-70. New primitives: **`StatusChip` / `VerificationRow`** (`components/portal/ui/status-chip.tsx`) — the one connection-status vocabulary (Live = green, never blue). Full spec + fix-wave plan: `.claude/specs/2026-07-09-ibm-carbon-forward-design.md` + `-carbon-audit-findings.md`.

---

## 1. Principles

- **One screen, one story (Adam, 2026-07-24).** Every portal/admin page composes as a single dense view: `PageHeader` + KPI strip + ONE main surface. No endless scroll, no stacked card pile, minimal explanatory text. When in doubt: simplify, cut copy, compact. The reference register is the dashboard, leads, chatbot conversations, and insights pages — every other page must look like it shipped from the same hand.
- **Light theme only.** No dark mode, no dark backgrounds. Page background is white (`#FFFFFF`); chrome is cool-gray. There is no `prefers-color-scheme` / `.dark` block. Dark text on dark = bug.
- **No emojis, ever.** Use `lucide-react` icons (see `kpi-tile.tsx`: `ArrowUpRight`, `ArrowDownRight`, `Minus`). Icons render in brand blue or muted gray.
- **Reuse, don't reinvent.** Use `KpiTile`, `PageHeader`, `SectionCard`, `EmptyState`, and the `ls-*` utilities. Hand-rolling a header / metric / card is the thing these primitives were built to kill.
- **Immutable tokens.** All color/spacing/radius/shadow/type comes from CSS custom properties or the `ls-*`/shadcn utility layer. No one-off hex, no new fonts, no bespoke shadows.
- **Inter for everything, JetBrains Mono for numerics/code.** One sans typeface; mono is reserved for tabular figures, deltas, eyebrows-as-mono, and code.

---

## 2. Color

Brand is **Carbon blue `#0f62fe`**. Defined twice: as Tailwind v4 `@theme` `--color-*` tokens (shadcn-mirrored) and as legacy `:root` aliases. Source of truth: `app/globals.css`. Do not copy hexes from other files; use the tokens.

### Brand / accent
| Token | Value | Role |
|---|---|---|
| `--color-primary` / `--blue-60` / `--accent` / `--blue` | `#0f62fe` | Primary brand blue: CTAs, active states, series 1, eyebrows |
| `--color-primary-dark` / `--blue-70` | `#0043ce` | Hover / pressed brand |
| `--color-primary-light` / `--blue-50` | `#4589ff` | Lighter brand / 3rd series |
| `--color-accent` | `#edf5ff` | Brand wash / accent surface |
| `--brand-soft` / `--brand-wash` / `--brand-glow` / `--brand-strong` | `rgba(15,98,254, .08 / .04 / .18 / .28)` | Tints and hover layers |

### Canvas / surfaces
| Token | Value | Role |
|---|---|---|
| `--color-background` / `--canvas` / `--white` | `#ffffff` | Page + card background |
| `--color-secondary` / `--gray-10` / `--color-surface` | `#f4f4f4` | App background, subtle panels |
| `--gray-10-hover` / `--color-muted` | `#e8e8e8` | Chips, neutral pill bg |
| `--color-elevated` | `#F4F6F8` | Sidebar item hover, meta pill bg |
| `--color-overlay` | `#EDF0F4` | Dropdown / overlay layer |

### Text
| Token | Value | Role |
|---|---|---|
| `--color-foreground` / `--gray-100` | `#161616` | Primary text |
| `--gray-80` | `#393939` | Body text |
| `--gray-70` | `#525252` | Secondary text |
| `--gray-60` / `--color-muted-foreground` | `#6f6f6f` | Tertiary text, eyebrow labels (4.95:1 on white, the lightest allowed text grey) |
| `--silver` | `#d1d5db` | Disabled / decorative only |

### Borders / rings
| Token | Value | Role |
|---|---|---|
| `--hair` / `--color-border` / `--border-light` | `#e0e0e0` | Default hairline on white (cards, headers, table rules) |
| `--hair-strong` | `#c6c6c6` | Card-on-card boundary, select border, hover border |
| `--hair-active` | `rgba(15,98,254,.32)` | Active hairline |
| `--border-mid` / `--ring-light` | `#d1d5db` | Stronger border, hover ring |
| `--focus-blue` / `--color-ring` | `#0f62fe` | Focus ring color |

### Semantic status
| Token | Value | Role |
|---|---|---|
| `--success` | `#24a148` | Success / positive delta (`--color-success-dark` `#0e6027` for text) |
| `--warning` | `#f1c21b` | Warning |
| `--error` / `--danger` / `--color-destructive` | `#da1e28` | Error / negative delta (`--color-destructive-dark` `#a2191f` for text) |

### Chart colors — `components/portal/ui/chart-theme.ts`
**All Recharts visuals import `CHART_COLORS`. Never hardcode chart hex.**

| Key | Hex | Use |
|---|---|---|
| `brand` | `#0f62fe` | Primary series |
| `brandDeep` | `#002d9c` | 2nd series |
| `brandSoft` | `#4589ff` | 3rd series |
| `brandFog` | `#a6c8ff` | 4th / background fill |
| `success` | `#24a148` | Positive |
| `warning` | `#f1c21b` | Caution |
| `danger` | `#da1e28` | Negative |
| `ink` | `#161616` | Darkest text |
| `body` | `#393939` | Tooltip body text |
| `muted` | `#6f6f6f` | Axis ticks, legend |
| `silver` | `#8d8d8d` | De-emphasized (non-text only) |
| `grid` | `#e0e0e0` | Horizontal grid lines |
| `axis` | `#8d8d8d` | Axis tick labels |

Also exports ready-made `CHART_AXIS_TICK`, `CHART_GRID_PROPS`, `CHART_TOOLTIP_STYLE`, `CHART_TOOLTIP_LABEL_STYLE`, `CHART_TOOLTIP_ITEM_STYLE`, `CHART_LEGEND_STYLE`, and `CHART_GRADIENTS` (`#lsBrandFill` linear gradient). KPI sparkline/bars/gauge in `kpi-tile.tsx` use the same blue (`#0f62fe`) + `#a6c8ff` family.

---

## 3. Typography

Setup in `app/layout.tsx` → mapped to `@theme` variables in `app/globals.css` (line 18+).

| `next/font` import | CSS variable | Theme token | Role |
|---|---|---|---|
| `Inter` | `--font-inter` | `--font-sans` = `--font-display` = `--font-serif` | **Everything**: display, headings, body, UI |
| `JetBrains_Mono` | `--font-jetbrains` | `--font-mono` | Tabular numerics, KPI metrics, deltas, code, mono eyebrows |
| `Fraunces` | `--font-fraunces` | *(declared, effectively unused)* | Legacy serif var — `--font-serif` now points to Inter; do **not** introduce serif headings |

`layout.tsx` wires all three on `<html>` and sets `<body style={{ fontFamily: "var(--font-sans)" }}>`. The in-file `DECISION` comment is explicit: Fraunces/serif from the warm-cream era was removed; the portal reads as a clean software product.

**Stacks** (`globals.css`):
- `--font-sans` → `var(--font-inter), -apple-system, system-ui, "Helvetica Neue", Arial, sans-serif`
- `--font-mono` → `var(--font-jetbrains), ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`

**Type scale utilities** (`globals.css`): `.display-hero` (clamp 42→64px / 700), `.display-large` (36→52 / 700), `.heading-section` (28→40 / 700), `.heading-sub`, `.heading-card`, `.body-lead` (18 / 1.6), `.body-default` (16 / 1.6), `.body-small`, `.caption-ui`, `.label-mono`, `.eyebrow` (mono 11px, `letter-spacing: .22em`, uppercase, blue). All sans = Inter; tight negative tracking on headings, `1.6` line-height on body.

---

## 4. Spacing / Radius / Shadow

### Radius
| Context | Value | Source |
|---|---|---|
| `ls-card` (default card), `ls-alert`, `EmptyState`, KpiTile | `2px` | `globals.css` `.ls-card` (Carbon retarget) |
| Marketing buttons (`.btn-primary`/`.btn-secondary`), inputs, `ls-select`, sidebar items | `0` | `globals.css` |
| App `Button` / `buttonVariants`, `.ls-btn` | `2px` | `components/ui/button.tsx` |
| Icon tiles / avatars (not card wrappers) | `rounded-lg`/`rounded-xl` OK | e.g. lead detail logo tiles |
| Pills / deltas / status chips | `999px` | `globals.css` |
| Loading skeleton placeholder blocks | `rounded-xl` (established idiom, pending review) | `app/portal/**/loading.tsx` |

> The 14px/8px/12px values previously listed here predate the Carbon sharp-shape retarget — `globals.css` is the source of truth (cards 2px, controls 0).

### Shadow (`globals.css` `:root`)
| Token | Value | Use |
|---|---|---|
| `--shadow-xs` | `0 1px 1px rgba(15,23,42,.03)` | Faintest lift |
| `--shadow-sm` | `0 1px 2px /.04 + 0 1px 1px /.02` | Default card resting |
| `--shadow-md` | `0 1px 2px /.04 + 0 4px 12px /.05` | Dropdowns, raised |
| `--shadow-lg` | `0 2px 4px /.05 + 0 12px 28px /.08` | Modals / max elevation |
| `--shadow-hover` | `0 1px 2px /.05 + 0 8px 22px /.08` | Card hover |
| `--inner-hi` | `inset 0 1px 0 rgba(255,255,255,.9)` | Top inner highlight, pairs with every card |

All shadows are cool-toned (`rgba(15,23,42,…)`) — the warm shadows in the old DESIGN.md are gone.

### Spacing & motion
- Card padding: `p-5` (20px) on KpiTile / SectionCard; `--ls-card-pad` = `20px`.
- PageHeader: `pb-5 mb-6` bordered (content sits 24px below).
- Motion: `--ease-out: cubic-bezier(.2,.8,.2,1)` is THE easing — CSS and framer
  (`EASE_OUT` in `components/portal/ui/motion.tsx`) share it. `--ease-spring:
  cubic-bezier(.34,1.56,.64,1)` / `SPRING_POP` are reserved for celebratory
  pops (a step completing, a check landing) — never for plain entrances.
- Duration scale (CSS tokens `--dur-micro` / `--dur-ui` / `--dur-enter`; framer `DUR`): **120ms** micro (hover, press, focus) · **200ms** small UI
  state (tabs, dialogs, chips, card hovers) · **300ms** entrances, drawers,
  height changes · **600–900ms** data reveals (bars, arcs, count-ups). Motion
  plays ONCE; no infinite loops outside loading indicators.
- Entrance keyframes declare only a `from` state so the element's base style
  IS its final state — print and reduced-motion then render finished content
  (see the "print-safe entrance utilities" block in `globals.css`).
- Reduced motion: a global `prefers-reduced-motion` safety net at the bottom of
  `globals.css` covers all CSS animation; any new framer-motion code must call
  `useReducedMotion` itself.
- Viewport reveals: fire once, ~0.2 visibility threshold. Use `InView`
  (`components/ui/in-view.tsx`) + `.ls-reveal` / `.ls-grow-x`, or the framer
  kit in `components/portal/ui/motion.tsx` (`CountUpValue`, `GrowBar`,
  `StaggerGroup`).

---

## 5. Components

### `KpiTile` — `components/portal/dashboard/kpi-tile.tsx`
Canonical metric tile. White floating card (`ls-card`) with mono tabular hero number, optional micro-chart, delta pill, live dot, lock state.

**Props:** `label`, `value`, `hint?`, `delta?: { value, trend: "up"|"down"|"flat" }`, `spark?: number[]`, `gaugeValue?: number (0..1)`, `chart?: "sparkline"|"bars"|"gauge"`, `icon?`, `loading?`, `href?`, `live?`, `locked?: { reason, href }`, `variant?: "default"|"accent"`.

- Chart auto-routes: `gaugeValue` → gauge, else `spark` → sparkline; force with `chart`.
- `variant="accent"` adds `ls-card-accent` brand glow (hero KPI).
- `href` wraps in `Link` with brand focus ring. `locked` shows reason + "Connect →".
- Number uses `ls-metric ls-metric-lg`; eyebrow label uses `ls-eyebrow`; delta uses `ls-delta`.

```tsx
<KpiTile label="Leads (30d)" value="1,284" delta={{ value: "+12%", trend: "up" }}
  spark={[4,9,7,12,15]} icon={<Users className="h-4 w-4" />} href="/portal/leads" variant="accent" live />
```

### `PageHeader` — `components/admin/page-header.tsx`
Canonical page chrome at the top of every admin/portal page. Replaces all hand-rolled `text-xl`/serif "Welcome" headers.

**Props:** `title`, `description?`, `eyebrow?`, `meta?` (freshness pill), `breadcrumb?`, `actions?`, `bordered?` (default true). Title = `var(--font-display)` (Inter) semibold `28px md:34px`, tracking `-0.022em`; eyebrow tinted `var(--blue-60)` (blue); bottom border `var(--hair)`.

```tsx
<PageHeader eyebrow="Portfolio" title="Performance"
  description="Every channel across all properties."
  meta="as of 2:04 PM" actions={<Button>Export</Button>} />
```

Same file exports **`SectionCard`** (`label`, `description?`, `action?`, `padded?`) — `ls-card` section wrapper with a 14px semibold label row, for detail pages.

### `EmptyState` — `components/portal/ui/empty-state.tsx`
Single "no data yet" primitive: centered icon (in `bg-primary/10 text-primary` rounded chip) + title + body + optional primary/secondary CTA links.

**Props:** `icon?`, `title`, `body?`, `action?: { label, href }`, `secondary?: { label, href }`, `variant?: "card"|"bare"`. `"card"` wraps in dashed-border `bg-secondary/40` rounded-xl panel.

```tsx
<EmptyState icon={<Inbox className="h-4 w-4" />} title="No conversations yet"
  body="Once the chatbot books a tour it shows here."
  action={{ label: "View setup", href: "/portal/settings" }} />
```

### Buttons
Live classes: `.btn-primary` / `.btn-secondary` (marketing) and `Button` / `buttonVariants` (app). Primary is a flat `--color-primary` fill (hover `--color-primary-dark`), no gradient, glow or lift. Use one filled primary per view; secondary row actions use `variant="outline"`.

### `ls-*` utilities — `app/globals.css`
| Class | Purpose |
|---|---|
| `.ls-card` | Floating white card: `bg #FFF`, `1px var(--hair)`, radius `2px`, flat (no shadow), hover darkens the border to `--hair-strong`. Base for KpiTile/SectionCard/alerts. |
| `.ls-card-accent` | Adds top-right radial brand-glow `::after`. Hero KPI / anchor cards. |
| `.ls-card-pad` (`20px`) | Padding variant. |
| `.ls-metric` + `.ls-metric-lg/md` (`2 / 1.5rem`) | Mono tabular figures (`tnum`,`lnum`), weight 500, tight tracking. Big numbers. |
| `.ls-eyebrow` | Sans 10px uppercase, `letter-spacing .12em`, `--gray-60`. Anchors a metric/section. |
| `.ls-delta` + `-up`/`-down`/`-flat` | Mono trend pill: up = green wash, down = red wash, flat = sand. |
| `.ls-select` | Styled native `<select>`: `appearance-none`, painted chevron, `1px var(--hair-strong)`, radius 0, focus ring `0 0 0 3px var(--brand-glow)`. Keeps native a11y/keyboard. Add `h-9 px-3 text-sm`. |
| `.ls-pill` + `-neutral/-info/-active/-success/-warning/-danger` | Status pills with dot. |
| `.ls-alert` + `-info/-warning/-success` | Insight cards with left accent bar. |
| `.ls-sidebar`, `.ls-sidebar-item`, `.ls-sidebar-section-label` | Sidebar nav (active = brand bar + glow). |

```tsx
<select className="ls-select h-9 px-3 text-sm">…</select>
<div className="ls-card p-5"><div className="ls-eyebrow">Occupancy</div>
  <div className="ls-metric ls-metric-lg">94.2%</div></div>
```

---

## 6. Patterns

- **Tenant scoping (mandatory on every data surface).** Every portal page/action/query resolves access via `requireScope()` / `getScope()` / `requireAgency()` / `requireClient()` from `lib/tenancy/scope.ts`. Queries must filter by `orgId` **and** the property gate (`propertyIdsToWhere` / `propertyWhereFragment`) — never widen scope in a query module, and fail **closed** on an empty allowed-list (a restricted user with nothing in scope must match no rows, not org-wide).
- **`loading.tsx` per route.** Every portal/admin route ships a skeleton `loading.tsx` so streaming renders instantly (no flash of nothing). Use `KpiTile loading` and shadcn skeletons for the placeholder.
- **Charts via `chart-theme.ts` only.** Import `CHART_COLORS` + the `CHART_*` style objects; reuse `#lsBrandFill` gradient. Mono axis ticks, `#e0e0e0` grid, brand-blue series.
- **Responsive.** Mobile-first; PageHeader stacks `flex-col md:flex-row`, titles scale `28px → md:34px`, KPI grids collapse to single column at `sm`/`md`. Generous touch targets.
- **Accessibility.** Native `<select>` (`ls-select`) keeps keyboard/screen-reader behavior; every interactive element gets a focus ring (`focus-visible:ring-2 ring-primary/40`); icons are `aria-hidden` with text labels; live dots carry `aria-label="Live"`; semantic `<header>`/`<section>`/`<table>`; skip-link in `layout.tsx`.

---

## 7. Anti-patterns

- Inline one-off hex or spacing — use tokens (`var(--…)`) and `ls-*`/shadcn utilities.
- New fonts, shadows, or radii — the scale in §3/§4 is the whole vocabulary. No serif headings (Fraunces is dead weight).
- Dark backgrounds / dark mode — light theme only; dark-on-dark is a bug.
- Emojis — use `lucide-react` icons.
- Hand-rolled headers / metric tiles / empty states — use `PageHeader`, `KpiTile`, `EmptyState`, `SectionCard`.
- Hardcoded chart colors — import `CHART_COLORS`.
- Raw `dangerouslySetInnerHTML` JSON-LD — always run structured data through `serializeJsonLd` (`lib/seo/serialize-json-ld.ts`; XSS-tested) as `layout.tsx` does.
- Trusting variable names over values — `--blue-60`/`--blue-50`/`--gray-10-hover`/`--canvas` are retargeted to blue/cool-gray; check §2.
- Querying tenant data without `requireScope()` / property-gate filtering.
