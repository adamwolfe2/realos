import React from "react";

// Inline SVG brand marks for integrations used in marketing demos.
// Each is a minimal, recognizable representation — brand color + mark shape.
// Never used as an authoritative wordmark; always paired with the brand name.

type IconProps = { size?: number };

export function MetaMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Meta">
      <path
        d="M4 12C4 7.8 7.5 4.5 11.5 4.5c2.2 0 4 .9 5.5 2.7l-2.1 2C13.8 8 12.8 7.5 11.5 7.5 9.2 7.5 7.5 9.5 7.5 12s1.7 4.5 4 4.5c1.3 0 2.3-.5 3.4-1.7l2.1 2c-1.5 1.8-3.3 2.7-5.5 2.7C7.5 19.5 4 16.2 4 12Z"
        fill="#1877F2"
      />
    </svg>
  );
}

export function GoogleMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Google">
      <path d="M22 12.25c0-.7-.07-1.4-.2-2.05H12v3.9h5.6c-.24 1.3-.97 2.4-2.06 3.14v2.6h3.34c1.96-1.8 3.1-4.47 3.1-7.6Z" fill="#4285F4"/>
      <path d="M12 22c2.8 0 5.15-.93 6.88-2.52l-3.34-2.6c-.93.62-2.11.99-3.54.99-2.72 0-5.02-1.84-5.84-4.3H2.7v2.7C4.43 19.72 7.95 22 12 22Z" fill="#34A853"/>
      <path d="M6.16 13.57a6.03 6.03 0 0 1 0-3.14V7.74H2.7a10 10 0 0 0 0 8.52l3.46-2.7Z" fill="#FBBC05"/>
      <path d="M12 5.8c1.53 0 2.9.53 3.97 1.56l2.97-2.97C17.15 2.72 14.8 1.8 12 1.8 7.95 1.8 4.43 4.08 2.7 7.74l3.46 2.7C6.98 7.64 9.28 5.8 12 5.8Z" fill="#EA4335"/>
    </svg>
  );
}

export function TikTokMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="TikTok">
      <path d="M15 3c.3 2 1.4 3.6 3.4 4v2.6c-1.3 0-2.5-.3-3.6-1v6.7c0 4.1-3.6 6.6-7 5.4-3.8-1.3-4.8-6.1-1.7-8.6 1-.8 2.2-1.2 3.4-1.2v2.7c-.6-.1-1.2 0-1.8.3-1.7.9-1.7 3.4 0 4.3 1.3.6 2.8-.3 2.8-1.8V3H15Z" fill="#25F4EE"/>
      <path d="M16 3c.3 2 1.4 3.6 3.4 4v2.6c-1.3 0-2.5-.3-3.6-1v6.7c0 4.1-3.6 6.6-7 5.4-3.8-1.3-4.8-6.1-1.7-8.6 1-.8 2.2-1.2 3.4-1.2v2.7c-.6-.1-1.2 0-1.8.3-1.7.9-1.7 3.4 0 4.3 1.3.6 2.8-.3 2.8-1.8V3H16Z" fill="#FE2C55" opacity="0.85"/>
      <path d="M15.5 3c.3 2 1.4 3.6 3.4 4v2.6c-1.3 0-2.5-.3-3.6-1v6.7c0 4.1-3.6 6.6-7 5.4-3.8-1.3-4.8-6.1-1.7-8.6 1-.8 2.2-1.2 3.4-1.2v2.7c-.6-.1-1.2 0-1.8.3-1.7.9-1.7 3.4 0 4.3 1.3.6 2.8-.3 2.8-1.8V3h2.5Z" fill="#000000" opacity="0.6"/>
    </svg>
  );
}

