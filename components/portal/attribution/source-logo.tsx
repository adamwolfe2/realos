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
import { getSource } from "@/lib/attribution/source-taxonomy";

// ---------------------------------------------------------------------------
// SourceLogo — one recognizable mark per canonical source.
//
// Brand channels (Zillow, Apartments.com, Google, Meta…) render as a tinted
// monogram tile in the brand color — instantly readable by color + initials,
// and robust (no dependency on a brand asset file or a specific simple-icons
// export existing). Our own capture surfaces (chatbot, form, email…) use a
// matching lucide glyph. Light theme only, per DESIGN.md.
// ---------------------------------------------------------------------------

// Monogram text per brand slug. Kept short (1–2 chars) so it stays legible.
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
  google: "G",
  bing: "b",
  duckduckgo: "D",
  yahoo: "Y",
};

// Lucide glyph per owned / catch-all slug.
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
  const color = src.color;
  const radius = Math.round(size * 0.28);
  const Glyph = GLYPH[src.logo];

  const tileStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    background: hexToTint(color, 0.12),
    color,
    border: `1px solid ${hexToTint(color, 0.22)}`,
  };

  if (Glyph) {
    return (
      <span
        role="img"
        aria-label={src.label}
        className="inline-flex shrink-0 items-center justify-center"
        style={tileStyle}
      >
        <Glyph style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.9} />
      </span>
    );
  }

  const text = MONOGRAM[src.logo] ?? src.label.slice(0, 1).toUpperCase();
  return (
    <span
      role="img"
      aria-label={src.label}
      className="inline-flex shrink-0 items-center justify-center font-bold leading-none"
      style={{
        ...tileStyle,
        fontSize: text.length > 1 ? size * 0.36 : size * 0.46,
        letterSpacing: "-0.02em",
      }}
    >
      {text}
    </span>
  );
}

// Flatten a brand hex toward white at the given strength so the tile reads as a
// soft tinted chip rather than a saturated block — keeps the light-theme feel.
function hexToTint(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
