# LeaseStack Design System

> Single source of truth for the LeaseStack portal + marketing surfaces. Tokens live in `app/globals.css` (`@theme` + `:root`), fonts in `app/layout.tsx`, charts in `components/portal/ui/chart-theme.ts`. **Reuse the tokens and components below — never reinvent them inline.**

> **Heritage note:** This system began as a warm-parchment "inspired by Claude" theme (terracotta + Fraunces serif). That era is **gone**. The portal now reads as a clean white/blue software product. Several variables keep their old names for back-compat (`--terracotta`, `--coral`, `--warm-sand`, `--parchment`) but are **retargeted to blue/cool-gray values** — trust the value, not the name.

---

## 1. Principles

- **Light theme only.** No dark mode, no dark backgrounds. Page background is white (`#FFFFFF`); chrome is cool-gray. There is no `prefers-color-scheme` / `.dark` block. Dark text on dark = bug.
- **No emojis, ever.** Use `lucide-react` icons (see `kpi-tile.tsx`: `ArrowUpRight`, `ArrowDownRight`, `Minus`). Icons render in brand blue or muted gray.
- **Reuse, don't reinvent.** Use `KpiTile`, `PageHeader`, `SectionCard`, `EmptyState`, and the `ls-*` utilities. Hand-rolling a header / metric / card is the thing these primitives were built to kill.
- **Immutable tokens.** All color/spacing/radius/shadow/type comes from CSS custom properties or the `ls-*`/shadcn utility layer. No one-off hex, no new fonts, no bespoke shadows.
- **Inter for everything, JetBrains Mono for numerics/code.** One sans typeface; mono is reserved for tabular figures, deltas, eyebrows-as-mono, and code.

---

## 2. Color

Brand is **blue `#2563EB`**, not terracotta. Defined twice: as Tailwind v4 `@theme` `--color-*` tokens (shadcn-mirrored, line 18+) and as legacy `:root` aliases (line 78+). Source: `app/globals.css`.

### Brand / accent
| Token | Value | Role |
|---|---|---|
| `--color-primary` / `--terracotta` / `--accent` / `--blue` | `#2563EB` | Primary brand blue — CTAs, active states, series 1, eyebrows |
| `--color-primary-dark` / `--terracotta-hover` | `#1D4ED8` | Hover / pressed brand |
| `--color-primary-light` / `--coral` | `#3B82F6` | Lighter brand / 3rd series |
| `--color-accent` | `#EFF6FF` | Brand wash / accent surface |
| `--brand-soft` / `--brand-wash` / `--brand-glow` / `--brand-strong` | `rgba(37,99,235, .08 / .04 / .18 / .28)` | Tints, hover layers, glow (used by `ls-card-accent`, sidebar active) |

### Canvas / surfaces
| Token | Value | Role |
|---|---|---|
| `--color-background` / `--parchment` / `--white` | `#FFFFFF` | Page + card background |
| `--color-secondary` / `--ivory` / `--color-surface` | `#F9FAFB` | App background, subtle panels |
| `--warm-sand` / `--color-muted` | `#F3F4F6` | Chips, neutral pill bg |
| `--color-elevated` | `#F4F6F8` | Sidebar item hover, meta pill bg |
| `--color-overlay` | `#EDF0F4` | Dropdown / overlay layer |

### Text
| Token | Value | Role |
|---|---|---|
| `--color-foreground` / `--near-black` | `#0F172A` | Primary text + "dark" section ink |
| `--charcoal-warm` | `#1F2937` | Body text |
| `--olive-gray` | `#4B5563` | Secondary / muted text |
| `--stone-gray` / `--color-muted-foreground` | `#6B7280` | Tertiary text, eyebrow labels, select chevron |
| `--warm-silver` | `#D1D5DB` | Disabled / on-dark light gray |

### Borders / rings
| Token | Value | Role |
|---|---|---|
| `--hair` | `#EEF0F3` | Default hairline on white (cards, headers, table rules) |
| `--hair-strong` | `#DEE2E8` | Card-on-card boundary, select border, hover border |
| `--hair-active` | `rgba(37,99,235,.32)` | Active hairline |
| `--color-border` / `--border` / `--border-cream` | `#EAECEF` / `#E5E7EB` | shadcn border / legacy border |
| `--border-warm` / `--ring-warm` | `#D1D5DB` | Stronger border, hover ring |
| `--focus-blue` / `--color-ring` | `#2563EB` | Focus ring color |

