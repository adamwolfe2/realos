-- Stamp existing notifications with the property of the record they point at,
-- so a property-restricted seat keeps its own buildings' history once the
-- bell is filtered per seat. Same-org matches only. Rows with no resolvable
-- property (org-level alerts, report drafts) stay NULL. Idempotent.
UPDATE "Notification" n SET "propertyId" = l."propertyId"
FROM "Lead" l
WHERE n."propertyId" IS NULL AND n."entityType" = 'Lead'
  AND l."id" = n."entityId" AND l."orgId" = n."orgId" AND l."propertyId" IS NOT NULL;

UPDATE "Notification" n SET "propertyId" = i."propertyId"
FROM "Insight" i
WHERE n."propertyId" IS NULL AND n."entityType" = 'Insight'
  AND i."id" = n."entityId" AND i."orgId" = n."orgId" AND i."propertyId" IS NOT NULL;

-- Chatbot rows were written with either the conversation id or its sessionId.
UPDATE "Notification" n SET "propertyId" = c."propertyId"
FROM "ChatbotConversation" c
WHERE n."propertyId" IS NULL AND n."entityType" = 'ChatbotConversation'
  AND (c."id" = n."entityId" OR c."sessionId" = n."entityId")
  AND c."orgId" = n."orgId" AND c."propertyId" IS NOT NULL;

UPDATE "Notification" n SET "propertyId" = t."propertyId"
FROM "Tour" t JOIN "Lead" l ON l."id" = t."leadId"
WHERE n."propertyId" IS NULL AND n."entityType" = 'Tour'
  AND t."id" = n."entityId" AND l."orgId" = n."orgId";

UPDATE "Notification" n SET "propertyId" = d."propertyId"
FROM "ContentDraft" d
WHERE n."propertyId" IS NULL AND n."entityType" = 'ContentDraft'
  AND d."id" = n."entityId" AND d."orgId" = n."orgId" AND d."propertyId" IS NOT NULL;
