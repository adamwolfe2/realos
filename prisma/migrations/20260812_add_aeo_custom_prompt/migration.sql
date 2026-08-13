-- AeoCustomPrompt — operator-added AEO prompts, run alongside generated
-- prompts in every scan. Capped at 10 active per property in the API layer.

CREATE TABLE "AeoCustomPrompt" (
  "id"         TEXT NOT NULL,
  "orgId"      TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "prompt"     TEXT NOT NULL,
  "addedBy"    TEXT,
  "active"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AeoCustomPrompt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AeoCustomPrompt_orgId_propertyId_prompt_key"
  ON "AeoCustomPrompt" ("orgId", "propertyId", "prompt");

CREATE INDEX "AeoCustomPrompt_orgId_propertyId_active_idx"
  ON "AeoCustomPrompt" ("orgId", "propertyId", "active");

ALTER TABLE "AeoCustomPrompt"
  ADD CONSTRAINT "AeoCustomPrompt_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AeoCustomPrompt"
  ADD CONSTRAINT "AeoCustomPrompt_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
