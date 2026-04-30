-- AppFolio mirrored entities: Residents, Leases, Work Orders.
-- Source of truth remains AppFolio; we mirror what we need to surface in
-- the operator dashboard (renewal pipeline, vacancy forecasting, property
-- health). Idempotent upserts keyed on (orgId, externalSystem, externalId).

-- Enums --------------------------------------------------------------------

CREATE TYPE "ResidentStatus" AS ENUM (
  'ACTIVE',
  'PAST',
  'NOTICE_GIVEN',
  'EVICTED',
  'APPLICANT'
);

CREATE TYPE "LeaseStatus" AS ENUM (
  'PENDING',
  'ACTIVE',
  'EXPIRING',
  'RENEWED',
  'ENDED',
  'EVICTED'
);

CREATE TYPE "WorkOrderStatus" AS ENUM (
  'NEW',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'ON_HOLD'
);

CREATE TYPE "WorkOrderPriority" AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
);

-- Resident ------------------------------------------------------------------

CREATE TABLE "Resident" (
  "id"               TEXT NOT NULL,
  "orgId"            TEXT NOT NULL,
  "propertyId"       TEXT NOT NULL,
  "listingId"        TEXT,
  "leadId"           TEXT,
  "firstName"        TEXT,
  "lastName"         TEXT,
  "email"            TEXT,
  "phone"            TEXT,
  "status"           "ResidentStatus" NOT NULL DEFAULT 'ACTIVE',
  "currentLeaseId"   TEXT,
  "unitNumber"       TEXT,
  "moveInDate"       TIMESTAMP(3),
  "moveOutDate"      TIMESTAMP(3),
  "noticeGivenDate"  TIMESTAMP(3),
  "monthlyRentCents" INTEGER,
  "externalSystem"   TEXT,
  "externalId"       TEXT,
  "raw"              JSONB,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Resident_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Resident_currentLeaseId_key"
  ON "Resident" ("currentLeaseId");

CREATE UNIQUE INDEX "Resident_orgId_externalSystem_externalId_key"
  ON "Resident" ("orgId", "externalSystem", "externalId");

CREATE INDEX "Resident_orgId_status_idx"      ON "Resident" ("orgId", "status");
CREATE INDEX "Resident_propertyId_status_idx" ON "Resident" ("propertyId", "status");
CREATE INDEX "Resident_email_idx"             ON "Resident" ("email");
CREATE INDEX "Resident_moveOutDate_idx"       ON "Resident" ("moveOutDate");

ALTER TABLE "Resident"
  ADD CONSTRAINT "Resident_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Resident"
  ADD CONSTRAINT "Resident_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Resident"
  ADD CONSTRAINT "Resident_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Resident"
  ADD CONSTRAINT "Resident_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Lease ---------------------------------------------------------------------

CREATE TABLE "Lease" (
  "id"                   TEXT NOT NULL,
  "orgId"                TEXT NOT NULL,
  "propertyId"           TEXT NOT NULL,
  "listingId"            TEXT,
  "residentId"           TEXT,
  "status"               "LeaseStatus" NOT NULL DEFAULT 'ACTIVE',
  "startDate"            TIMESTAMP(3),
  "endDate"              TIMESTAMP(3),
  "monthlyRentCents"     INTEGER,
  "securityDepositCents" INTEGER,
  "termMonths"           INTEGER,
  "renewalSentAt"        TIMESTAMP(3),
  "renewalDecision"      TEXT,
  "noticeGivenAt"        TIMESTAMP(3),
  "currentBalanceCents"  INTEGER DEFAULT 0,
  "isPastDue"            BOOLEAN NOT NULL DEFAULT FALSE,
  "pastDueAsOf"          TIMESTAMP(3),
  "externalSystem"       TEXT,
  "externalId"           TEXT,
  "raw"                  JSONB,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Lease_orgId_externalSystem_externalId_key"
  ON "Lease" ("orgId", "externalSystem", "externalId");

CREATE INDEX "Lease_orgId_status_idx"            ON "Lease" ("orgId", "status");
CREATE INDEX "Lease_propertyId_status_idx"       ON "Lease" ("propertyId", "status");
CREATE INDEX "Lease_endDate_idx"                 ON "Lease" ("endDate");
CREATE INDEX "Lease_isPastDue_currentBalanceCents_idx"
  ON "Lease" ("isPastDue", "currentBalanceCents");

ALTER TABLE "Lease"
  ADD CONSTRAINT "Lease_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lease"
  ADD CONSTRAINT "Lease_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lease"
  ADD CONSTRAINT "Lease_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lease"
  ADD CONSTRAINT "Lease_residentId_fkey"
  FOREIGN KEY ("residentId") REFERENCES "Resident"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Resident.currentLeaseId references Lease (deferred, requires Lease to exist)
ALTER TABLE "Resident"
  ADD CONSTRAINT "Resident_currentLeaseId_fkey"
  FOREIGN KEY ("currentLeaseId") REFERENCES "Lease"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- WorkOrder -----------------------------------------------------------------

CREATE TABLE "WorkOrder" (
  "id"                 TEXT NOT NULL,
  "orgId"              TEXT NOT NULL,
  "propertyId"         TEXT NOT NULL,
  "listingId"          TEXT,
  "residentId"         TEXT,
  "workOrderNumber"    TEXT,
  "status"             "WorkOrderStatus" NOT NULL DEFAULT 'NEW',
  "priority"           "WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
  "category"           TEXT,
  "title"              TEXT,
  "description"        TEXT,
  "unitNumber"         TEXT,
  "vendorName"         TEXT,
  "vendorEmail"        TEXT,
  "reportedAt"         TIMESTAMP(3),
  "scheduledFor"       TIMESTAMP(3),
  "completedAt"        TIMESTAMP(3),
  "estimatedCostCents" INTEGER,
  "actualCostCents"    INTEGER,
  "externalSystem"     TEXT,
  "externalId"         TEXT,
  "raw"                JSONB,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkOrder_orgId_externalSystem_externalId_key"
  ON "WorkOrder" ("orgId", "externalSystem", "externalId");

CREATE INDEX "WorkOrder_orgId_status_idx"
  ON "WorkOrder" ("orgId", "status");
CREATE INDEX "WorkOrder_propertyId_status_priority_idx"
  ON "WorkOrder" ("propertyId", "status", "priority");
CREATE INDEX "WorkOrder_reportedAt_idx"  ON "WorkOrder" ("reportedAt");
CREATE INDEX "WorkOrder_completedAt_idx" ON "WorkOrder" ("completedAt");

ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "WorkOrder_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "WorkOrder_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "WorkOrder_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkOrder"
  ADD CONSTRAINT "WorkOrder_residentId_fkey"
  FOREIGN KEY ("residentId") REFERENCES "Resident"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
