"use client";

import * as React from "react";
import { Globe, Star } from "lucide-react";
import type { MentionSource } from "@prisma/client";

// ---------------------------------------------------------------------------
// Brand SVG badges for each review source. Inline single-path SVGs keep the
// bundle tiny and guarantee consistent rendering across browsers.
// Paths are from simple-icons (CC0) adapted to 24x24 viewBox.
// ---------------------------------------------------------------------------

type LogoProps = {
  className?: string;
  title?: string;
};

function GoogleIcon({ className = "h-4 w-4", title = "Google" }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-label={title}
      role="img"
    >
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

function RedditIcon({ className = "h-4 w-4", title = "Reddit" }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-label={title}
      role="img"
      fill="#FF4500"
    >
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12.5c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}

function YelpIcon({ className = "h-4 w-4", title = "Yelp" }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-label={title}
      role="img"
      fill="#AF0606"
    >
      <path d="M20.16 12.594l-4.995-1.433a1.085 1.085 0 0 0-1.318 1.548l2.247 4.692a1.088 1.088 0 0 0 1.48.428 6.967 6.967 0 0 0 2.883-4.154 1.087 1.087 0 0 0-.297-1.081zm-1.93 5.99l-3.98-3.121a1.086 1.086 0 0 0-1.748.753l-.328 5.16a1.08 1.08 0 0 0 .735 1.084c1.547.548 3.222.547 4.77-.002a1.083 1.083 0 0 0 .551-1.59zm-6.865-5.39a1.091 1.091 0 0 0-1.085-.785L4.58 12.12a1.08 1.08 0 0 0-.814.615 1.06 1.06 0 0 0-.049.865c.548 1.544 1.53 2.896 2.85 3.911a1.083 1.083 0 0 0 1.585-.32l3.222-4.029c.291-.364.365-.859.191-1.293zm2.14-2.51l-1.03-10.24a1.085 1.085 0 0 0-1.2-.984 6.967 6.967 0 0 0-4.766 2.626 1.085 1.085 0 0 0 .095 1.415l5.75 6.91c.4.477 1.1.58 1.632.247.452-.286.684-.836.516-1.361l-.997-.007zm1.847.568a1.086 1.086 0 0 0 1.3-.233l3.292-3.692a1.085 1.085 0 0 0-.24-1.648c-1.339-.85-2.87-1.291-4.438-1.305a1.085 1.085 0 0 0-1.122 1.2l.655 4.937c.068.516.418.943.915 1.115.188.065.374.138.638-.374z" />
    </svg>
  );
}

function FacebookIcon({
  className = "h-4 w-4",
  title = "Facebook",
}: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-label={title}
      role="img"
      fill="#1877F2"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({
  className = "h-4 w-4",
  title = "Instagram",
}: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-label={title}
      role="img"
      fill="#E4405F"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function QuoraIcon({ className = "h-4 w-4", title = "Quora" }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-label={title}
      role="img"
      fill="#B92B27"
    >
      <path d="M12.738 18.701c-.831-1.635-1.805-3.27-3.708-3.27-.364 0-.727.061-1.029.18l-.634-1.272c.77-.664 2.02-1.222 3.625-1.222 2.502 0 3.791 1.21 4.819 2.751.606-1.333.904-3.124.904-5.333 0-5.513-1.715-8.275-5.009-8.275-3.238 0-4.968 2.762-4.968 8.275 0 5.47 1.73 8.18 4.968 8.18.448 0 .826-.019 1.032-.014zm1.498 1.772c-.617.145-1.623.385-2.53.385-4.986 0-9.454-3.952-9.454-9.34 0-5.433 4.468-9.517 9.454-9.517 5.07 0 9.489 4.04 9.489 9.517 0 3.032-1.437 5.657-3.529 7.27.65.995 1.31 1.674 2.243 1.674.998 0 1.43-.791 1.495-1.42h1.432c.087.84-.319 4.017-4.014 4.017-2.249 0-3.437-1.319-4.586-2.586z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Resolve the right logo from either the MentionSource enum or the hostname.
// Hostname takes priority since Tavily results under MentionSource.TAVILY_WEB
// can still be Niche, ApartmentRatings, Quora, etc.
// ---------------------------------------------------------------------------

export function SourceLogo({
  source,
  url,
  className = "h-4 w-4",
}: {
  source: MentionSource;
  url: string;
  className?: string;
}) {
  let host = "";
  try {
    host = new URL(url).host.toLowerCase().replace(/^www\./, "");
  } catch {
    // ignore
  }

  if (source === "GOOGLE_REVIEW" || /google\.com$/.test(host))
    return <GoogleIcon className={className} />;
  if (source === "REDDIT" || /reddit\.com$/.test(host))
    return <RedditIcon className={className} />;
  if (source === "YELP" || /yelp\.com$/.test(host))
    return <YelpIcon className={className} />;
  if (source === "FACEBOOK_PUBLIC" || /facebook\.com$/.test(host))
    return <FacebookIcon className={className} />;
  if (/instagram\.com$/.test(host))
    return <InstagramIcon className={className} />;
  if (/quora\.com$/.test(host)) return <QuoraIcon className={className} />;
  // Specialist review sites that don't have a common lucide icon — star works.
  if (
    /(^|\.)(apartmentratings|niche|bbb|collegeconfidential|glassdoor)\.com$/.test(
      host
    )
  ) {
    return <Star className={className} fill="currentColor" />;
  }
  return <Globe className={className} />;
}

// Re-export the pure helper from the non-client module so existing
// `import { sourceLabel } from "...source-logo"` callers keep working
// without modification. New server-side callers should import from
// "...source-label" directly.
export { sourceLabel } from "./source-label";
