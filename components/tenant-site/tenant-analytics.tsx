import Script from "next/script";

// Server component. Injects the tenant's own GA4 measurement tag and (if
// stored in TenantSiteConfig.customJson.gtmContainerId) Google Tag Manager.
//
// Why both: when GTM is present, GA4 typically routes through it — pageviews,
// chatbot_opened, apply_clicked, tour_scheduled, chatbot_lead_captured all
// land in dataLayer and GTM forwards them to GA4 + any other destinations
// the tenant wires up. When GTM is absent, we fall back to loading gtag.js
// directly with the GA4 measurement ID so the same events still land in GA4.
//
// Bring-your-own-site mode: this component is NOT rendered (the tenant
// installs GA4/GTM themselves on their own site). The chatbot widget still
// pushes to window.dataLayer, so it picks up whatever they've already wired.

const GA4_RE = /^G-[A-Z0-9]+$/i;
const GTM_RE = /^GTM-[A-Z0-9]+$/i;

export function TenantAnalytics({
  ga4MeasurementId,
  gtmContainerId,
}: {
  ga4MeasurementId: string | null;
  gtmContainerId: string | null;
}) {
  const ga4 = ga4MeasurementId && GA4_RE.test(ga4MeasurementId)
    ? ga4MeasurementId
    : null;
  const gtm = gtmContainerId && GTM_RE.test(gtmContainerId)
    ? gtmContainerId
    : null;

  if (!ga4 && !gtm) return null;

  return (
    <>
      {gtm ? (
        <>
          <Script id="gtm-init" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}
          </Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtm}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        </>
      ) : null}

      {ga4 && !gtm ? (
        <>
          <Script
            id="ga4-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4}');`}
          </Script>
        </>
      ) : null}
    </>
  );
}

// Helper to safely read the GTM container id out of TenantSiteConfig.customJson.
// Returns null when missing or shaped incorrectly. Keeps callers from having
// to know about the JSON shape.
export function readGtmContainerId(customJson: unknown): string | null {
  if (!customJson || typeof customJson !== "object") return null;
  const v = (customJson as Record<string, unknown>).gtmContainerId;
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
