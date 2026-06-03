"use client";

import Script from "next/script";

// ---------------------------------------------------------------------------
// Marketing-site tag stack: GTM + IDPixel (Cursive) + GA4.
//
// Architecture:
//   • GTM is the hub for anything an ops person needs to swap without a
//     deploy — Meta Pixel, LinkedIn Insight, floodlights, conversion
//     events, etc. Configured from inside the GTM UI.
//   • IDPixel is the LeaseStack marketing-site Cursive pixel. It does two
//     jobs: resolves anonymous visitors to identities (Cursive's product)
//     AND forwards pageviews to GA4 via its `data-ga4-key` attribute. So
//     loading IDPixel with the GA4 key already wires up GA4 — no separate
//     gtag.js install is needed (and adding one would double-count
//     pageviews because both would fire `config`).
//   • Direct GA4 install is now disabled by default and only fires when
//     `NEXT_PUBLIC_GA4_MEASUREMENT_ID` is set AND
//     `NEXT_PUBLIC_DISABLE_IDPIXEL=true`. Use this combo as an emergency
//     fallback if IDPixel ever goes down.
//
// Env vars (all optional — production defaults are hardcoded):
//   NEXT_PUBLIC_GTM_ID             — override GTM container
//   NEXT_PUBLIC_GA4_MEASUREMENT_ID — direct GA4 override (only when IDPixel disabled)
//   NEXT_PUBLIC_DISABLE_IDPIXEL    — set "true" to suppress IDPixel
// ---------------------------------------------------------------------------

// DECISION: GTM container ID is hardcoded as the production default so the
// tag fires on every page without depending on Vercel env config. Override
// via NEXT_PUBLIC_GTM_ID when you need a per-environment container
// (e.g. a staging container for tag debugging).
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-TXX66PJJ";
// DECISION: GA4 measurement ID hardcoded so it survives env drift.
// Forwarded to GA4 via IDPixel's `data-ga4-key` (single source of truth
// for pageview counting). Override only for staging properties.
const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "G-Z1RL9YKES8";
// IDPixel (Cursive) tenant build for leasestack.co. The bundle hash in
// the URL is tenant-specific — issued upstream when the pixel was
// provisioned. Don't change this unless the upstream issues a new build.
const IDPIXEL_SRC =
  "https://cdn.idpixel.app/v1/idp-analytics-6a0eb3eafab915af2e99d344.min.js";
const IDPIXEL_ENABLED = process.env.NEXT_PUBLIC_DISABLE_IDPIXEL !== "true";

export function GoogleTags() {
  // If IDPixel is suppressed and a GA4 ID is configured, fall back to
  // direct gtag.js so analytics still works.
  const directGa4Fallback = !IDPIXEL_ENABLED && GA4_ID;

  return (
    <>
      {GTM_ID && (
        <Script
          id="gtm-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`,
          }}
        />
      )}
      {IDPIXEL_ENABLED && (
        // IDPixel handles visitor identification AND forwards pageviews
        // to GA4 via `data-ga4-key`. `strategy="afterInteractive"` matches
        // the original `defer` semantics on the vendor's reference tag.
        <Script
          id="idpixel-analytics"
          strategy="afterInteractive"
          src={IDPIXEL_SRC}
          data-ga4-key={GA4_ID}
        />
      )}
      {directGa4Fallback && (
        <>
          <Script
            id="ga4-loader"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
          />
          <Script
            id="ga4-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA4_ID}',{send_page_view:true});`,
            }}
          />
        </>
      )}
    </>
  );
}

// GTM <noscript> fallback. Mount this as the FIRST child of <body> per
// Google's official install guide so non-JS visitors still report.
export function GoogleTagManagerNoScript() {
  if (!GTM_ID) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
