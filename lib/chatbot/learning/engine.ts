export type StoredChatbotMessage = {
  role?: string;
  content?: string;
  timestamp?: string;
  ts?: string;
};

export type LearningLead = {
  id: string;
  status: string;
  source: string;
  intent: string | null;
  firstName: string | null;
  email: string | null;
  phone: string | null;
  lastActivityAt: Date;
  lastEmailSentAt: Date | null;
  emailsSent: number;
  tours: Array<{ id: string }>;
  applications: Array<{ id: string }>;
  residents: Array<{ id: string }>;
};

export type LearningProperty = {
  id: string;
  name: string;
  websiteUrl: string | null;
  virtualTourUrl: string | null;
  notifyLeadEmailOverride: string | null;
  chatbotConfig: {
    primaryCtaText: string | null;
    primaryCtaUrl: string | null;
    phoneNumber: string | null;
    contactEmail: string | null;
  } | null;
};

export type LearningConversation = {
  id: string;
  orgId: string;
  propertyId: string | null;
  leadId: string | null;
  capturedEmail: string | null;
  capturedPhone: string | null;
  messageCount: number;
  lastMessageAt: Date;
  messages: unknown;
  prospectProfile: unknown;
  lead: LearningLead | null;
  property: LearningProperty | null;
};

export type LearningCasePlan = {
  dedupeKey: string;
  caseType:
    | "STALLED_LEAD"
    | "UNCAPTURED_ENGAGED_CONVERSATION"
    | "TOUR_INTENT_NO_TOUR"
    | "PRICING_QUESTION_NO_CAPTURE"
    | "AVAILABILITY_QUESTION_NO_CAPTURE"
    | "APPLICATION_HELP_NEEDED"
    | "BOT_FALLBACK_PATTERN";
  propertyId: string | null;
  conversationId: string | null;
  leadId: string | null;
  confidence: number;
  reasonSummary: string;
  evidence: Record<string, unknown>;
  outcomeSnapshot: Record<string, unknown>;
};

export type FollowUpTaskPlan = {
  dedupeKey: string;
  caseDedupeKey: string;
  propertyId: string | null;
  conversationId: string | null;
  leadId: string | null;
  taskType:
    | "SEND_AVAILABILITY_PRICING"
    | "INVITE_TO_TOUR"
    | "APPLICATION_HELP"
    | "GENERAL_FOLLOW_UP"
    | "CONFIRM_ROOM_TYPE"
    | "CONFIRM_MOVE_IN";
  priority: number;
  recommendedChannel: "EMAIL" | "SMS" | "CALL" | "INTERNAL_NOTE";
  dueAt: Date | null;
  reasonSummary: string;
  draft: DraftPlan;
};

export type DraftPlan = {
  channel: "EMAIL" | "SMS" | "CALL" | "INTERNAL_NOTE";
  subject: string | null;
  body: string;
  generatedFrom: Record<string, unknown>;
  complianceWarnings: string[];
};

export type KnowledgeSuggestionPlan = {
  dedupeKey: string;
  propertyId: string | null;
  patternType: string;
  affectedCount: number;
  suggestedText: string;
  sourceCaseDedupeKeys: string[];
};

export type ConversationInsightPlan = {
  dedupeKey: string;
  propertyId: string | null;
  insightType:
    | "OBJECTION"
    | "MISSING_ANSWER"
    | "PRICING_CONFUSION"
    | "AVAILABILITY_CONFUSION"
    | "TOUR_FRICTION"
    | "APPLICATION_FRICTION"
    | "POLICY_QUESTION"
    | "SITE_CONTENT_GAP"
    | "WEAK_CTA"
    | "HIGH_CONVERTING_PATTERN";
  title: string;
  summary: string;
  affectedCount: number;
  impactScore: number;
  evidence: Record<string, unknown>;
  recommendation: Record<string, unknown>;
  sourceCaseDedupeKeys: string[];
};

