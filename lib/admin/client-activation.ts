import "server-only";

import {
  LeadNotifyStatus,
  LeadNotifyChannel,
  OrgType,
  PopupStatus,
  Prisma,
  PropertyLifecycle,
  ReputationScanStatus,
  SeoProvider,
  SeoSyncStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { PRODUCT_REGISTRY } from "@/lib/products/registry";
import { PRODUCT_CAPABILITY_CONTRACTS } from "@/lib/products/capabilities/contracts";
import { evaluateCapabilityProfile } from "@/lib/products/capabilities/evaluate";
import type {
  CapabilityEvidenceKind,
  CapabilityProfile,
  CapabilityProfileStatus,
  CapabilitySignal,
  CapabilitySignalKey,
  CapabilitySignalState,
  CapabilitySubject,
  ProductCapabilityKey,
} from "@/lib/products/capabilities/types";

export type ClientActivationAccess =
  | "included"
  | "enabled"
  | "not_enabled"
  | "concierge";

export type ClientActivationRow = Readonly<{
  key: string;
  name: string;
  promise: string;
  access: ClientActivationAccess;
  status: CapabilityProfileStatus;
  coverage: Readonly<{ ready: number; total: number; label: string }>;
  proof: string;
  blockers: readonly string[];
  action: Readonly<{ label: string; href: string }>;
}>;

export type ClientActivationView = Readonly<{
  client: Readonly<{ id: string; name: string; propertyCount: number }>;
  rows: readonly ClientActivationRow[];
}>;

export class ClientActivationScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientActivationScopeError";
  }
}

const PRODUCT_KEYS: readonly ProductCapabilityKey[] = [
  "connected-data-foundation",
  "lead-to-lease-attribution",
  "ai-leasing-chatbot",
  "conversion-offers",
  "reputation-rescue",
  "search-opportunity-engine",
  "monday-action-brief",
  "website-build",
];

const PROFILE_STATUS_PRIORITY: readonly CapabilityProfileStatus[] = [
  "needs_attention",
  "backfilling",
  "verifying",
  "partially_ready",
  "disconnected",
  "ready",
];

