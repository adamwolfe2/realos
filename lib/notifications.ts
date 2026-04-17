// DECISION: In-app notification models (Notification) were not carried into the
// real-estate schema. Placeholder stubs keep the import surface stable for any
// remaining callers; Sprint 04 decides whether to reintroduce a Notification
// model for the master admin or route alerts entirely through Resend + Slack.
// TODO(Sprint 04): replace stubs with real notification fan-out if the admin
// needs persisted in-app alerts.

export type NotificationType =
  | "LEAD_CAPTURED"
  | "TOUR_REQUESTED"
  | "APPLICATION_SUBMITTED"
  | "CREATIVE_REQUESTED"
  | "BILLING_DUE"
  | "INTEGRATION_ERROR";

export async function createNotification(
  _userId: string,
  _type: NotificationType,
  _title: string,
  _message: string,
  _link?: string
) {
  // no-op until notification model is reintroduced
  return null;
}

export async function notifyOrg(
  _orgId: string,
  _type: NotificationType,
  _title: string,
  _message: string,
  _link?: string
) {
  // no-op until notification model is reintroduced
  return null;
}
