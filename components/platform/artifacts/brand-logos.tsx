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

export function ChatGPTMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="ChatGPT">
      <circle cx="12" cy="12" r="10" fill="#10A37F"/>
      <path d="M12 6.5 15 8v3l-3 1.5L9 11V8l3-1.5Z" fill="#ffffff"/>
      <path d="M12 12.5 15 14v3l-3 1.5L9 17v-3l3-1.5Z" fill="#ffffff" opacity="0.65"/>
    </svg>
  );
}

export function PerplexityMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Perplexity">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#1F1F1F"/>
      <path d="M7 7h6v10H7z" stroke="#22D3EE" strokeWidth="1.6"/>
      <path d="M10 4v16M14 4v16" stroke="#22D3EE" strokeWidth="1.6"/>
    </svg>
  );
}

export function ClaudeMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Claude">
      <circle cx="12" cy="12" r="10" fill="#F3EFE8"/>
      <path
        d="M12 5.5 13.4 10l4.6 1.5-4.6 1.5L12 17.5 10.6 13 6 11.5 10.6 10 12 5.5Z"
        fill="#D97706"
      />
    </svg>
  );
}

export function GeminiMark({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Gemini">
      <path
        d="M12 2c0 5 1 6 3.5 6.5C13 9 12 10 12 15c0-5-1-6-3.5-6.5C11 8 12 7 12 2Z"
        fill="#1E88E5"
      />
      <path
        d="M12 9c0 5 1 6 3.5 6.5-2.5.5-3.5 1.5-3.5 6.5 0-5-1-6-3.5-6.5C11 15 12 14 12 9Z"
        fill="#8E24AA"
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
        boxShadow: `0 0 0 1px #f0eee6`,
        fontFamily: "var(--font-sans)",
        fontSize: "12px",
        fontWeight: 600,
        color: "#141413",
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