export async function loadClientActivation(
  orgId: string,
  now: Date,
): Promise<ClientActivationView | null> {
  const snapshot = await prisma.organization.findFirst({
    where: { id: orgId, orgType: OrgType.CLIENT },
    select: {
      id: true,
      name: true,
      orgType: true,
      moduleAttribution: true,
      moduleChatbot: true,
      moduleConversations: true,
      modulePopups: true,
      moduleReputation: true,
      moduleSEO: true,
      moduleMarketIntelligence: true,
      moduleInsights: true,
      notifyLeadEmail: true,
      reportRecipients: true,
      properties: {
        where: { orgId, lifecycle: PropertyLifecycle.ACTIVE },
        select: {
          id: true,
          orgId: true,
          updatedAt: true,
          backendPlatform: true,
          lastSyncedAt: true,
          syncError: true,
          googlePlaceId: true,
          yelpBusinessId: true,
          notifyLeadEmailOverride: true,
          chatbotConfig: {
            select: {
              orgId: true,
              propertyId: true,
              chatbotEnabled: true,
              chatbotKnowledgeBase: true,
              updatedAt: true,
            },
          },
          chatbotConversations: {
            where: { orgId, leadId: { not: null } },
            orderBy: { lastMessageAt: "desc" },
            take: 1,
            select: {
              orgId: true,
              propertyId: true,
              leadId: true,
              lastMessageAt: true,
            },
          },
          cursiveIntegrations: {
            where: { orgId },
            select: {
              orgId: true,
              propertyId: true,
              lastPixelHitAt: true,
            },
          },
          seoIntegrations: {
            where: { orgId },
            select: {
              orgId: true,
              propertyId: true,
              provider: true,
              status: true,
              lastSyncAt: true,
              lastSyncError: true,
              updatedAt: true,
            },
          },
          seoSnapshots: {
            where: { orgId },
            orderBy: { date: "desc" },
            take: 1,
            select: { orgId: true, propertyId: true, date: true },
          },
          leads: {
            where: { orgId },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              orgId: true,
              propertyId: true,
              visitorId: true,
              convertedAt: true,
              createdAt: true,
            },
          },
          popupCampaigns: {
            where: { orgId, status: PopupStatus.ACTIVE },
            select: {
              orgId: true,
              propertyId: true,
              shownCount: true,
              convertedCount: true,
              updatedAt: true,
            },
          },
          reputationScans: {
            where: { orgId },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              orgId: true,
              propertyId: true,
              status: true,
              completedAt: true,
            },
          },
          seoActionRecs: {
            where: { orgId },
            orderBy: { generatedAt: "desc" },
            take: 1,
            select: { orgId: true, propertyId: true, generatedAt: true },
          },
          websiteBuildRequests: {
            where: { orgId },
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: {
              orgId: true,
              propertyId: true,
              status: true,
              launchedAt: true,
              updatedAt: true,
            },
          },
        },
      },
      clientReports: {
        where: { orgId, propertyId: null },
        orderBy: { generatedAt: "desc" },
        take: 1,
        select: {
          orgId: true,
          generatedAt: true,
          sharedAt: true,
          lastViewedAt: true,
        },
      },
    },
  });

  if (!snapshot) return null;
  if (snapshot.id !== orgId || snapshot.orgType !== OrgType.CLIENT) {
    throw new ClientActivationScopeError("Client organization not found.");
  }
  assertSnapshotScope(snapshot, orgId);
  const capturedLeadIds = snapshot.properties.flatMap((property) =>
    property.chatbotConversations.flatMap(({ leadId }) =>
      leadId ? [leadId] : [],
    ),
  );
  const notificationDeliveries = await prisma.leadNotificationDelivery.findMany({
    where: {
      orgId,
      propertyId: { in: snapshot.properties.map(({ id }) => id) },
      leadId: { in: capturedLeadIds },
      channel: LeadNotifyChannel.CHATBOT,
      status: LeadNotifyStatus.SENT,
      sentAt: { not: null },
    },
    orderBy: { sentAt: "desc" },
    distinct: ["propertyId", "leadId"],
    select: { propertyId: true, leadId: true, sentAt: true },
  });
  const notificationByLead = new Map<string, Date>();
  for (const delivery of notificationDeliveries) {
    if (
      !delivery.propertyId ||
      !delivery.leadId ||
      !snapshot.properties.some(({ id }) => id === delivery.propertyId) ||
      !capturedLeadIds.includes(delivery.leadId)
    ) {
      throw scopeError();
    }
    if (delivery.sentAt) {
      notificationByLead.set(
        notificationKey(delivery.propertyId, delivery.leadId),
        delivery.sentAt,
      );
    }
  }

  const rows = PRODUCT_KEYS.map((key) =>
    buildProductRow(key, snapshot, notificationByLead, orgId, now),
  );
  return Object.freeze({
    client: Object.freeze({
      id: snapshot.id,
      name: snapshot.name,
      propertyCount: snapshot.properties.length,
    }),
    rows: Object.freeze(rows),
  });
}

type ActivationSnapshot = Prisma.OrganizationGetPayload<{
  select: {
      id: true,
      name: true,
      orgType: true,
      moduleAttribution: true,
      moduleChatbot: true,
      moduleConversations: true,
      modulePopups: true,
      moduleReputation: true,
      moduleSEO: true,
      moduleMarketIntelligence: true,
      moduleInsights: true,
      notifyLeadEmail: true,
      reportRecipients: true,
      properties: {
        select: {
          id: true,
          orgId: true,
          updatedAt: true,
          backendPlatform: true,
          lastSyncedAt: true,
          syncError: true,
          googlePlaceId: true,
          yelpBusinessId: true,
          notifyLeadEmailOverride: true,
          chatbotConfig: { select: { orgId: true, propertyId: true, chatbotEnabled: true, chatbotKnowledgeBase: true, updatedAt: true } },
          chatbotConversations: { select: { orgId: true, propertyId: true, leadId: true, lastMessageAt: true } },
          cursiveIntegrations: { select: { orgId: true, propertyId: true, lastPixelHitAt: true } },
          seoIntegrations: { select: { orgId: true, propertyId: true, provider: true, status: true, lastSyncAt: true, lastSyncError: true, updatedAt: true } },
          seoSnapshots: { select: { orgId: true, propertyId: true, date: true } },
          leads: { select: { orgId: true, propertyId: true, visitorId: true, convertedAt: true, createdAt: true } },
          popupCampaigns: { select: { orgId: true, propertyId: true, shownCount: true, convertedCount: true, updatedAt: true } },
          reputationScans: { select: { orgId: true, propertyId: true, status: true, completedAt: true } },
          seoActionRecs: { select: { orgId: true, propertyId: true, generatedAt: true } },
          websiteBuildRequests: { select: { orgId: true, propertyId: true, status: true, launchedAt: true, updatedAt: true } },
        },
      },
      clientReports: { select: { orgId: true, generatedAt: true, sharedAt: true, lastViewedAt: true } },
  };
}>;

