-- Flag every user who currently holds property grants, so losing all of them
-- later locks the seat out instead of widening it to org-wide (scope.ts).
-- Idempotent. Touches only users with at least one UserPropertyAccess row.
UPDATE "User"
SET "propertyAccessRestricted" = true
WHERE "propertyAccessRestricted" = false
  AND "id" IN (SELECT "userId" FROM "UserPropertyAccess");