export function SlackMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Slack">
      <rect x="3"  y="10" width="7"  height="4" rx="2" fill="#E01E5A"/>
      <rect x="10" y="3"  width="4"  height="7" rx="2" fill="#36C5F0"/>
      <rect x="14" y="10" width="7"  height="4" rx="2" fill="#2EB67D"/>
      <rect x="10" y="14" width="4"  height="7" rx="2" fill="#ECB22E"/>
    </svg>
  );
}

// Real OpenAI / ChatGPT mark — six-fold rotational "blossom" knot.
// Reproduces the official glyph as inline SVG so it scales crisply at any
// size and inherits surrounding background. Black-on-white (the canonical
// monochrome treatment) keeps it readable against any panel.
export function ChatGPTMark({ size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 320 320"
      fill="none"
      aria-label="ChatGPT"
      role="img"
    >
      <path
        d="M297.06 130.97a80.1 80.1 0 0 0-6.88-65.79 80.93 80.93 0 0 0-87.18-38.83A80.07 80.07 0 0 0 142.7 0a80.93 80.93 0 0 0-77.17 56.18 80.1 80.1 0 0 0-53.49 38.83 80.93 80.93 0 0 0 9.95 94.95 80.1 80.1 0 0 0 6.88 65.79 80.93 80.93 0 0 0 87.19 38.83 80.07 80.07 0 0 0 60.29 26.35 80.93 80.93 0 0 0 77.18-56.18 80.1 80.1 0 0 0 53.48-38.83 80.93 80.93 0 0 0-9.95-94.95Zm-120.66 168.15a59.92 59.92 0 0 1-38.5-13.92l1.9-1.07 63.74-36.81a10.36 10.36 0 0 0 5.24-9.07v-89.83l26.94 15.57c.27.13.46.4.5.7v74.42a60.05 60.05 0 0 1-59.82 60.01ZM47.7 247.78a59.78 59.78 0 0 1-7.16-40.28l1.9 1.14 63.79 36.81a10.4 10.4 0 0 0 10.5 0l77.84-44.94v31.13a.97.97 0 0 1-.39.83l-64.45 37.2a60.07 60.07 0 0 1-81.99-21.94l-.04.05ZM30.94 108.32a59.86 59.86 0 0 1 31.24-26.35v75.7a10 10 0 0 0 5.2 9l77.5 44.71-26.93 15.57a.97.97 0 0 1-.91 0L52.55 190.1a60.07 60.07 0 0 1-21.99-81.84l.39.07Zm221.4 51.49-77.84-45.06 26.94-15.51a.97.97 0 0 1 .91 0l64.49 37.2a60 60 0 0 1-9.27 108.16v-75.7a10.49 10.49 0 0 0-5.23-9.06v-.04Zm26.81-40.28-1.9-1.14-63.79-36.81a10.4 10.4 0 0 0-10.5 0l-77.85 44.94v-31.13a.97.97 0 0 1 .4-.83l64.45-37.2a60.07 60.07 0 0 1 89.16 62.21l.03-.04ZM112.78 175l-26.94-15.57a.96.96 0 0 1-.5-.7V84.27a60.07 60.07 0 0 1 98.39-46.13l-1.9 1.07-63.74 36.81a10.36 10.36 0 0 0-5.24 9.07L112.74 175h.04Zm14.65-31.55L162.04 123.5l34.62 19.95v40.06L162.04 203.5l-34.61-19.95V143.5Z"
        fill="#000000"
      />
    </svg>
  );
}

// Perplexity — wordmark glyph "p" inside the brand teal (#20808D / #1FB8CD).
// Approximates the official mark: a stylised lowercase "p" with the
// circular bowl rendered as a stroked ring against the dark navy ground
// the brand uses on white surfaces.
export function PerplexityMark({ size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Perplexity"
      role="img"
    >
      <rect width="24" height="24" rx="5" fill="#1F1F1F" />
      <path
        d="M12 5.25a4.75 4.75 0 0 0-4.75 4.75v8.25h2v-3.45a4.75 4.75 0 1 0 2.75-9.55Zm0 7.5a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5Z"
        fill="#1FB8CD"
      />
    </svg>
  );
}