export type SiteImprovementPlan = {
  dedupeKey: string;
  insightDedupeKey: string;
  propertyId: string | null;
  recommendationType:
    | "FAQ"
    | "PRICING_COPY"
    | "AVAILABILITY_COPY"
    | "TOUR_CTA"
    | "APPLICATION_COPY"
    | "POLICY_COPY";
  targetSurface:
    | "TENANT_SITE"
    | "CHATBOT_KNOWLEDGE_BASE"
    | "SITE_BUILDER"
    | "CONTENT_WORKFLOW";
  suggestedTitle: string;
  suggestedBody: string;
};

export type LearningRunPlan = {
  cases: LearningCasePlan[];
  tasks: FollowUpTaskPlan[];
  knowledgeSuggestions: KnowledgeSuggestionPlan[];
  conversationInsights: ConversationInsightPlan[];
  siteRecommendations: SiteImprovementPlan[];
};

type Topic =
  | "pricing"
  | "availability"
  | "tour"
  | "application"
  | "policy"
  | "move_in"
  | "location"
  | "other";

type FollowUpIntent =
  | "availability_pricing"
  | "tour"
  | "application"
  | "general"
  | "room_type"
  | "move_in"
  | null;

const DAY_MS = 24 * 60 * 60 * 1000;

export function createLearningRunPlan(
  conversations: LearningConversation[],
  now = new Date(),
): LearningRunPlan {
  const cases = new Map<string, LearningCasePlan>();
  const tasks = new Map<string, FollowUpTaskPlan>();
  const weakCtaCases: LearningCasePlan[] = [];
  const uncapturedCases: LearningCasePlan[] = [];
  const topicCounts = new Map<Topic, number>();
  const topicDropoffs = new Map<Topic, number>();
  const signedTopics = new Map<Topic, number>();

  for (const conversation of conversations) {
    const messages = normalizeMessages(conversation.messages);
    const userText = messagesToText(messages, "user");
    const assistantText = messagesToText(messages, "assistant");
    const firstTopic = classifyTopic(firstUserMessage(messages) ?? userText);
    const profile = normalizeProfile(conversation.prospectProfile);
    const followUpIntent = classifyFollowUpIntent(profile, userText);
    const captured = hasCapturedContact(conversation);
    const lead = conversation.lead;
    const hasContact = hasReachableContact(conversation);
    const hasAppliedOrSigned =
      !!lead &&
      (lead.status === "APPLIED" ||
        lead.status === "APPROVED" ||
        lead.status === "SIGNED" ||
        lead.applications.length > 0 ||
        lead.residents.length > 0);
    const isSigned =
      !!lead && (lead.status === "SIGNED" || lead.residents.length > 0);
    const isEngaged = conversation.messageCount >= 3;
    const isMidDepth = conversation.messageCount >= 3 && conversation.messageCount <= 6;
    const punted = hasHumanContactPunt(assistantText);

    topicCounts.set(firstTopic, (topicCounts.get(firstTopic) ?? 0) + 1);
    if (!captured) topicDropoffs.set(firstTopic, (topicDropoffs.get(firstTopic) ?? 0) + 1);
    if (isSigned) signedTopics.set(firstTopic, (signedTopics.get(firstTopic) ?? 0) + 1);

    if (
      lead?.source === "CHATBOT" &&
      lead.status === "NEW" &&
      isWarmLead(lead, profile) &&
      now.getTime() - lead.lastActivityAt.getTime() >= DAY_MS &&
      (lead.emailsSent ?? 0) === 0 &&
      !lead.lastEmailSentAt
    ) {
      const taskType = followUpTaskFromIntent(followUpIntent);
      const casePlan = buildCase(conversation, {
        caseType: "STALLED_LEAD",
        dedupeKey: `stalled-lead:${lead.id}`,
        confidence: 0.78,
        reasonSummary: "Warm chatbot lead is still new and has not been followed up from LeaseStack.",
        firstTopic,
        followUpIntent,
        captured,
        punted,
      });
      cases.set(casePlan.dedupeKey, casePlan);
      const task = buildTask(conversation, casePlan, taskType, now);
      tasks.set(task.dedupeKey, task);
    }

    if (
      lead &&
      hasContact &&
      !hasAppliedOrSigned &&
      (followUpIntent === "availability_pricing" ||
        followUpIntent === "tour" ||
        followUpIntent === "application")
    ) {
      const caseType =
        followUpIntent === "tour"
          ? "TOUR_INTENT_NO_TOUR"
          : followUpIntent === "application"
            ? "APPLICATION_HELP_NEEDED"
            : "AVAILABILITY_QUESTION_NO_CAPTURE";
      if (followUpIntent !== "tour" || lead.tours.length === 0) {
        const casePlan = buildCase(conversation, {
          caseType,
          dedupeKey: `profile-followup:${conversation.id}:${followUpIntent}`,
          confidence: 0.7,
          reasonSummary: `Conversation profile indicates ${humanFollowUpIntent(followUpIntent)} follow-up is needed.`,
          firstTopic,
          followUpIntent,
          captured,
          punted,
        });
        cases.set(casePlan.dedupeKey, casePlan);
        const task = buildTask(
          conversation,
          casePlan,
          followUpTaskFromIntent(followUpIntent),
          now,
        );
        tasks.set(task.dedupeKey, task);
      }
    }

    if (isEngaged && isMidDepth && !captured && (firstTopic === "pricing" || firstTopic === "availability")) {
      const casePlan = buildCase(conversation, {
        caseType:
          firstTopic === "pricing"
            ? "PRICING_QUESTION_NO_CAPTURE"
            : "AVAILABILITY_QUESTION_NO_CAPTURE",
        dedupeKey: `uncaptured-engaged:${conversation.id}:${firstTopic}`,
        confidence: 0.74,
        reasonSummary:
          "Prospect engaged with the chatbot but did not leave contact info after a pricing or availability question.",
        firstTopic,
        followUpIntent,
        captured,
        punted,
      });
      cases.set(casePlan.dedupeKey, casePlan);
      uncapturedCases.push(casePlan);
    }

    if (punted && !captured) {
      const casePlan = buildCase(conversation, {
        caseType: "BOT_FALLBACK_PATTERN",
        dedupeKey: `human-contact-punt:${conversation.id}`,
        confidence: 0.68,
        reasonSummary:
          "Assistant sent the prospect back to a human contact channel without capturing a next step.",
        firstTopic,
        followUpIntent,
        captured,
        punted,
      });
      cases.set(casePlan.dedupeKey, casePlan);
      weakCtaCases.push(casePlan);
    }
  }

  const knowledgeSuggestions = buildKnowledgeSuggestions(weakCtaCases, uncapturedCases);
  const conversationInsights = buildConversationInsights(
    topicCounts,
    topicDropoffs,
    signedTopics,
    weakCtaCases,
    uncapturedCases,
  );
  const siteRecommendations = buildSiteRecommendations(conversationInsights);

  return {
    cases: [...cases.values()],
    tasks: [...tasks.values()],
    knowledgeSuggestions,
    conversationInsights,
    siteRecommendations,
  };
}