type PropertySnapshot = ActivationSnapshot["properties"][number];

function buildProductRow(
  key: ProductCapabilityKey,
  snapshot: ActivationSnapshot,
  notificationByLead: ReadonlyMap<string, Date>,
  orgId: string,
  now: Date,
): ClientActivationRow {
  const definition = PRODUCT_REGISTRY.find((product) => product.key === key);
  if (!definition) throw new Error(`Missing canonical product definition: ${key}`);
  const profiles = buildProfiles(key, snapshot, notificationByLead, orgId, now);
  const status = aggregateStatus(profiles);
  const ready = profiles.filter((profile) => profile.status === "ready").length;
  const total = profiles.length;
  const blockers = unique(
    profiles.flatMap((profile) => profile.blockers.map(({ summary }) => summary)),
  );
  const proofItems = unique(
    profiles.flatMap((profile) => profile.evidence.map(({ summary }) => summary)),
  );
  const actionHref = firstActionHref(profiles) ?? defaultActionHref(key);

  return Object.freeze({
    key,
    name: definition.name,
    promise: definition.promise,
    access: resolveAccess(key, snapshot),
    status,
    coverage: Object.freeze({
      ready,
      total,
      label: coverageLabel(ready, total, key === "monday-action-brief"),
    }),
    proof:
      proofItems.length > 0
        ? proofItems.join(" ")
        : "No activation proof recorded.",
    blockers: Object.freeze(blockers),
    action: Object.freeze(normalizeAction(actionHref, orgId)),
  });
}

function buildProfiles(
  key: ProductCapabilityKey,
  snapshot: ActivationSnapshot,
  notificationByLead: ReadonlyMap<string, Date>,
  orgId: string,
  now: Date,
): CapabilityProfile[] {
  const contract = PRODUCT_CAPABILITY_CONTRACTS[key];
  if (key === "monday-action-brief") {
    const subject: CapabilitySubject = { scope: "organization", orgId };
    return [
      evaluateCapabilityProfile(
        contract,
        subject,
        organizationSignals(snapshot, subject),
        now,
      ),
    ];
  }
  return snapshot.properties.map((property) => {
    const subject: CapabilitySubject = {
      scope: "property",
      orgId,
      propertyId: property.id,
    };
    return evaluateCapabilityProfile(
      contract,
      subject,
      propertySignals(key, snapshot, property, notificationByLead, subject),
      now,
    );
  });
}

function propertySignals(
  key: ProductCapabilityKey,
  snapshot: ActivationSnapshot,
  property: PropertySnapshot,
  notificationByLead: ReadonlyMap<string, Date>,
  subject: CapabilitySubject,
): CapabilitySignal[] {
  const signals: CapabilitySignal[] = [
    signal("scope.verified", subject, "ready", "configuration", property.updatedAt),
  ];
  if (key === "connected-data-foundation") addFoundationSignals(signals, property, subject);
  if (key === "lead-to-lease-attribution") addAttributionSignals(signals, property, subject);
  if (key === "ai-leasing-chatbot") addChatbotSignals(signals, snapshot, property, notificationByLead, subject);
  if (key === "conversion-offers") addOfferSignals(signals, property, subject);
  if (key === "reputation-rescue") addReputationSignals(signals, property, subject);
  if (key === "search-opportunity-engine") addSearchSignals(signals, property, subject);
  if (key === "website-build") addWebsiteSignals(signals, property, subject);
  return signals;
}

