// ---------------------------------------------------------------------------
// Email framework barrel. Distribution-domain transactional templates
// (orders, invoices, drops, abandoned carts, tier upgrades) were stripped
// during the hard fork. Real-estate templates (intake confirmation, lead
// capture alert, weekly visitor digest, build status, creative deliverable)
// are rebuilt in Sprint 10 and land alongside this barrel.
// ---------------------------------------------------------------------------

export {
  buildBaseHtml,
  isValidEmail,
  getResend,
  shouldSendEmail,
  FROM_EMAIL,
  APP_URL,
  OPS_NAME,
  BRAND_NAME,
  BRAND_LOCATION,
  BRAND_EMAIL,
  BRAND_COLOR,
} from "./shared";
export type { BaseHtmlOptions, OrderEmailData } from "./shared";