export function normalizeMessages(raw: unknown): StoredChatbotMessage[] {
  if (!Array.isArray(raw)) return [];
  const messages: StoredChatbotMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const m = item as StoredChatbotMessage;
    if (typeof m.content !== "string") continue;
    const message: StoredChatbotMessage = {
      role: typeof m.role === "string" ? m.role : undefined,
      content: m.content.trim(),
      timestamp: typeof m.timestamp === "string" ? m.timestamp : undefined,
      ts: typeof m.ts === "string" ? m.ts : undefined,
    };
    if (message.content) messages.push(message);
  }
  return messages;
}

export function classifyTopic(text: string): Topic {
  const t = text.toLowerCase();
  if (/\$|price|pricing|rent|cost|how much|budget|afford/.test(t)) return "pricing";
  if (/available|availability|vacancy|open|room|unit|floor.?plan|bedroom|studio|single|double|triple/.test(t)) return "availability";
  if (/tour|visit|showing|appointment|schedule|see.*place/.test(t)) return "tour";
  if (/apply|application|lease|sign|deadline/.test(t)) return "application";
  if (/parking|pet|pets|laundry|furnished|amenit|utility|utilities|wifi|internet/.test(t)) return "policy";
  if (/move.?in|move in|august|january|summer|fall|semester|asap/.test(t)) return "move_in";
  if (/location|campus|berkeley|distance|walk|bike/.test(t)) return "location";
  return "other";
}

