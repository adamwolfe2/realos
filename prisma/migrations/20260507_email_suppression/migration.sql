-- Email-address-level opt-out list. Populated by RFC 8058 one-click
-- unsubscribes from Gmail/Yahoo/Apple Mail, browser-based GET
-- unsubscribes from the visible footer link, and manual additions
-- via the admin panel. Every email send checks this list before
-- dispatching to Resend.

CREATE TABLE "EmailSuppression" (
  "id"             TEXT        NOT NULL,
  "email"          TEXT        NOT NULL,
  "reason"         TEXT,
  "category"       TEXT,
  "source"         TEXT,
  "unsubscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailSuppression_email_key" ON "EmailSuppression"("email");
CREATE INDEX "EmailSuppression_email_idx" ON "EmailSuppression"("email");
