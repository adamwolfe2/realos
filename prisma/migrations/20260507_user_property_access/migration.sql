-- Property-level RBAC: per-user access grants to specific properties.
--
-- Semantics:
--   * ZERO rows for a user  → unrestricted (org-wide access — preserves
--     legacy behavior, so this migration is non-breaking for every user
--     who exists today).
--   * ONE OR MORE rows      → restricted. The user can ONLY see those
--     properties' data on every portal page; the property dropdown is
--     also filtered to that allowed set.
--
-- The optional `role` override is reserved for a future PR (e.g., a user
-- might be CLIENT_ADMIN on Telegraph Commons but CLIENT_VIEWER on a
-- sister property). Not consulted at gate time today.

CREATE TABLE "UserPropertyAccess" (
  "id"         TEXT     NOT NULL,
  "userId"     TEXT     NOT NULL,
  "propertyId" TEXT     NOT NULL,
  "role"       "UserRole",
  "grantedBy"  TEXT,
  "grantedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserPropertyAccess_pkey" PRIMARY KEY ("id")
);

-- A user can be granted access to a given property at most once.
CREATE UNIQUE INDEX "UserPropertyAccess_userId_propertyId_key"
  ON "UserPropertyAccess" ("userId", "propertyId");

-- Lookup paths used at every page render: "what can THIS user see?"
-- and "who has access to THIS property?" (for the admin team panel).
CREATE INDEX "UserPropertyAccess_userId_idx"
  ON "UserPropertyAccess" ("userId");

CREATE INDEX "UserPropertyAccess_propertyId_idx"
  ON "UserPropertyAccess" ("propertyId");

ALTER TABLE "UserPropertyAccess"
  ADD CONSTRAINT "UserPropertyAccess_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPropertyAccess"
  ADD CONSTRAINT "UserPropertyAccess_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
