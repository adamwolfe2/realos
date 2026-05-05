import * as React from "react";
import Link from "next/link";
import {
  Check,
  X,
  Mail,
  Phone,
  MapPin,
  Link as LinkIcon,
  Hash,
  Calendar,
  AtSign,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Cell primitives — Twenty-style inline pill cells used inside dense entity
// tables. Each cell wraps its value in a subtle bordered pill so the table
// reads as a structured directory (not a spreadsheet of bare text).
//
// The default treatment is a 22px-tall rounded chip with a 1px border, soft
// background, and an optional leading icon. Cells fall back to em-dash when
// the value is null/empty so absent fields don't visually skip a slot.
//
// Usage:
//   <UrlCell href="https://airbnb.com">airbnb.com</UrlCell>
//   <MoneyCell cents={2_300_000} />
//   <BooleanCell value={true} />
//   <UserCell name="Eddy Cue" seed={ownerId} />
//   <PillCell tone="success">Active</PillCell>
//   <HandleCell platform="twitter">@airbnb</HandleCell>
//   <AddressCell>4517 Washington Ave</AddressCell>
//   <DateCell value={lease.endDate} />
// ---------------------------------------------------------------------------

const baseChip =
  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-tight whitespace-nowrap max-w-full";

// Tones map to semantic intent. Defaults stay quiet (neutral chrome). Active
// + success collapse onto brand blue. Warning + danger reserved for genuinely
// time-sensitive states the operator must act on.
const PILL_TONES = {
  neutral:
    "border-border bg-muted/60 text-foreground",
  muted:
    "border-border bg-card text-muted-foreground",
  active:
    "border-primary/25 bg-primary/10 text-primary",
  success:
    "border-primary/25 bg-primary/10 text-primary",
  info:
    "border-primary/20 bg-primary/5 text-primary",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800",
  danger:
    "border-destructive/25 bg-destructive/10 text-destructive",
} as const;

export type PillTone = keyof typeof PILL_TONES;

// ---------------------------------------------------------------------------
// PillCell — Generic chip. Use for status, category, kind, source, etc.
// ---------------------------------------------------------------------------

export function PillCell({
  children,
  tone = "neutral",
  icon,
  className,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  icon?: React.ReactNode;
  className?: string;
}) {
  if (children == null || children === "" || children === "—") {
    return <EmptyCell />;
  }
  return (
    <span className={cn(baseChip, PILL_TONES[tone], className)}>
      {icon ? <span className="opacity-70 shrink-0">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// TextCell — soft-bordered text chip used for plain string fields like
// names, addresses (single line), property names, etc.
// ---------------------------------------------------------------------------

export function TextCell({
  children,
  icon,
  mono,
  className,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  if (children == null || children === "" || children === "—") {
    return <EmptyCell />;
  }
  return (
    <span
      className={cn(
        baseChip,
        "border-border bg-card text-foreground",
        mono && "font-mono",
        className,
      )}
    >
      {icon ? <span className="opacity-60 shrink-0">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// UrlCell — link pill with external-link affordance, opens in a new tab.
// Strips the protocol from the visible label so the chip stays compact.
// ---------------------------------------------------------------------------

export function UrlCell({
  href,
  children,
  external = true,
}: {
  href: string | null | undefined;
  children?: React.ReactNode;
  external?: boolean;
}) {
  if (!href) return <EmptyCell />;
  const label = children ?? href.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cn(
        baseChip,
        "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors",
      )}
    >
      <LinkIcon className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
      <span className="truncate">{label}</span>
      {external ? (
        <ExternalLink
          className="h-2.5 w-2.5 shrink-0 opacity-50"
          aria-hidden="true"
        />
      ) : null}
    </a>
  );
}

// ---------------------------------------------------------------------------
// MoneyCell — formatted USD amount. Pass cents (integer) for accuracy.
// ---------------------------------------------------------------------------

export function MoneyCell({
  cents,
  currency = "USD",
  bold,
}: {
  cents: number | null | undefined;
  currency?: string;
  /** Render bold for primary financial values like rent. */
  bold?: boolean;
}) {
  if (cents == null) return <EmptyCell />;
  const dollars = cents / 100;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(dollars);
  return (
    <span
      className={cn(
        "tabular-nums text-[12px] text-foreground leading-tight",
        bold ? "font-semibold" : "font-medium",
      )}
    >
      {formatted}
    </span>
  );
}

// ---------------------------------------------------------------------------
// BooleanCell — ✓ True / × False with subtle tone. True reads in muted
// foreground (not green) so the table doesn't go traffic-light.
// ---------------------------------------------------------------------------

export function BooleanCell({
  value,
  trueLabel = "True",
  falseLabel = "False",
}: {
  value: boolean | null | undefined;
  trueLabel?: string;
  falseLabel?: string;
}) {
  if (value == null) return <EmptyCell />;
  if (value) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-foreground tabular-nums leading-tight">
        <Check
          className="h-3 w-3 text-primary shrink-0"
          aria-hidden="true"
          strokeWidth={2.5}
        />
        {trueLabel}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums leading-tight">
      <X
        className="h-3 w-3 text-muted-foreground/50 shrink-0"
        aria-hidden="true"
        strokeWidth={2.5}
      />
      {falseLabel}
    </span>
  );
}

// ---------------------------------------------------------------------------
// UserCell — avatar + name pill, used for owner / assignee fields.
// ---------------------------------------------------------------------------

const USER_PALETTE = [
  { bg: "#1D4ED8", fg: "#FFFFFF" },
  { bg: "#2563EB", fg: "#FFFFFF" },
  { bg: "#3B82F6", fg: "#FFFFFF" },
  { bg: "#60A5FA", fg: "#0F172A" },
  { bg: "#1F2937", fg: "#FFFFFF" },
  { bg: "#6B7280", fg: "#FFFFFF" },
  { bg: "#9CA3AF", fg: "#FFFFFF" },
];

function hashToIndex(s: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % modulo;
}

export function UserCell({
  name,
  seed,
  size = 18,
  href,
}: {
  name: string | null | undefined;
  seed?: string;
  size?: number;
  href?: string;
}) {
  if (!name) return <EmptyCell />;
  const idx = hashToIndex(seed ?? name, USER_PALETTE.length);
  const { bg, fg } = USER_PALETTE[idx];
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  const inner = (
    <span
      className={cn(
        baseChip,
        "border-border bg-card text-foreground hover:bg-muted/60 transition-colors",
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center rounded-full font-semibold leading-none shrink-0"
        style={{
          width: size,
          height: size,
          backgroundColor: bg,
          color: fg,
          fontSize: size * 0.5,
        }}
      >
        {letter}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
  return href ? (
    <Link href={href} className="inline-flex">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// ---------------------------------------------------------------------------
// HandleCell — social handle pill (@ for twitter/x, lowercase for others).
// ---------------------------------------------------------------------------

const HANDLE_PREFIX: Record<string, string> = {
  twitter: "@",
  x: "@",
  instagram: "@",
  linkedin: "",
  github: "",
  facebook: "",
};

export function HandleCell({
  children,
  platform,
  href,
}: {
  children: React.ReactNode;
  platform?: keyof typeof HANDLE_PREFIX | string;
  href?: string;
}) {
  if (children == null || children === "") return <EmptyCell />;
  const prefix = platform ? HANDLE_PREFIX[platform] ?? "" : "";
  const label =
    typeof children === "string"
      ? children.startsWith(prefix)
        ? children
        : `${prefix}${children.replace(/^@/, "")}`
      : children;
  const inner = (
    <span
      className={cn(
        baseChip,
        "border-border bg-muted/40 text-foreground hover:bg-muted/60 transition-colors",
      )}
    >
      <AtSign
        className="h-3 w-3 shrink-0 opacity-50"
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
    </span>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex">
      {inner}
    </a>
  ) : (
    inner
  );
}

// ---------------------------------------------------------------------------
// AddressCell — pinpoint icon + truncated address line.
// ---------------------------------------------------------------------------

export function AddressCell({ children }: { children: React.ReactNode }) {
  if (!children) return <EmptyCell />;
  return (
    <span
      className={cn(
        baseChip,
        "border-border bg-card text-foreground max-w-[240px]",
      )}
    >
      <MapPin
        className="h-3 w-3 shrink-0 opacity-60"
        aria-hidden="true"
      />
      <span className="truncate">{children}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// EmailCell + PhoneCell — contact pills. Tap to mailto:/tel:.
// ---------------------------------------------------------------------------

export function EmailCell({ value }: { value: string | null | undefined }) {
  if (!value) return <EmptyCell />;
  return (
    <a
      href={`mailto:${value}`}
      className={cn(
        baseChip,
        "border-border bg-card text-foreground hover:bg-muted/60 transition-colors max-w-[220px]",
      )}
    >
      <Mail className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
      <span className="truncate">{value}</span>
    </a>
  );
}

export function PhoneCell({ value }: { value: string | null | undefined }) {
  if (!value) return <EmptyCell />;
  return (
    <a
      href={`tel:${value.replace(/[^0-9+]/g, "")}`}
      className={cn(
        baseChip,
        "border-border bg-card text-foreground hover:bg-muted/60 transition-colors",
      )}
    >
      <Phone className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
      <span>{value}</span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// DateCell — calendar-iconed date pill. Pass either a Date or pre-formatted
// string; the cell handles "today" and "tomorrow" naturally.
// ---------------------------------------------------------------------------

const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function DateCell({
  value,
  hideIcon,
  relative,
}: {
  value: Date | string | null | undefined;
  hideIcon?: boolean;
  /** Append "(in 5 days)" / "(2 days ago)" to the chip. */
  relative?: boolean;
}) {
  if (!value) return <EmptyCell />;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return <EmptyCell />;
  const formatted = SHORT_DATE.format(date);
  const days = Math.round(
    (date.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  const rel =
    relative && days !== 0
      ? days > 0
        ? days === 1
          ? "tomorrow"
          : `in ${days}d`
        : days === -1
          ? "yesterday"
          : `${Math.abs(days)}d ago`
      : null;
  return (
    <span className={cn(baseChip, "border-border bg-card text-foreground")}>
      {hideIcon ? null : (
        <Calendar
          className="h-3 w-3 shrink-0 opacity-60"
          aria-hidden="true"
        />
      )}
      <span className="tabular-nums">{formatted}</span>
      {rel ? (
        <span className="text-muted-foreground tabular-nums">· {rel}</span>
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// NumberCell — tabular numeric value, optionally with unit.
// ---------------------------------------------------------------------------

export function NumberCell({
  value,
  unit,
  bold,
}: {
  value: number | null | undefined;
  unit?: string;
  bold?: boolean;
}) {
  if (value == null) return <EmptyCell />;
  const formatted = value.toLocaleString();
  return (
    <span
      className={cn(
        "tabular-nums text-[12px] text-foreground leading-tight",
        bold ? "font-semibold" : "font-medium",
      )}
    >
      {formatted}
      {unit ? (
        <span className="ml-0.5 text-muted-foreground font-normal">
          {unit}
        </span>
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// HashCell — # plus an identifier (e.g. unit number, ID). Mono.
// ---------------------------------------------------------------------------

export function HashCell({ value }: { value: string | number | null | undefined }) {
  if (value == null || value === "") return <EmptyCell />;
  return (
    <span
      className={cn(
        baseChip,
        "border-border bg-muted/40 text-foreground font-mono",
      )}
    >
      <Hash className="h-3 w-3 shrink-0 opacity-50" aria-hidden="true" />
      <span>{value}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// EmptyCell — em-dash placeholder for null fields. Same height as filled
// cells so columns stay aligned.
// ---------------------------------------------------------------------------

export function EmptyCell() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center text-muted-foreground/50 text-[12px] leading-tight"
    >
      —
    </span>
  );
}