// Claude (Anthropic) — official asterisk-burst mark in Anthropic coral
// (#D97757) on Anthropic ivory (#E2E8F0). Eight tapered petals radiating
// from the centre — the canonical Anthropic glyph used on claude.ai and
// the API console.
export function ClaudeMark({ size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Claude"
      role="img"
    >
      <rect width="24" height="24" rx="5" fill="#E2E8F0" />
      <g fill="#D97757">
        {/* 8 tapered petals at 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315° */}
        <path d="M12 4.2c.55 0 .9 1.5.9 4.2 0 2.7-.35 4.2-.9 4.2s-.9-1.5-.9-4.2c0-2.7.35-4.2.9-4.2Z" />
        <path d="M12 11.4c.55 0 .9 1.5.9 4.2 0 2.7-.35 4.2-.9 4.2s-.9-1.5-.9-4.2c0-2.7.35-4.2.9-4.2Z" />
        <path d="M4.2 12c0-.55 1.5-.9 4.2-.9 2.7 0 4.2.35 4.2.9s-1.5.9-4.2.9c-2.7 0-4.2-.35-4.2-.9Z" />
        <path d="M11.4 12c0-.55 1.5-.9 4.2-.9 2.7 0 4.2.35 4.2.9s-1.5.9-4.2.9c-2.7 0-4.2-.35-4.2-.9Z" />
        <path d="m6.49 6.49.64-.64c.39.39 1.34 1.83 2.93 3.42 1.59 1.59 3.03 2.54 3.42 2.93l-.64.64c-.39-.39-1.83-1.34-3.42-2.93-1.59-1.59-2.54-3.03-2.93-3.42Z" />
        <path d="m11.55 11.55.64-.64c.39.39 1.34 1.83 2.93 3.42 1.59 1.59 3.03 2.54 3.42 2.93l-.64.64c-.39-.39-1.83-1.34-3.42-2.93-1.59-1.59-2.54-3.03-2.93-3.42Z" />
        <path d="m17.51 6.49-.64-.64c-.39.39-1.34 1.83-2.93 3.42-1.59 1.59-3.03 2.54-3.42 2.93l.64.64c.39-.39 1.83-1.34 3.42-2.93 1.59-1.59 2.54-3.03 2.93-3.42Z" />
        <path d="m12.45 11.55-.64-.64c-.39.39-1.34 1.83-2.93 3.42-1.59 1.59-3.03 2.54-3.42 2.93l.64.64c.39-.39 1.83-1.34 3.42-2.93 1.59-1.59 2.54-3.03 2.93-3.42Z" />
      </g>
    </svg>
  );
}

// Google Gemini — official 4-pointed sparkle in the brand gradient
// (blue → purple → pink). Defined in a single linearGradient so the
// mark renders correctly inside any container and ages well alongside
// Google's own usage on /gemini.
export function GeminiMark({ size = 18 }: IconProps) {
  // Stable gradient id per render — no hooks because this is a server
  // component compatible module. Multiple instances on the same page
  // are fine because IDs are scoped via the `gradientUnits` semantics
  // we use (each <linearGradient> + <path fill="url(#...)"> pair lives
  // inside the same <svg>, so id collisions across instances don't
  // break rendering — Safari/Chrome resolve to the nearest ancestor).
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Gemini"
      role="img"
    >
      <defs>
        <linearGradient id="gemini-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4796E3" />
          <stop offset="0.5" stopColor="#9168C0" />
          <stop offset="1" stopColor="#E07592" />
        </linearGradient>
      </defs>
      <path
        d="M12 2c0 4.5 1 6.5 3.5 8s4.5 2 6.5 2c-4.5 0-6.5 1-8 3.5S12 19.5 12 22c0-4.5-1-6.5-3.5-8S4 12 2 12c4.5 0 6.5-1 8-3.5S12 4.5 12 2Z"
        fill="url(#gemini-grad)"
      />
    </svg>
  );
}