export function classifyFollowUpIntent(
  profile: Record<string, unknown>,
  userText: string,
): FollowUpIntent {
  const followUp = String(profile.followUpNeeded ?? "").toLowerCase();
  const combined = `${followUp} ${userText.toLowerCase()}`;
  if (/tour|visit|showing|schedule|appointment/.test(combined)) return "tour";
  if (/application|apply|lease/.test(combined)) return "application";
  if (/availability|available|room|unit|floor|pricing|rent|price|cost|\$/.test(combined)) {
    return "availability_pricing";
  }
  if (/room type|single|double|triple|studio|bedroom/.test(combined)) return "room_type";
  if (/move.?in|move in|august|fall|semester|asap|summer/.test(combined)) return "move_in";
  if (followUp.trim()) return "general";
  return null;
}

export function hasHumanContactPunt(assistantText: string): boolean {
  return /contact|call|email|leasing office|reach out|check.*availab|check.*website|visit.*website|not sure|don'?t know|can't confirm|cannot confirm/i.test(
    assistantText,
  );
}

function buildCase(
  conversation: LearningConversation,
  args: {
    caseType: LearningCasePlan["caseType"];
    dedupeKey: string;
    confidence: number;
    reasonSummary: string;
    firstTopic: Topic;
    followUpIntent: FollowUpIntent;
    captured: boolean;
    punted: boolean;
  },
): LearningCasePlan {
  return {
    dedupeKey: args.dedupeKey,
    caseType: args.caseType,
    propertyId: conversation.propertyId,
    conversationId: conversation.id,
    leadId: conversation.leadId,
    confidence: args.confidence,
    reasonSummary: args.reasonSummary,
    evidence: {
      firstTopic: args.firstTopic,
      followUpIntent: args.followUpIntent,
      captured: args.captured,
      punted: args.punted,
      messageCount: conversation.messageCount,
      profile: safeProfileSummary(conversation.prospectProfile),
    },
    outcomeSnapshot: {
      leadStatus: conversation.lead?.status ?? null,
      leadIntent: conversation.lead?.intent ?? null,
      tours: conversation.lead?.tours.length ?? 0,
      applications: conversation.lead?.applications.length ?? 0,
      residents: conversation.lead?.residents.length ?? 0,
      lastActivityAt: conversation.lead?.lastActivityAt.toISOString() ?? null,
    },
  };
}

function buildTask(
  conversation: LearningConversation,
  casePlan: LearningCasePlan,
  taskType: FollowUpTaskPlan["taskType"],
  now: Date,
): FollowUpTaskPlan {
  const channel = bestChannel(conversation);
  const priority = priorityFor(conversation, taskType);
  const reasonSummary = reasonForTask(taskType, conversation);
  return {
    dedupeKey: `task:${conversation.leadId ?? conversation.id}:${taskType}`,
    caseDedupeKey: casePlan.dedupeKey,
    propertyId: conversation.propertyId,
    conversationId: conversation.id,
    leadId: conversation.leadId,
    taskType,
    priority,
    recommendedChannel: channel,
    dueAt: priority <= 1 ? now : new Date(now.getTime() + DAY_MS),
    reasonSummary,
    draft: buildDraft(conversation, taskType, channel),
  };
}

