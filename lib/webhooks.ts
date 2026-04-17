// DECISION: Outbound tenant webhooks (WebhookEndpoint + WebhookLog) are not in
// the real-estate schema. This file used to dispatch distribution-domain
// events (order.created, invoice.created, payment.received) to third-party
// subscribers. Those events no longer exist.
// TODO(v2): if clients request tenant-scoped outbound webhooks for leads,
// visitors, or application events, reintroduce the endpoint/log models and
// restore dispatch. Until then this module is a safe no-op.

import crypto from "crypto";

export type WebhookEvent =
  | "lead.created"
  | "visitor.identified"
  | "tour.scheduled"
  | "application.submitted";

export async function dispatchWebhook(
  _event: WebhookEvent,
  _payload: Record<string, unknown>
) {
  // no-op
}

export async function deliverWebhook(
  _endpointId: string,
  _url: string,
  _secret: string,
  _event: string,
  _body: string,
  _attempt: number
) {
  // no-op. Preserved to satisfy imports.
  void crypto;
}
