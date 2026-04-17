import type {
  Listing,
  Organization,
  Property,
  TenantSiteConfig,
} from "@prisma/client";

export type ChatbotTenant = Organization & {
  tenantSiteConfig: TenantSiteConfig | null;
  properties: Array<Property & { listings: Listing[] }>;
};

// ---------------------------------------------------------------------------
// System prompt builder. Forked pattern from telegraph-commons: short,
// specific, first-person. We compose it from TenantSiteConfig + live
// Listing rows so the chatbot answers pricing questions accurately.
// DECISION: never fabricate facts. If we don't have pricing or availability
// for a given unit, the prompt instructs the bot to say so and surface the
// configured contact channels.
// ---------------------------------------------------------------------------

export function buildSystemPrompt(org: ChatbotTenant): string {
  const config = org.tenantSiteConfig;
  const property = org.properties[0];
  const listings = property?.listings ?? [];

  const persona = (config?.chatbotPersonaName ?? "Leasing").trim();
  const personaIsName = /^[A-Z][a-z]+$/.test(persona);
  const identity = personaIsName
    ? `You are ${persona}, a member of the ${org.name} leasing team.`
    : `You are the ${persona} assistant for ${org.name}.`;

  const propertyBlock = property
    ? `
PROPERTY:
- Name: ${property.name}
- Address: ${[
        property.addressLine1,
        property.city,
        property.state,
        property.postalCode,
      ]
        .filter(Boolean)
        .join(", ") || "Address available on request"}
- Type: ${property.residentialSubtype ?? property.propertyType}
- Total units: ${property.totalUnits ?? "not shared"}
- Year built: ${property.yearBuilt ?? "not shared"}`
    : "";

  const contactLines: string[] = [];
  if (config?.phoneNumber)
    contactLines.push(`Phone: ${config.phoneNumber}`);
  if (config?.contactEmail)
    contactLines.push(`Email: ${config.contactEmail}`);
  if (org.primaryContactName && !config?.phoneNumber && !config?.contactEmail) {
    contactLines.push(`Primary contact: ${org.primaryContactName}`);
  }
  const contactBlock = contactLines.length
    ? `
CONTACT:
${contactLines.map((l) => `- ${l}`).join("\n")}`
    : "";

  const availabilityBlock = listings.length
    ? `
AVAILABLE UNITS RIGHT NOW:
${listings
        .slice(0, 24)
        .map((l) => formatListingLine(l))
        .join("\n")}`
    : `
AVAILABLE UNITS RIGHT NOW: All units are leased. Invite interested visitors
to join the waitlist by sharing their email.`;

  const kbBlock = config?.chatbotKnowledgeBase
    ? `
ADDITIONAL CONTEXT FROM THE AGENCY:
${config.chatbotKnowledgeBase}`
    : "";

  const ctaBlock = config?.primaryCtaUrl
    ? `
PRIMARY CTA: Link visitors to ${config.primaryCtaUrl} when they're ready to
apply. Use the phrase "${config.primaryCtaText ?? "Apply Now"}".`
    : "";

  return `${identity} Write like a warm, knowledgeable person, not a bot.
${propertyBlock}${contactBlock}${availabilityBlock}${kbBlock}${ctaBlock}

BEHAVIOR RULES:
- Do NOT say "I'm an AI" or "I'm a virtual assistant". You are a member of
  the team.
- Keep replies concise, two to four short sentences unless the visitor asks
  for detail.
- Never invent pricing, availability, policies, or amenities that aren't in
  the facts above. If asked and you don't know, say so and offer to connect
  them to the team via the contact info above.
- After answering their first question, naturally ask for the best email so
  the team can follow up. If they decline, don't push.
- If the visitor shows tour or apply intent, nudge them toward the primary
  CTA or share the contact info above for scheduling.
- Be honest, direct, and helpful. Warmth wins.`;
}

function formatListingLine(l: Listing): string {
  const price = l.priceCents
    ? `$${(l.priceCents / 100).toLocaleString()}/mo`
    : "contact for rate";
  const bedBath = [
    l.bedrooms != null ? `${l.bedrooms} bed` : null,
    l.bathrooms != null ? `${l.bathrooms} bath` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const sqft = l.squareFeet ? `, ${l.squareFeet} sq ft` : "";
  const unit = l.unitType ?? "Unit";
  return `- ${unit}${l.unitNumber ? ` #${l.unitNumber}` : ""}: ${price}${
    bedBath ? `, ${bedBath}` : ""
  }${sqft}`;
}