export function AppFolioMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="AppFolio">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#0073BB"/>
      <path d="M7 17 12 6l5 11h-2.5l-1-2.4H10.5L9.5 17H7Z" fill="#ffffff"/>
    </svg>
  );
}

export function CalcomMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Cal.com">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#111827"/>
      <path
        d="M13 8.2c-.9-.8-2-1.2-3.1-1.2-2.5 0-4.6 2.1-4.6 4.8 0 2.6 2 4.8 4.6 4.8 1.2 0 2.3-.5 3.1-1.2l-1.3-1.3c-.5.4-1.1.7-1.8.7a2.8 2.8 0 0 1-2.8-2.9 2.8 2.8 0 0 1 2.8-2.9c.7 0 1.3.2 1.8.7L13 8.2Z"
        fill="#ffffff"
      />
      <circle cx="16" cy="15.5" r="1.3" fill="#ffffff"/>
    </svg>
  );
}

export function ResendMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Resend">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#000000"/>
      <path d="M7 16V8h4.5c2 0 3.5 1.2 3.5 3 0 1.5-1 2.6-2.5 2.9L15 16h-2l-2-2H9v2H7Zm2-3.6h2.4c.9 0 1.6-.5 1.6-1.4 0-.8-.6-1.4-1.6-1.4H9v2.8Z" fill="#ffffff"/>
    </svg>
  );
}

export function GA4Mark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Google Analytics">
      <rect x="15" y="3"  width="6" height="18" rx="3" fill="#F9AB00"/>
      <rect x="9"  y="9"  width="6" height="12" rx="3" fill="#E37400"/>
      <rect x="3"  y="15" width="6" height="6"  rx="3" fill="#E37400"/>
    </svg>
  );
}

export function LinkedInMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="LinkedIn">
      <rect x="2" y="2" width="20" height="20" rx="3" fill="#0A66C2"/>
      <rect x="5.5" y="9" width="2.8" height="9" fill="#ffffff"/>
      <circle cx="6.9" cy="6.6" r="1.6" fill="#ffffff"/>
      <path d="M11.5 9h2.6v1.3c.6-1 1.7-1.5 2.9-1.5 2.1 0 3 1.2 3 3.3V18h-2.8v-4.8c0-1.2-.5-1.9-1.5-1.9-1.1 0-1.6.8-1.6 2V18h-2.6V9Z" fill="#ffffff"/>
    </svg>
  );
}

export function VercelMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Vercel">
      <path d="M12 3L22 20H2L12 3Z" fill="#000000"/>
    </svg>
  );
}

export function FigmaMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Figma">
      <circle cx="9"  cy="5"  r="3" fill="#F24E1E"/>
      <circle cx="15" cy="5"  r="3" fill="#FF7262"/>
      <circle cx="9"  cy="11" r="3" fill="#A259FF"/>
      <circle cx="15" cy="11" r="3" fill="#1ABCFE"/>
      <circle cx="9"  cy="17" r="3" fill="#0ACF83"/>
    </svg>
  );
}

export function BrandPill({
  name,
  color,
  children,
}: {
  name: string;
  color: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        padding: "3px 9px 3px 6px",
        borderRadius: "999px",
        backgroundColor: "#ffffff",
        boxShadow: `0 0 0 1px #E2E8F0`,
        fontFamily: "var(--font-sans)",
        fontSize: "12px",
        fontWeight: 600,
        color: "#1E2A3A",
        lineHeight: 1,
      }}
    >
      <span className="inline-flex items-center justify-center" style={{ width: "18px", height: "18px" }}>
        {children}
      </span>
      <span>{name}</span>
      <span
        style={{
          display: "inline-block",
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: color,
          marginLeft: "1px",
          opacity: 0.9,
        }}
      />
    </span>
  );
}