function addFoundationSignals(
  signals: CapabilitySignal[],
  property: PropertySnapshot,
  subject: CapabilitySubject,
): void {
  if (property.syncError) {
    signals.push(
      signal(
        "integration.any_source",
        subject,
        "error",
        "sync",
        property.lastSyncedAt ?? property.updatedAt,
      ),
    );
  } else if (property.lastSyncedAt) {
    signals.push(
      signal("integration.any_source", subject, "ready", "sync", property.lastSyncedAt),
    );
  }
  for (const { lastPixelHitAt } of property.cursiveIntegrations) {
    if (lastPixelHitAt) {
      signals.push(
        signal("integration.any_source", subject, "ready", "sync", lastPixelHitAt),
      );
    }
  }
  for (const integration of property.seoIntegrations) {
    const observedAt = integration.lastSyncAt ?? integration.updatedAt;
    const state: CapabilitySignalState =
      integration.status === SeoSyncStatus.ERROR || integration.lastSyncError
        ? "error"
        : integration.status === SeoSyncStatus.SYNCING
          ? "verifying"
          : integration.lastSyncAt
            ? "ready"
            : "disconnected";
    signals.push(
      signal("integration.any_source", subject, state, "sync", observedAt),
    );
  }
  const recordAt = freshestDate([
    ...property.leads.map(({ createdAt }) => createdAt),
    ...property.seoSnapshots.map(({ date }) => date),
    ...property.chatbotConversations.map(({ lastMessageAt }) => lastMessageAt),
  ]);
  if (recordAt) signals.push(signal("outcome.fresh_scoped_record", subject, "ready", "record", recordAt));
}

function addAttributionSignals(
  signals: CapabilitySignal[],
  property: PropertySnapshot,
  subject: CapabilitySubject,
): void {
  const lead = property.leads[0];
  if (lead) signals.push(signal("integration.lead_source", subject, "ready", "record", lead.createdAt));
  const outcome = property.leads.find(({ convertedAt }) => convertedAt != null);
  if (outcome?.convertedAt) {
    signals.push(signal("integration.downstream_outcome", subject, "ready", "record", outcome.convertedAt));
    if (outcome.visitorId) {
      signals.push(signal("outcome.attributed_journey", subject, "ready", "outcome", outcome.convertedAt));
    }
  }
}

function addChatbotSignals(
  signals: CapabilitySignal[],
  snapshot: ActivationSnapshot,
  property: PropertySnapshot,
  notificationByLead: ReadonlyMap<string, Date>,
  subject: CapabilitySubject,
): void {
  const config = property.chatbotConfig;
  if (config?.chatbotEnabled && config.chatbotKnowledgeBase?.trim()) {
    signals.push(signal("setup.chatbot_configured", subject, "ready", "configuration", config.updatedAt));
  }
  if (property.notifyLeadEmailOverride || snapshot.notifyLeadEmail) {
    signals.push(signal("setup.notification_recipient", subject, "ready", "configuration", property.updatedAt));
  }
  const conversation = property.chatbotConversations.find(({ leadId }) => leadId != null);
  if (!conversation?.leadId) return;
  signals.push(signal("outcome.chatbot_conversation", subject, "ready", "outcome", conversation.lastMessageAt));
  signals.push(signal("outcome.chatbot_lead", subject, "ready", "outcome", conversation.lastMessageAt));
  const deliveredAt = notificationByLead.get(
    notificationKey(property.id, conversation.leadId),
  );
  if (deliveredAt) {
    signals.push(signal("outcome.notification_delivered", subject, "ready", "outcome", deliveredAt));
  }
}

function addOfferSignals(
  signals: CapabilitySignal[],
  property: PropertySnapshot,
  subject: CapabilitySubject,
): void {
  const campaign = property.popupCampaigns[0];
  if (!campaign) return;
  signals.push(signal("setup.offer_published", subject, "ready", "configuration", campaign.updatedAt));
  if (campaign.shownCount > 0) signals.push(signal("outcome.offer_impression", subject, "ready", "outcome", campaign.updatedAt));
  if (campaign.convertedCount > 0) signals.push(signal("outcome.offer_conversion", subject, "ready", "outcome", campaign.updatedAt));
}

