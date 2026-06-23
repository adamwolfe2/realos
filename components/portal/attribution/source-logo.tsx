"use client";

import * as React from "react";
import {
  MessageSquare,
  ClipboardList,
  Radio,
  Mail,
  Users,
  PencilLine,
  Globe,
  CircleDashed,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { getSource, SOURCE_DOMAIN } from "@/lib/attribution/source-taxonomy";

// ---------------------------------------------------------------------------
// SourceLogo — one recognizable mark per canonical source.
//
// Brand channels (Zillow, Apartments.com, Google, Meta…) render the REAL brand
// logo from /public/logos/sources/<id>.png on a clean white tile (local assets,
// no runtime network). If the file is missing we fall back to a tinted
// monogram so the row never breaks. Our own capture surfaces (chatbot, form,
// email…) use a matching lucide glyph. Light theme only, per DESIGN.md.
// ---------------------------------------------------------------------------

const MONOGRAM: Record<string, string> = {
  zillow: "Z",
  apartments_com: "A",
  trulia: "Tr",
  realtor_com: "R",
  hotpads: "H",
  apartment_list: "AL",
  zumper: "Zu",
  padmapper: "P",
  rent_com: "Re",
  apartmentguide: "AG",
  rentcafe: "RC",
  craigslist: "CL",
  loopnet: "LN",
  perplexity: "P",
  gemini: "G",
  claude_ai: "C",
  google_ads: "Ad",
  meta_ads: "M",
  facebook: "f",
  instagram: "IG",
  tiktok: "TT",
  linkedin: "in",
  reddit: "r",
  youtube: "YT",
  x_twitter: "X",
  google_organic: "G",
  bing_organic: "b",
  duckduckgo: "D",
  yahoo: "Y",
};

const GLYPH: Record<string, LucideIcon> = {
  chatgpt: Sparkles,
  chatbot: MessageSquare,
  web_form: ClipboardList,
  pixel_outreach: Radio,
  email: Mail,
  referral: Users,
  manual: PencilLine,
  direct: Globe,
  other: CircleDashed,
};

export function SourceLogo({
  logo,
  size = 36,
}: {
  /** Canonical source id OR logo slug — both resolve through getSource. */
  logo: string;
  size?: number;
}) {
  const src = getSource(logo);
  const domain = SOURCE_DOMAIN[src.id];
  const [imgFailed, setImgFailed] = React.useState(false);

  const radius = Math.round(size * 0.26);
  const Glyph = GLYPH[src.logo];

  // 1. Real brand logo (local asset) on a white tile.
  if (domain && !imgFailed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center overflow-hidden border border-border bg-white"
        style={{ width: size, height: size, borderRadius: radius }}
      >
        {/* Plain img (not next/image) so an onError fallback works without
            extra config; these are tiny local brand marks. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/logos/sources/${src.id}.png`}
          alt={src.label}
          width={size}
          height={size}
          loading="lazy"
          onError={() => setImgFailed(true)}
          style={{
            width: size * 0.72,
            height: size * 0.72,
            objectFit: "contain",
          }}
        />
      </span>
    );
  }

  // 2. Owned-surface glyph.
  if (Glyph) {
    return (
      <span
        role="img"
        aria-label={src.label}
        className="inline-flex shrink-0 items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: tint(src.color, 0.12),
          color: src.color,
          border: `1px solid ${tint(src.color, 0.22)}`,
        }}
      >
        <Glyph style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.9} />
      </span>
    );
  }

  // 3. Monogram fallback (brand logo unavailable).
  const text = MONOGRAM[src.id] ?? src.label.slice(0, 1).toUpperCase();
  return (
    <span
      role="img"
      aria-label={src.label}
      className="inline-flex shrink-0 items-center justify-center font-bold leading-none"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: tint(src.color, 0.12),
        color: src.color,
        border: `1px solid ${tint(src.color, 0.22)}`,
        fontSize: text.length > 1 ? size * 0.36 : size * 0.46,
        letterSpacing: "-0.02em",
      }}
    >
      {text}
    </span>
  );
}

function tint(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
