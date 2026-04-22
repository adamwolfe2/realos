import * as React from "react";
import Image from "next/image";
import {
  siGoogleads,
  siGoogleanalytics,
  siMeta,
  siTiktok,
  siCalendly,
  siCaldotcom,
  siMake,
  siZapier,
} from "simple-icons";

// ---------------------------------------------------------------------------
// Brand logos for the integrations marketplace.
//
// Mix: real SVG paths from simple-icons (where licensed), hand-written SVG
// for well-known brands simple-icons drops (LinkedIn, Slack, Twilio), and
// polished glyph marks for niche vendors (PMS platforms) + our own modules.
//
// Each logo is a 24×24 square that sits inside a fixed-size tile. The caller
// passes a color which gets applied via currentColor to keep the mark
// flexible across light/dark contexts.
// ---------------------------------------------------------------------------

type SiIcon = { path: string; title: string };

function SimpleIconSvg({ icon, title }: { icon: SiIcon; title: string }) {
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      fill="currentColor"
    >
      <path d={icon.path} />
    </svg>
  );
}

// -- Real brand marks, hand-written for the ones simple-icons drops --------

function LinkedInMark() {
  return (
    <svg
      role="img"
      aria-label="LinkedIn"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      fill="currentColor"
    >
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.86-3.04-1.86 0-2.15 1.45-2.15 2.95v5.66H9.32V9h3.42v1.56h.05c.48-.9 1.64-1.86 3.37-1.86 3.6 0 4.27 2.37 4.27 5.46v6.29zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .78 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .78 23.2 0 22.22 0z" />
    </svg>
  );
}

function SlackMark() {
  return (
    <svg
      role="img"
      aria-label="Slack"
      viewBox="0 0 127 127"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
    >
      <path
        d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2S.8 87.3.8 80s5.9-13.2 13.2-13.2h13.2zM33.8 80c0-7.3 5.9-13.2 13.2-13.2s13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2S33.8 120.3 33.8 113z"
        fill="#E01E5A"
      />
      <path
        d="M47 27c-7.3 0-13.2-5.9-13.2-13.2S39.7.6 47 .6s13.2 5.9 13.2 13.2V27zM47 33.7c7.3 0 13.2 5.9 13.2 13.2S54.3 60.1 47 60.1H13.9C6.6 60.1.7 54.2.7 46.9s5.9-13.2 13.2-13.2z"
        fill="#36C5F0"
      />
      <path
        d="M99.9 46.9c0-7.3 5.9-13.2 13.2-13.2s13.2 5.9 13.2 13.2-5.9 13.2-13.2 13.2H99.9zM93.3 46.9c0 7.3-5.9 13.2-13.2 13.2S66.9 54.2 66.9 46.9v-33c0-7.3 5.9-13.2 13.2-13.2s13.2 5.9 13.2 13.2z"
        fill="#2EB67D"
      />
      <path
        d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2s-5.9 13.2-13.2 13.2-13.2-5.9-13.2-13.2V99.8zM80.1 93.2c-7.3 0-13.2-5.9-13.2-13.2s5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2s-5.9 13.2-13.2 13.2z"
        fill="#ECB22E"
      />
    </svg>
  );
}

function TwilioMark() {
  return (
    <svg
      role="img"
      aria-label="Twilio"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      fill="currentColor"
    >
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.7 0 12 0zm0 20.5c-4.7 0-8.5-3.8-8.5-8.5S7.3 3.5 12 3.5s8.5 3.8 8.5 8.5-3.8 8.5-8.5 8.5zm5.3-10.5c0 1.5-1.2 2.7-2.7 2.7s-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7 2.7 1.2 2.7 2.7zm0 4c0 1.5-1.2 2.7-2.7 2.7s-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7 2.7 1.2 2.7 2.7zm-4 0c0 1.5-1.2 2.7-2.7 2.7s-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7 2.7 1.2 2.7 2.7zm0-4c0 1.5-1.2 2.7-2.7 2.7s-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7 2.7 1.2 2.7 2.7z" />
    </svg>
  );
}

// -- Our own and niche-vendor marks ----------------------------------------

function CursiveMark() {
  return (
    <Image
      src="/logos/cursive-logo.png"
      alt="Cursive"
      width={80}
      height={33}
      className="w-full h-full object-contain"
      unoptimized
    />
  );
}