function addReputationSignals(
  signals: CapabilitySignal[],
  property: PropertySnapshot,
  subject: CapabilitySubject,
): void {
  if (property.googlePlaceId || property.yelpBusinessId) {
    signals.push(signal("integration.reputation_source", subject, "ready", "connection", property.updatedAt));
    signals.push(signal("setup.reputation_identity", subject, "ready", "configuration", property.updatedAt));
  }
  const scan = property.reputationScans.find(
    ({ completedAt }) => completedAt,
  );
  if (scan?.completedAt) {
    const state: CapabilitySignalState =
      scan.status === ReputationScanStatus.FAILED
        ? "error"
        : scan.status === ReputationScanStatus.PARTIAL
          ? "partial"
          : scan.status === ReputationScanStatus.RUNNING
            ? "verifying"
            : "ready";
    signals.push(
      signal("outcome.reputation_baseline", subject, state, "outcome", scan.completedAt),
    );
  }
}

function addSearchSignals(
  signals: CapabilitySignal[],
  property: PropertySnapshot,
  subject: CapabilitySubject,
): void {
  for (const integration of property.seoIntegrations) {
    const key = integration.provider === SeoProvider.GA4 ? "integration.ga4" : "integration.gsc";
    const state: CapabilitySignalState =
      integration.status === SeoSyncStatus.ERROR || integration.lastSyncError
        ? "error"
        : integration.status === SeoSyncStatus.SYNCING
          ? "verifying"
          : integration.lastSyncAt
            ? "ready"
            : "disconnected";
    signals.push(
      signal(
        key,
        subject,
        state,
        "sync",
        integration.lastSyncAt ?? integration.updatedAt,
      ),
    );
  }
  const baseline = property.seoSnapshots[0];
  if (baseline) signals.push(signal("outcome.search_baseline", subject, "ready", "outcome", baseline.date));
  const opportunity = property.seoActionRecs[0];
  if (opportunity) signals.push(signal("outcome.search_opportunity", subject, "ready", "outcome", opportunity.generatedAt));
}

function addWebsiteSignals(
  signals: CapabilitySignal[],
  property: PropertySnapshot,
  subject: CapabilitySubject,
): void {
  const request = property.websiteBuildRequests[0];
  if (!request || request.status === "cancelled") return;
  signals.push(signal("setup.website_scope_approved", subject, "ready", "configuration", request.updatedAt));
  if (request.launchedAt) signals.push(signal("outcome.website_live", subject, "ready", "outcome", request.launchedAt));
  // DomainBinding is organization-scoped in the current schema. It cannot
  // prove exact property ownership, so no verified-domain signal is emitted.
}

function organizationSignals(
  snapshot: ActivationSnapshot,
  subject: CapabilitySubject,
): CapabilitySignal[] {
  const signals: CapabilitySignal[] = [];
  if (snapshot.reportRecipients.length > 0) {
    signals.push(signal("setup.brief_recipient", subject, "ready", "configuration", snapshot.properties[0]?.updatedAt ?? new Date(0)));
  }
  const sourceAt = freshestDate(
    snapshot.properties.flatMap((property) => [
      property.lastSyncedAt,
      ...property.cursiveIntegrations.map(({ lastPixelHitAt }) => lastPixelHitAt),
      ...property.seoIntegrations.map(({ lastSyncAt }) => lastSyncAt),
    ]),
  );
  if (sourceAt) signals.push(signal("integration.any_source", subject, "ready", "sync", sourceAt));
  // ClientReport is a generic weekly/monthly/custom report record and does not
  // prove that a scheduled Monday brief contained valid action links. Keep the
  // product unproven until a dedicated, durable brief-delivery record exists.
  return signals;
}

function signal(
  key: CapabilitySignalKey,
  subject: CapabilitySubject,
  state: CapabilitySignalState,
  kind: CapabilityEvidenceKind,
  observedAt: Date,
): CapabilitySignal {
  return Object.freeze({
    key,
    subject,
    state,
    evidence: Object.freeze([Object.freeze({ kind, observedAt })]),
  });
}

