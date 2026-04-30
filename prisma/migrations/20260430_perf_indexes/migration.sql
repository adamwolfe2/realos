-- Performance indexes
-- Visitor: speed up "find existing visitor by email" lookups during enrichment.
CREATE INDEX IF NOT EXISTS "Visitor_orgId_email_idx" ON "Visitor" ("orgId", "email");

-- ChatbotConversation: speed up "all conversations for a lead" and
-- "all conversations for a property" lookups (both used in lead/property detail
-- pages). The existing sessionId @unique covers the upsert path.
CREATE INDEX IF NOT EXISTS "ChatbotConversation_leadId_idx" ON "ChatbotConversation" ("leadId");
CREATE INDEX IF NOT EXISTS "ChatbotConversation_propertyId_idx" ON "ChatbotConversation" ("propertyId");
