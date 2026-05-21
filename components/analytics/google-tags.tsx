"use client";

import Script from "next/script";

// ---------------------------------------------------------------------------
// Google Tag Manager + GA4 loader.
//
// Architecture: GTM is the single hub. We load it once in <head>, mount its
// <noscript> fallback at the top of <body>, and from inside GTM's UI you
// can fire GA4, the Cursive pixel, Meta Pixel, LinkedIn Insight Tag,
// floodlights, etc. — without ever re-deploying the site.
//
// We ALSO support a direct GA4 install via `NEXT_PUBLIC_GA4_MEASUREMENT_ID`
// for cases where you want GA4 firing before GTM is finished being
// configured (or you want a fallback if GTM is blocked by an ad blocker).
// Pick one; if both are set, both fire — GA4 dedupes by client_id.
//
// Env vars (configure in Vercel):
//   NEXT_PUBLIC_GTM_ID            — e.g. "GTM-XXXXXXX"
//   NEXT_PUBLIC_GA4_MEASUREMENT_ID — e.g. "G-XXXXXXXXXX"
//
// Cursive pixel via GTM:
//   1. In GTM → Tags → New → Custom HTML
//   2. Paste the Cursive pixel <script> snippet from the Cursive dashboard
//   3. Trigger: All Pages
//   4. Publish.
// This avoids hard-coding the pixel in the app and lets ops swap pixels
// without a deploy.
// ---------------------------------------------------------------------------

// DECISION: GTM container ID is hardcoded as the production default so the
// tag fires on every page without depending on Vercel env config. Override
// via NEXT_PUBLIC_GTM_ID when you need a per-environment container
// (e.g. a staging container for tag debugging).
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-TXX66PJJ";
// DECISION: GA4 measurement ID is hardcoded as the production default for
// the same reason as GTM — the tag must fire on every page without
// depending on Vercel env config. Override via NEXT_PUBLIC_GA4_MEASUREMENT_ID
// for a per-environment property. GA4 dedupes by client_id even when GTM
// also fires it, so running both is safe.
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