function assertSnapshotScope(snapshot: ActivationSnapshot, orgId: string): void {
  for (const property of snapshot.properties) {
    if (property.orgId !== orgId) throw scopeError();
    const records = [
      ...(property.chatbotConfig ? [property.chatbotConfig] : []),
      ...property.chatbotConversations,
      ...property.cursiveIntegrations,
      ...property.seoIntegrations,
      ...property.seoSnapshots,
      ...property.leads,
      ...property.popupCampaigns,
      ...property.reputationScans,
      ...property.seoActionRecs,
      ...property.websiteBuildRequests,
    ];
    for (const record of records) {
      if (record.orgId !== orgId || record.propertyId !== property.id) throw scopeError();
    }
  }
  for (const report of snapshot.clientReports) {
    if (report.orgId !== orgId) throw scopeError();
  }
}

function scopeError(): ClientActivationScopeError {
  return new ClientActivationScopeError("Activation evidence is outside the requested client scope.");
}

function aggregateStatus(profiles: readonly CapabilityProfile[]): CapabilityProfileStatus {
  if (profiles.length === 0) return "disconnected";
  if (profiles.every(({ status }) => status === "ready")) return "ready";
  if (profiles.some(({ status }) => status === "needs_attention")) {
    return "needs_attention";
  }
  if (profiles.some(({ status }) => status === "ready")) return "partially_ready";
  return [...profiles]
    .map(({ status }) => status)
    .sort(
      (a, b) =>
        PROFILE_STATUS_PRIORITY.indexOf(a) - PROFILE_STATUS_PRIORITY.indexOf(b),
    )[0];
}

function resolveAccess(
  key: ProductCapabilityKey,
  snapshot: ActivationSnapshot,
): ClientActivationAccess {
  if (key === "connected-data-foundation") return "included";
  if (key === "website-build") return "concierge";
  const enabled =
    (key === "lead-to-lease-attribution" && snapshot.moduleAttribution) ||
    (key === "ai-leasing-chatbot" && snapshot.moduleChatbot) ||
    (key === "conversion-offers" && snapshot.modulePopups) ||
    (key === "reputation-rescue" && snapshot.moduleReputation) ||
    (key === "search-opportunity-engine" &&
      (snapshot.moduleSEO || snapshot.moduleMarketIntelligence)) ||
    (key === "monday-action-brief" && snapshot.moduleInsights);
  return enabled ? "enabled" : "not_enabled";
}

function coverageLabel(ready: number, total: number, organization: boolean): string {
  if (organization) return ready === 1 ? "Organization ready" : "Organization not ready";
  return `${ready} of ${total} ${total === 1 ? "property" : "properties"} ready`;
}

function firstActionHref(profiles: readonly CapabilityProfile[]): string | null {
  for (const profile of profiles) {
    const href = profile.blockers[0]?.actionHref;
    if (href) return href;
  }
  return null;
}

function defaultActionHref(key: ProductCapabilityKey): string {
  if (key === "website-build") return "/admin/website-builds";
  if (key === "connected-data-foundation" || key === "lead-to-lease-attribution") {
    return "/portal/integrations";
  }
  return "/portal/settings";
}

function normalizeAction(
  contractHref: string,
  orgId: string,
): { label: string; href: string } {
  if (contractHref.startsWith("/admin/website-builds")) {
    return { label: "Open website builds", href: "/admin/website-builds" };
  }
  if (contractHref.includes("integration")) {
    return {
      label: "Review integrations",
      href: `/admin/clients/${orgId}?tab=integrations`,
    };
  }
  if (contractHref === "/admin/clients") {
    return {
      label: "Review properties",
      href: `/admin/clients/${orgId}?tab=properties`,
    };
  }
  return {
    label: "Review modules",
    href: `/admin/clients/${orgId}?tab=modules`,
  };
}

function freshestDate(values: readonly (Date | null)[]): Date | null {
  const actual = values.filter((value): value is Date => value instanceof Date);
  if (actual.length === 0) return null;
  return new Date(Math.max(...actual.map((value) => value.getTime())));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function notificationKey(propertyId: string, leadId: string): string {
  return `${propertyId}:${leadId}`;
}