function buildDraft(
  conversation: LearningConversation,
  taskType: FollowUpTaskPlan["taskType"],
  channel: FollowUpTaskPlan["recommendedChannel"],
): DraftPlan {
  const profile = normalizeProfile(conversation.prospectProfile);
  const name = conversation.lead?.firstName?.trim();
  const greeting = name ? `Hi ${name}` : "Hi";
  const room = compactString(profile.roomType);
  const moveIn = compactString(profile.moveInDate);
  const budget = compactString(profile.budgetMonthly);
  const property = learningPropertyContext(conversation.property);
  const propertyName = property.name ?? "the property";
  const brandName = property.name ?? "us";
  const tourPath = property.tourUrl
    ? ` You can also use this tour link: ${property.tourUrl}.`
    : "";
  const ctaPath = property.primaryCtaUrl
    ? ` The current next-step link is ${property.primaryCtaUrl}.`
    : property.websiteUrl
      ? ` The property website is ${property.websiteUrl}.`
      : "";
  const contactPath =
    property.phoneNumber || property.contactEmail
      ? ` Leasing can confirm details${property.phoneNumber ? ` by phone at ${property.phoneNumber}` : ""}${property.contactEmail ? `${property.phoneNumber ? " or" : ""} by email at ${property.contactEmail}` : ""}.`
      : "";

  const contextLine = [
    room ? `a ${room}` : null,
    moveIn ? `for ${moveIn}` : null,
    budget ? `around ${budget}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  let subject: string | null = "Following up from your chat";
  let body: string;
  if (taskType === "INVITE_TO_TOUR") {
    subject = `Want to visit ${propertyName}?`;
    body = `${greeting}, thanks for chatting about ${propertyName}. If you are still interested${contextLine ? ` in ${contextLine}` : ""}, I can help you set up a tour or answer questions before you visit.${tourPath}${ctaPath}`;
  } else if (taskType === "APPLICATION_HELP") {
    subject = `${propertyName} application help`;
    body = `${greeting}, I saw you had questions about the application or leasing process for ${propertyName}. I can help point you to the right next step and answer anything that was unclear.${ctaPath}${contactPath}`;
  } else if (taskType === "SEND_AVAILABILITY_PRICING") {
    subject = `${propertyName} availability follow-up`;
    body = `${greeting}, thanks for checking out ${brandName}. I saw you were looking for availability or pricing${contextLine ? ` for ${contextLine}` : ""}. Availability can change, so the best next step is to confirm your preferred room type and move-in timing, then we can point you to the right option.${ctaPath}${contactPath}`;
  } else if (taskType === "CONFIRM_ROOM_TYPE") {
    subject = "Quick room preference question";
    body = `${greeting}, quick follow-up from your ${propertyName} chat: are you looking for a single, double, triple, or another room type? Once I know that, I can help narrow the next step.${ctaPath}`;
  } else if (taskType === "CONFIRM_MOVE_IN") {
    subject = "Quick move-in timing question";
    body = `${greeting}, quick follow-up from your ${propertyName} chat: when are you hoping to move in? Once I know the timing, I can help with the right availability path.${ctaPath}`;
  } else {
    body = `${greeting}, thanks for chatting about ${propertyName}. I wanted to follow up and see if you are still looking or if there is anything we can answer for you.${ctaPath}`;
  }

  if (channel === "SMS") {
    subject = null;
    body = body.replace(/\s+/g, " ").slice(0, 480);
  }

  return {
    channel,
    subject,
    body,
    generatedFrom: {
      taskType,
      conversationId: conversation.id,
      leadId: conversation.leadId,
      property,
      profile: safeProfileSummary(conversation.prospectProfile),
    },
    complianceWarnings: [
      "Review before sending.",
      "Draft does not include invented pricing, availability, or tour times.",
    ],
  };
}

function learningPropertyContext(property: LearningProperty | null): {
  name: string | null;
  websiteUrl: string | null;
  primaryCtaUrl: string | null;
  tourUrl: string | null;
  phoneNumber: string | null;
  contactEmail: string | null;
} {
  const primaryCtaUrl = compactString(property?.chatbotConfig?.primaryCtaUrl);
  return {
    name: compactString(property?.name),
    websiteUrl: compactString(property?.websiteUrl),
    primaryCtaUrl,
    tourUrl: compactString(property?.virtualTourUrl) ?? primaryCtaUrl,
    phoneNumber: compactString(property?.chatbotConfig?.phoneNumber),
    contactEmail:
      compactString(property?.chatbotConfig?.contactEmail) ??
      compactString(property?.notifyLeadEmailOverride),
  };
}

function buildKnowledgeSuggestions(
  weakCtaCases: LearningCasePlan[],
  uncapturedCases: LearningCasePlan[],
): KnowledgeSuggestionPlan[] {
  const suggestions: KnowledgeSuggestionPlan[] = [];
  const weakByProperty = groupByProperty(weakCtaCases);
  for (const [propertyId, rows] of weakByProperty) {
    if (rows.length < 2) continue;
    suggestions.push({
      dedupeKey: `knowledge:weak-cta:${propertyId ?? "org"}`,
      propertyId,
      patternType: "weak_cta_human_contact_punt",
      affectedCount: rows.length,
      suggestedText:
        "When a prospect asks about pricing, availability, or tours, answer what is known and then ask for email or phone so the team can send current openings or help schedule a visit. Avoid ending with only 'contact leasing' or 'check the website.'",
      sourceCaseDedupeKeys: rows.map((r) => r.dedupeKey),
    });
  }

  const uncapturedByProperty = groupByProperty(uncapturedCases);
  for (const [propertyId, rows] of uncapturedByProperty) {
    if (rows.length < 2) continue;
    suggestions.push({
      dedupeKey: `knowledge:capture-after-pricing:${propertyId ?? "org"}`,
      propertyId,
      patternType: "capture_after_pricing_or_availability",
      affectedCount: rows.length,
      suggestedText:
        "After answering pricing or availability questions, ask: 'Want me to send the current openings or help you pick a tour time? I can send it by email or text.'",
      sourceCaseDedupeKeys: rows.map((r) => r.dedupeKey),
    });
  }
  return suggestions;
}

function buildConversationInsights(
  topicCounts: Map<Topic, number>,
  topicDropoffs: Map<Topic, number>,
  signedTopics: Map<Topic, number>,
  weakCtaCases: LearningCasePlan[],
  uncapturedCases: LearningCasePlan[],
): ConversationInsightPlan[] {
  const insights: ConversationInsightPlan[] = [];
  for (const topic of ["pricing", "availability", "tour", "application", "policy"] as Topic[]) {
    const count = topicCounts.get(topic) ?? 0;
    if (count < 3) continue;
    const dropoffs = topicDropoffs.get(topic) ?? 0;
    const signed = signedTopics.get(topic) ?? 0;
    const impactScore = dropoffs * 3 + count + signed * 2;
    const insightType = insightTypeForTopic(topic);
    insights.push({
      dedupeKey: `insight:topic:${topic}`,
      propertyId: null,
      insightType,
      title: titleForTopic(topic, count),
      summary: summaryForTopic(topic, count, dropoffs, signed),
      affectedCount: count,
      impactScore,
      evidence: { topic, count, dropoffs, signed },
      recommendation: recommendationForTopic(topic),
      sourceCaseDedupeKeys: [],
    });
  }

  if (weakCtaCases.length >= 2) {
    insights.push({
      dedupeKey: "insight:weak-cta:human-contact-punt",
      propertyId: null,
      insightType: "WEAK_CTA",
      title: "Chatbot is punting too many prospects to human contact",
      summary:
        "Repeated conversations ended with a generic contact/check-the-site instruction instead of capturing contact info, offering a tour, or creating a handoff.",
      affectedCount: weakCtaCases.length,
      impactScore: weakCtaCases.length * 4,
      evidence: { affectedCaseCount: weakCtaCases.length },
      recommendation: {
        owner: "chatbot",
        fix: "Replace generic handoff language with a concrete capture or tour CTA.",
      },
      sourceCaseDedupeKeys: weakCtaCases.map((c) => c.dedupeKey),
    });
  }

  if (uncapturedCases.length >= 2) {
    insights.push({
      dedupeKey: "insight:site-gap:pricing-availability-capture",
      propertyId: null,
      insightType: "SITE_CONTENT_GAP",
      title: "Pricing and availability questions are not converting cleanly",
      summary:
        "Prospects repeatedly ask pricing or availability questions, engage for several messages, then leave without a captured next step.",
      affectedCount: uncapturedCases.length,
      impactScore: uncapturedCases.length * 5,
      evidence: { affectedCaseCount: uncapturedCases.length },
      recommendation: {
        owner: "site_and_chatbot",
        fix: "Clarify room types, fall availability, and the next step after pricing questions.",
      },
      sourceCaseDedupeKeys: uncapturedCases.map((c) => c.dedupeKey),
    });
  }

  return insights.sort((a, b) => b.impactScore - a.impactScore);
}

function buildSiteRecommendations(
  insights: ConversationInsightPlan[],
): SiteImprovementPlan[] {
  const recommendations: SiteImprovementPlan[] = [];
  for (const insight of insights) {
    if (insight.insightType === "PRICING_CONFUSION") {
      recommendations.push({
        dedupeKey: "site:pricing-copy",
        insightDedupeKey: insight.dedupeKey,
        propertyId: insight.propertyId,
        recommendationType: "PRICING_COPY",
        targetSurface: "TENANT_SITE",
        suggestedTitle: "Clarify pricing expectations",
        suggestedBody:
          "Add a pricing explainer that names the available room types, explains that exact pricing changes with availability and lease timing, and points prospects to the chatbot or tour CTA for current options.",
      });
    }
    if (insight.insightType === "AVAILABILITY_CONFUSION" || insight.insightType === "SITE_CONTENT_GAP") {
      recommendations.push({
        dedupeKey: "site:availability-room-types",
        insightDedupeKey: insight.dedupeKey,
        propertyId: insight.propertyId,
        recommendationType: "AVAILABILITY_COPY",
        targetSurface: "TENANT_SITE",
        suggestedTitle: "Make room type availability easier to find",
        suggestedBody:
          "Add or revise a room-type availability section for singles, doubles, triples, and fall move-in timing. Include a clear CTA to ask the chatbot for current openings.",
      });
    }
    if (insight.insightType === "TOUR_FRICTION" || insight.insightType === "WEAK_CTA") {
      recommendations.push({
        dedupeKey: "site:tour-cta",
        insightDedupeKey: insight.dedupeKey,
        propertyId: insight.propertyId,
        recommendationType: "TOUR_CTA",
        targetSurface: "TENANT_SITE",
        suggestedTitle: "Strengthen the tour CTA",
        suggestedBody:
          "Place a direct tour or visit CTA near pricing and availability content so prospects have an immediate next step after their first question.",
      });
    }
  }
  return recommendations;
}

function normalizeProfile(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function safeProfileSummary(raw: unknown): Record<string, unknown> {
  const p = normalizeProfile(raw);
  return {
    sentiment: compactString(p.sentiment),
    roomType: compactString(p.roomType),
    moveInDate: compactString(p.moveInDate),
    budgetMonthly: compactString(p.budgetMonthly),
    followUpNeeded: compactString(p.followUpNeeded),
  };
}

function messagesToText(messages: StoredChatbotMessage[], role: string): string {
  return messages
    .filter((m) => m.role === role)
    .map((m) => m.content ?? "")
    .join(" ");
}

function firstUserMessage(messages: StoredChatbotMessage[]): string | null {
  return messages.find((m) => m.role === "user" && m.content)?.content ?? null;
}

function hasCapturedContact(conversation: LearningConversation): boolean {
  return !!conversation.leadId || !!conversation.capturedEmail || !!conversation.capturedPhone;
}

function hasReachableContact(conversation: LearningConversation): boolean {
  return !!(
    conversation.lead?.email ||
    conversation.lead?.phone ||
    conversation.capturedEmail ||
    conversation.capturedPhone
  );
}

function isWarmLead(lead: LearningLead, profile: Record<string, unknown>): boolean {
  const sentiment = String(profile.sentiment ?? "").toLowerCase();
  return lead.intent === "warm" || lead.intent === "hot" || sentiment === "warm" || sentiment === "hot";
}

function followUpTaskFromIntent(intent: FollowUpIntent): FollowUpTaskPlan["taskType"] {
  if (intent === "availability_pricing") return "SEND_AVAILABILITY_PRICING";
  if (intent === "tour") return "INVITE_TO_TOUR";
  if (intent === "application") return "APPLICATION_HELP";
  if (intent === "room_type") return "CONFIRM_ROOM_TYPE";
  if (intent === "move_in") return "CONFIRM_MOVE_IN";
  return "GENERAL_FOLLOW_UP";
}

function humanFollowUpIntent(intent: FollowUpIntent): string {
  if (intent === "availability_pricing") return "availability or pricing";
  if (intent === "tour") return "tour scheduling";
  if (intent === "application") return "application or lease";
  if (intent === "room_type") return "room type";
  if (intent === "move_in") return "move-in timing";
  return "general";
}

function bestChannel(conversation: LearningConversation): FollowUpTaskPlan["recommendedChannel"] {
  if (conversation.lead?.phone || conversation.capturedPhone) return "SMS";
  if (conversation.lead?.email || conversation.capturedEmail) return "EMAIL";
  return "INTERNAL_NOTE";
}

function priorityFor(
  conversation: LearningConversation,
  taskType: FollowUpTaskPlan["taskType"],
): number {
  const profile = safeProfileSummary(conversation.prospectProfile);
  const moveIn = String(profile.moveInDate ?? "").toLowerCase();
  if (/asap|now|august|fall|semester/.test(moveIn)) return 1;
  if (taskType === "INVITE_TO_TOUR" || taskType === "SEND_AVAILABILITY_PRICING") return 2;
  return 3;
}

function reasonForTask(
  taskType: FollowUpTaskPlan["taskType"],
  conversation: LearningConversation,
): string {
  const profile = safeProfileSummary(conversation.prospectProfile);
  const followUp = compactString(profile.followUpNeeded);
  const base =
    taskType === "SEND_AVAILABILITY_PRICING"
      ? "Prospect asked about availability or pricing."
      : taskType === "INVITE_TO_TOUR"
        ? "Prospect showed tour or visit intent."
        : taskType === "APPLICATION_HELP"
          ? "Prospect appears to need application or lease help."
          : "Prospect is warm but still needs a human next step.";
  return followUp ? `${base} Extracted follow-up: ${followUp}` : base;
}

function groupByProperty(rows: LearningCasePlan[]): Map<string | null, LearningCasePlan[]> {
  const out = new Map<string | null, LearningCasePlan[]>();
  for (const row of rows) {
    const existing = out.get(row.propertyId) ?? [];
    existing.push(row);
    out.set(row.propertyId, existing);
  }
  return out;
}

function insightTypeForTopic(topic: Topic): ConversationInsightPlan["insightType"] {
  if (topic === "pricing") return "PRICING_CONFUSION";
  if (topic === "availability") return "AVAILABILITY_CONFUSION";
  if (topic === "tour") return "TOUR_FRICTION";
  if (topic === "application") return "APPLICATION_FRICTION";
  if (topic === "policy") return "POLICY_QUESTION";
  return "OBJECTION";
}

function titleForTopic(topic: Topic, count: number): string {
  if (topic === "pricing") return `${count} conversations are about pricing or budget`;
  if (topic === "availability") return `${count} conversations are about availability or room type`;
  if (topic === "tour") return `${count} conversations show tour intent`;
  if (topic === "application") return `${count} conversations ask about applications or leases`;
  if (topic === "policy") return `${count} conversations ask about property policies`;
  return `${count} conversations share the same objection theme`;
}

function summaryForTopic(topic: Topic, count: number, dropoffs: number, signed: number): string {
  const base =
    topic === "pricing"
      ? "Prospects are using the chatbot to understand rent, budget fit, and cost expectations."
      : topic === "availability"
        ? "Prospects are using the chatbot to understand open rooms, unit types, and availability timing."
        : topic === "tour"
          ? "Prospects are asking to visit or schedule a showing."
          : topic === "application"
            ? "Prospects are asking what happens next in the application or lease process."
            : "Prospects are asking repeated operational questions.";
  return `${base} ${dropoffs} of ${count} did not leave a captured next step; ${signed} later signed.`;
}

function recommendationForTopic(topic: Topic): Record<string, unknown> {
  if (topic === "pricing") {
    return {
      owner: "site_and_chatbot",
      fix: "Add pricing expectation copy and make the chatbot ask for contact info after answering pricing questions.",
    };
  }
  if (topic === "availability") {
    return {
      owner: "site_and_chatbot",
      fix: "Clarify room types and current/fall availability paths, then offer to send current openings.",
    };
  }
  if (topic === "tour") {
    return {
      owner: "leasing",
      fix: "Offer a clear tour scheduling next step from the chatbot and follow up on tour-intent conversations.",
    };
  }
  if (topic === "application") {
    return {
      owner: "leasing",
      fix: "Add application next-step copy and draft follow-ups for applicants who seem blocked.",
    };
  }
  return { owner: "chatbot", fix: "Add a direct answer and next-step CTA." };
}

function compactString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