function WebhookMark() {
  return (
    <svg
      role="img"
      aria-label="Custom webhook"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17a3.98 3.98 0 0 1 2.56-3.74" />
      <path d="M6 17a3.98 3.98 0 0 1 .08-7.63 4 4 0 0 1 3.53-4.26" />
      <path d="M22 9a4 4 0 0 1-7.94.59L9 13a4 4 0 1 1-2.12-3.45" />
    </svg>
  );
}

// Polished letter mark for PMS / niche brands where no licensed logo exists.
// Brand color background, two-letter token, subtle depth accent.
function LetterMark({ letters }: { letters: string }) {
  return (
    <svg
      role="img"
      aria-hidden="true"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
    >
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="currentColor"
        fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        fontWeight="700"
        fontSize="11"
        letterSpacing="0"
      >
        {letters}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher: slug → { renderer, brandColor, whiteGlyph }
// `whiteGlyph` means render the SVG mark in white on the brand color tile
// (for marks that are full-color shapes and lose meaning without contrast).
// Otherwise the mark is rendered in the brand color on a neutral card.
// ---------------------------------------------------------------------------

export type BrandLogoEntry = {
  render: () => React.ReactNode;
  brandColor: string;
  // If true, tile background is the brand color and the mark renders in white.
  filledTile: boolean;
};

export const BRAND_LOGOS: Record<string, BrandLogoEntry> = {
  // Simple-icons coverage — rendered in brand hex on neutral tile.
  "google-ads": {
    render: () => <SimpleIconSvg icon={siGoogleads} title="Google Ads" />,
    brandColor: `#${siGoogleads.hex}`,
    filledTile: false,
  },
  ga4: {
    render: () => (
      <SimpleIconSvg icon={siGoogleanalytics} title="Google Analytics 4" />
    ),
    brandColor: `#${siGoogleanalytics.hex}`,
    filledTile: false,
  },
  "meta-ads": {
    render: () => <SimpleIconSvg icon={siMeta} title="Meta" />,
    brandColor: `#${siMeta.hex}`,
    filledTile: false,
  },
  "tiktok-ads": {
    render: () => <SimpleIconSvg icon={siTiktok} title="TikTok" />,
    brandColor: `#${siTiktok.hex}`,
    filledTile: false,
  },
  calendly: {
    render: () => <SimpleIconSvg icon={siCalendly} title="Calendly" />,
    brandColor: `#${siCalendly.hex}`,
    filledTile: false,
  },
  "cal-com": {
    render: () => <SimpleIconSvg icon={siCaldotcom} title="Cal.com" />,
    brandColor: `#${siCaldotcom.hex}`,
    filledTile: false,
  },
  make: {
    render: () => <SimpleIconSvg icon={siMake} title="Make" />,
    brandColor: `#${siMake.hex}`,
    filledTile: false,
  },
  zapier: {
    render: () => <SimpleIconSvg icon={siZapier} title="Zapier" />,
    brandColor: `#${siZapier.hex}`,
    filledTile: false,
  },

  // Hand-written SVG for well-known brands simple-icons no longer ships.
  "linkedin-ads": {
    render: () => <LinkedInMark />,
    brandColor: "#0A66C2",
    filledTile: false,
  },
  slack: {
    render: () => <SlackMark />,
    brandColor: "#4A154B",
    filledTile: false,
  },
  "twilio-sms": {
    render: () => <TwilioMark />,
    brandColor: "#F22F46",
    filledTile: false,
  },

  // Our own modules.
  "visitor-identification": {
    render: () => <CursiveMark />,
    brandColor: "#2F6FE5",
    filledTile: false,
  },
  "custom-webhook": {
    render: () => <WebhookMark />,
    brandColor: "#4B5563",
    filledTile: false,
  },

  // PMS / niche vendors — white letter mark on brand-color tile.
  appfolio: {
    render: () => <LetterMark letters="Af" />,
    brandColor: "#0059A9",
    filledTile: true,
  },
  "yardi-breeze": {
    render: () => <LetterMark letters="Yb" />,
    brandColor: "#00A28F",
    filledTile: true,
  },
  "yardi-voyager": {
    render: () => <LetterMark letters="Yv" />,
    brandColor: "#006547",
    filledTile: true,
  },
  buildium: {
    render: () => <LetterMark letters="Bu" />,
    brandColor: "#007AC1",
    filledTile: true,
  },
  entrata: {
    render: () => <LetterMark letters="En" />,
    brandColor: "#21223B",
    filledTile: true,
  },
  realpage: {
    render: () => <LetterMark letters="Rp" />,
    brandColor: "#0063A6",
    filledTile: true,
  },
};
