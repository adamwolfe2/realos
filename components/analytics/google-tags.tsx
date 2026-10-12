"use client";

import Script from "next/script";

// ---------------------------------------------------------------------------
// Marketing-site tag stack: GTM + GA4.
//
// Architecture:
//   • GTM is the hub for anything an ops person needs to swap without a
//     deploy — Meta Pixel, LinkedIn Insight, floodlights, conversion
//     events, etc. Configured from inside the GTM UI.
//   • GA4 loads directly via gtag.js using the measurement ID below.
//
// Env vars (all optional — production defaults are hardcoded):
//   NEXT_PUBLIC_GTM_ID             — override GTM container
//   NEXT_PUBLIC_GA4_MEASUREMENT_ID — override GA4 measurement ID
// ---------------------------------------------------------------------------

// DECISION: GTM container ID is hardcoded as the production default so the
// tag fires on every page without depending on Vercel env config. Override
// via NEXT_PUBLIC_GTM_ID when you need a per-environment container
// (e.g. a staging container for tag debugging).
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-TXX66PJJ";
// DECISION: GA4 measurement ID hardcoded so it survives env drift.
// Override only for staging properties.
const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "G-Z1RL9YKES8";

export function GoogleTags() {
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
      {GA4_ID && (
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
