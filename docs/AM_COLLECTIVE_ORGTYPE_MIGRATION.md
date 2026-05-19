# AM Collective orgType Migration Runbook

Flip the `Organization` row representing AM Collective (the parent agency
that operates LeaseStack itself) from `orgType=CLIENT` to `orgType=AGENCY`.

Script: [`scripts/migrate-amc-orgtype.ts`](../scripts/migrate-amc-orgtype.ts)

---

## Why this matters

`orgType` is the load-bearing flag throughout the tenancy layer:

- `lib/tenancy/scope.ts` derives `isAgency = actualOrgType === OrgType.AGENCY`
  on every request, which drives:
  - `requireAgency()` — gates every admin route and server action.
  - `requireClient()` — accepts agency users when they're impersonating.
  - The `ScopedContext.role` defaulting and the `/admin` vs `/portal` split.
- `app/admin/layout.tsx` redirects non-agency scopes to `/portal`.
- `app/portal/layout.tsx` redirects agency scopes (without an active
  impersonation) to `/admin`.
- `app/auth/redirect/page.tsx` reads `orgType === 'AGENCY'` post-sign-in
  to decide where to send the user.
- `lib/tenancy/impersonate.ts#startImpersonation()` only allows agency
  users to impersonate, and only allows impersonating CLIENT orgs.
- `prisma/seed.ts` and `app/api/admin/bootstrap/route.ts` both upsert the
  singleton agency by `slug` and set `orgType: AGENCY`.

While AM Collective is mis-tagged as `CLIENT`, its members:

- Land on `/portal` instead of `/admin`.
- Cannot pass `requireAgency()`, so they get 403 on admin routes and
  server actions.
- Cannot start impersonation sessions.
- Show up in agency-listing dashboards as a tenant, not as the operator.

---

## Pre-migration: capture current state

Run these read-only checks against the same DB the script will hit
(use `.env.local` for staging/prod). Save the output for the rollback
diff.

```bash
set -a; source .env.local; set +a

# 1. Confirm exactly one matching row exists, what it looks like today.
psql "$DATABASE_URL" -c "
  SELECT id, name, slug, \"orgType\", \"productLine\", status, \"createdAt\"
  FROM \"Organization\"
  WHERE name ILIKE '%AM Collective%' OR slug = 'am-collective';
"

# 2. Member count — how many users will see a behavior change.
psql "$DATABASE_URL" -c "
  SELECT u.role, COUNT(*) AS n
  FROM \"User\" u
  JOIN \"Organization\" o ON o.id = u.\"orgId\"
  WHERE o.name ILIKE '%AM Collective%' OR o.slug = 'am-collective'
  GROUP BY u.role
  ORDER BY u.role;
"

# 3. Sanity check: is there ALSO an existing AGENCY org? The seed creates
#    'LeaseStack Agency' / slug 'leasestack-agency' — confirm whether we
#    are about to create a SECOND AGENCY row (intentional or not).
psql "$DATABASE_URL" -c "
  SELECT id, name, slug, \"orgType\"
  FROM \"Organization\"
  WHERE \"orgType\" = 'AGENCY';
"
```

Save the row id from step 1 — you'll need it for rollback. If step 1
returns more than one row, **STOP** and resolve manually; the script will
abort in that case anyway.

---

## Run the migration

```bash
cd /Users/adamwolfe/realos
set -a; source .env.local; set +a
pnpm exec tsx scripts/migrate-amc-orgtype.ts
```

Expected output on a real migration:

```
[migrate-amc-orgtype] Searching for org matching name ILIKE '%AM Collective%' OR slug = 'am-collective'...
[migrate-amc-orgtype] Found single candidate:
  id:      <cuid>
  name:    AM Collective
  slug:    am-collective
  orgType: CLIENT
[migrate-amc-orgtype] OK migrated:
  org:         AM Collective (am-collective)
  orgType:     CLIENT -> AGENCY
  audit row:   <cuid> @ <iso-timestamp>
  next steps:  members of this org should re-sign-in so /admin gating picks up the change.
```

Expected output on a re-run (idempotent):

```
[migrate-amc-orgtype] OK: orgType is already AGENCY. Already migrated. No-op.
```

Expected output if the row doesn't exist:

```
[migrate-amc-orgtype] WARN: no AM Collective organization found. Nothing to do. Exiting cleanly.
```

