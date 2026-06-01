"use client";

import { Globe } from "lucide-react";
import type { AuditMentionSource } from "./types";

// ---------------------------------------------------------------------------
// Real brand SVG glyphs for the audit reputation feed. Inline single-path
// SVGs keep the bundle tiny; matches the styling pattern used by
// components/portal/reputation/source-logo.tsx (paths from simple-icons,
// CC0). Added BBB + ApartmentRatings here because the portal file falls
// back to a generic star for those — for the prospect audit we want real
// brand recognition so the reputation chip row reads as "we actually
// scanned those sites" rather than "generic review aggregator."
// ---------------------------------------------------------------------------

type GlyphProps = {
  className?: string;
};

function GoogleGlyph({ className = "h-4 w-4" }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" role="img" aria-label="Google">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function RedditGlyph({ className = "h-4 w-4" }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" role="img" aria-label="Reddit" fill="#FF4500">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12.5c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}

function YelpGlyph({ className = "h-4 w-4" }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" role="img" aria-label="Yelp" fill="#D32323">
      <path d="M20.16 12.594l-4.995-1.433a1.085 1.085 0 0 0-1.318 1.548l2.247 4.692a1.088 1.088 0 0 0 1.48.428 6.967 6.967 0 0 0 2.883-4.154 1.087 1.087 0 0 0-.297-1.081zm-1.93 5.99l-3.98-3.121a1.086 1.086 0 0 0-1.748.753l-.328 5.16a1.08 1.08 0 0 0 .735 1.084c1.547.548 3.222.547 4.77-.002a1.083 1.083 0 0 0 .551-1.59zm-6.865-5.39a1.091 1.091 0 0 0-1.085-.785L4.58 12.12a1.08 1.08 0 0 0-.814.615 1.06 1.06 0 0 0-.049.865c.548 1.544 1.53 2.896 2.85 3.911a1.083 1.083 0 0 0 1.585-.32l3.222-4.029c.291-.364.365-.859.191-1.293zm2.14-2.51l-1.03-10.24a1.085 1.085 0 0 0-1.2-.984 6.967 6.967 0 0 0-4.766 2.626 1.085 1.085 0 0 0 .095 1.415l5.75 6.91c.4.477 1.1.58 1.632.247.452-.286.684-.836.516-1.361l-.997-.007zm1.847.568a1.086 1.086 0 0 0 1.3-.233l3.292-3.692a1.085 1.085 0 0 0-.24-1.648c-1.339-.85-2.87-1.291-4.438-1.305a1.085 1.085 0 0 0-1.122 1.2l.655 4.937c.068.516.418.943.915 1.115.188.065.374.138.638-.374z" />
    </svg>
  );
}

function FacebookGlyph({ className = "h-4 w-4" }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" role="img" aria-label="Facebook" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

// BBB doesn't have a clean simple-icons mark. Render the "BBB" wordmark
// in the brand navy as a tight square monogram — fits the chip footprint
// the same way the other brand SVGs do, and is instantly recognizable
// because the wordmark IS the brand.
function BbbGlyph({ className = "h-4 w-4" }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" role="img" aria-label="BBB">
      <rect width="24" height="24" rx="3" fill="#0F4C81" />
      <text
        x="12"
        y="15.5"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight="800"
        fontSize="9.5"
        fill="#FFFFFF"
        letterSpacing="-0.5"
      >
        BBB
      </text>
    </svg>
  );
}

// ApartmentRatings — green house mark. simple-icons doesn't carry one;
// matches their site's primary palette + an obvious building glyph.
function ApartmentRatingsGlyph({ className = "h-4 w-4" }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" role="img" aria-label="ApartmentRatings">
      <rect width="24" height="24" rx="3" fill="#0E9F6E" />
      <path
        fill="#FFFFFF"
        d="M12 5.5L5 11v7.5h4.5v-4h5v4H19V11l-7-5.5zm-3 8h2v2H9v-2zm4 0h2v2h-2v-2z"
      />
    </svg>
  );
}

export function SourceGlyph({
  source,
  className = "h-4 w-4",
}: {
  source: AuditMentionSource;
  className?: string;
}) {
  switch (source) {
    case "GOOGLE_REVIEW":
      return <GoogleGlyph className={className} />;
    case "REDDIT":
      return <RedditGlyph className={className} />;
    case "YELP":
      return <YelpGlyph className={className} />;
    case "FACEBOOK":
      return <FacebookGlyph className={className} />;
    case "BBB":
      return <BbbGlyph className={className} />;
    case "APARTMENT_RATINGS":
      return <ApartmentRatingsGlyph className={className} />;
    case "TAVILY_WEB":
    default:
      return <Globe className={className} aria-label="Open web" />;
  }
}