### Semantic status
| Token | Value | Role |
|---|---|---|
| `--success` | `#16A34A` | Success / positive delta |
| `--warning` | `#F59E0B` | Warning |
| `--error` / `--danger` / `--color-destructive` | `#DC2626` | Error / negative delta |

### Chart colors — `components/portal/ui/chart-theme.ts`
**All Recharts visuals import `CHART_COLORS`. Never hardcode chart hex.**

| Key | Hex | Use |
|---|---|---|
| `brand` | `#2563EB` | Primary series |
| `brandDeep` | `#1D4ED8` | 2nd series |
| `brandSoft` | `#3B82F6` | 3rd series |
| `brandFog` | `#93C5FD` | 4th / background fill |
| `success` | `#16A34A` | Positive |
| `warning` | `#F59E0B` | Caution |
| `danger` | `#DC2626` | Negative |
| `ink` | `#0F172A` | Darkest text |
| `body` | `#1F2937` | Tooltip body text |
| `muted` | `#6B7280` | Axis ticks, legend |
| `silver` | `#9CA3AF` | De-emphasized |
| `grid` | `#EEF0F3` | Horizontal grid lines |
| `axis` | `#94A3B8` | Axis tick labels |

Also exports ready-made `CHART_AXIS_TICK`, `CHART_GRID_PROPS`, `CHART_TOOLTIP_STYLE`, `CHART_TOOLTIP_LABEL_STYLE`, `CHART_TOOLTIP_ITEM_STYLE`, `CHART_LEGEND_STYLE`, and `CHART_GRADIENTS` (`#lsBrandFill` linear gradient). KPI sparkline/bars/gauge in `kpi-tile.tsx` use the same blue (`#2563EB`) + `#93C5FD` family.

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
| `ls-card` (default card) | `14px` | `globals.css` `.ls-card` |
| `ls-select`, sidebar item, primary buttons | `8px` | `globals.css` |
| `ls-alert` | `12px` | `globals.css` |
| KpiTile focus ring wrapper, icon tiles | `rounded-xl` / `rounded-lg` | `kpi-tile.tsx` |
| `EmptyState` card | `rounded-xl` | `empty-state.tsx` |
| shadcn `.input` | `0.375rem` (`6px`) | `globals.css` |
| Pills / deltas | `999px` | `globals.css` |

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
- Motion: `--ease-out: cubic-bezier(.2,.8,.2,1)`, `--ease-spring: cubic-bezier(.34,1.56,.64,1)`. Card transitions ~180–200ms.

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

**Props:** `title`, `description?`, `eyebrow?`, `meta?` (freshness pill), `breadcrumb?`, `actions?`, `bordered?` (default true). Title = `var(--font-display)` (Inter) semibold `28px md:34px`, tracking `-0.022em`; eyebrow tinted `var(--terracotta)` (blue); bottom border `var(--hair)`.

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

### `ls-*` utilities — `app/globals.css`
| Class | Purpose |
|---|---|
| `.ls-card` | Floating white card: `bg #FFF`, `1px var(--hair)`, radius `14px`, `--shadow-sm + --inner-hi`, hover deepens to `--shadow-hover` + `--hair-strong`. Base for KpiTile/SectionCard/alerts. |
| `.ls-card-accent` | Adds top-right radial brand-glow `::after`. Hero KPI / anchor cards. |
| `.ls-card-pad` (`20px`) / `.ls-card-flush` (`0`) | Padding variants. |
| `.ls-metric` + `.ls-metric-xl/lg/md` (`2.5 / 2 / 1.5rem`) | Mono tabular figures (`tnum`,`lnum`), weight 500, tight tracking. Big numbers. |
| `.ls-eyebrow` | Sans 10px uppercase, `letter-spacing .12em`, `--stone-gray`. Anchors a metric/section. |
| `.ls-delta` + `-up`/`-down`/`-flat` | Mono trend pill: up = green wash, down = red wash, flat = sand. |
| `.ls-select` | Styled native `<select>`: `appearance-none`, painted chevron, `1px var(--hair-strong)`, radius 8px, focus ring `0 0 0 3px var(--brand-glow)`. Keeps native a11y/keyboard. Add `h-9 px-3 text-sm`. |
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
- **Charts via `chart-theme.ts` only.** Import `CHART_COLORS` + the `CHART_*` style objects; reuse `#lsBrandFill` gradient. Mono axis ticks, soft `#EEF0F3` grid, brand-blue series.
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
- Trusting variable names over values — `--terracotta`/`--coral`/`--warm-sand`/`--parchment` are retargeted to blue/cool-gray; check §2.
- Querying tenant data without `requireScope()` / property-gate filtering.