Expected output if more than one candidate exists (the script aborts with exit code 2):

```
[migrate-amc-orgtype] ABORT: found multiple candidate organizations. ...
```

---

## Post-migration verification

Run all four checks. **All four must pass** before declaring success.

### 1. DB state

```bash
psql "$DATABASE_URL" -c "
  SELECT id, name, slug, \"orgType\"
  FROM \"Organization\"
  WHERE name ILIKE '%AM Collective%' OR slug = 'am-collective';
"
```

Expect `orgType = AGENCY`.

### 2. AuditEvent row was written

```bash
psql "$DATABASE_URL" -c "
  SELECT id, \"orgId\", action, \"entityType\", description, diff, \"createdAt\"
  FROM \"AuditEvent\"
  WHERE \"entityType\" = 'Organization.orgType'
  ORDER BY \"createdAt\" DESC
  LIMIT 5;
"
```

Expect one row with `action='UPDATE'`, `entityType='Organization.orgType'`,
and `diff->>'before' = 'CLIENT'`, `diff->>'after' = 'AGENCY'`.

### 3. Agency surfaces now visible to AM Collective members

Sign in (or refresh the Clerk session — the easiest way is sign out and
back in) as an AM Collective user and confirm:

- `/auth/redirect` lands on `/admin`, not `/portal`.
- `/admin` loads (no redirect to `/portal`).
- `/admin/clients` lists tenants.
- `/portal` redirects back to `/admin` (proves `app/portal/layout.tsx`
  sees `isAgency: true`).

### 4. Impersonation works

From `/admin/clients`, start impersonating any CLIENT tenant.

- The impersonation start should succeed (no "Agency access only" error).
- A second `AuditEvent` row should be written with
  `action='IMPERSONATE_START'`.
- `/portal` should now render the impersonated client's dashboard.
- Ending impersonation should write `action='IMPERSONATE_END'` and bounce
  back to `/admin`.

If any of #3 or #4 fail, the most likely cause is a stale Clerk session
cache — fully sign out, clear cookies for the Clerk domain, and sign back
in.

---

## Rollback

The script does not store a backup. If something breaks and you need to
revert, run this manual UPDATE against the same DB:

```bash
set -a; source .env.local; set +a

# Replace <ORG_ID> with the id captured in pre-migration step 1.
psql "$DATABASE_URL" -c "
  UPDATE \"Organization\"
  SET \"orgType\" = 'CLIENT'
  WHERE id = '<ORG_ID>';
"

# Record the rollback in audit. Replace <ORG_ID> again.
psql "$DATABASE_URL" -c "
  INSERT INTO \"AuditEvent\"
    (id, \"orgId\", \"userId\", action, \"entityType\", \"entityId\", description, diff, \"createdAt\")
  VALUES (
    'rollback_' || substr(md5(random()::text), 1, 16),
    '<ORG_ID>',
    NULL,
    'UPDATE',
    'Organization.orgType',
    '<ORG_ID>',
    'Manual rollback of scripts/migrate-amc-orgtype.ts',
    jsonb_build_object('field','orgType','before','AGENCY','after','CLIENT','source','manual-rollback','ranAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')),
    now()
  );
"
```

After rollback, AM Collective members must sign out and back in to clear
the cached Clerk session before the `/portal` redirect resumes.

---

## Notes for the operator

- The script is safe to commit and re-run — there is no production-only
  guard because the operation is intentional in every environment
  (dev, staging, prod).
- It writes an `AuditEvent` row with `userId = NULL`. The schema allows
  this (the user FK uses `onDelete: SetNull` and is optional), and it's
  the right semantic for a script-driven backfill — no human user
  performed this change.
- The script intentionally does NOT touch other fields (slug, name,
  productLine, status, primary contact). If AM Collective also needs a
  rename, run `scripts/rename-agency-org.ts` separately.
- If the seed-created `LeaseStack Agency` org also exists, the codebase
  will then have TWO `orgType=AGENCY` rows. `getDemoScope()` uses
  `findFirst({ where: { orgType: AGENCY } })`, which is non-deterministic
  across two rows in DEMO_MODE only — irrelevant in production (demo
  mode is hard-disabled when `VERCEL_ENV=production`). If you want a
  true singleton agency, decide which row is canonical and migrate
  users/data off the other before deleting it. Not in scope for this
  migration.
