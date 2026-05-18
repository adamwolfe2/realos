# Credentials Vault — PRD

**Owner:** Adam
**Reporter:** Norman (SG Real Estate)
**Status:** Drafted 2026-05-18
**Target:** Phase 1 ships within 1 week as a paid add-on

---

## 1. Problem

Operators run their business across 15+ external platforms (AppFolio,
Google Ads, Meta Ads, GA4, Google Search Console, listing sites,
banking, payroll, vendor portals, etc.). Passwords for those platforms
today live in:

- Word docs passed around the team
- Sticky notes
- Ad-hoc Google PW Manager accounts
- The brain of one specific employee

Concrete failure mode Norman shipped feedback on: SG Real Estate
**doesn't own the GA4 login for Telegraph Commons.** A $25M business is
running without access to its own analytics. If that one person leaves
or rotates the password, the data is lost.

Operators want a single secure place where every credential for every
property lives, organized, permissioned, and accessible to anyone
authorized on the LeaseStack account.

## 2. Why us

LeaseStack already has the trust anchor: we own the auth boundary
(Clerk), the property graph (Property + UserPropertyAccess), and the
audit infrastructure (AuditEvent). Bolting a vault onto our existing
tenancy primitives is dramatically cheaper than asking customers to
adopt 1Password and re-permission everything against another platform.

The ask plugs directly into our "take control of your digital assets"
positioning — the same narrative we use for the pixel, popups, and
chatbot. A unified credentials surface is the logical next step.

## 3. Goals + non-goals

**Goals (Phase 1):**

- One vault per LeaseStack organization
- Per-credential scope: org-wide OR property-scoped
- Honest UI: passwords masked by default, one-click reveal with audit
- Browser-side copy-to-clipboard with auto-clear (30 sec)
- Bulk import from a CSV of `name,url,username,password,notes` so
  operators don't have to retype 50 logins
- Every reveal / create / update / delete is logged in AuditEvent
- Property-level RBAC so a leasing agent restricted to Bldg A can't
  see Bldg B's credentials
- Encrypted at rest with envelope encryption — leaked DB dump alone
  cannot decrypt anything

**Non-goals (Phase 1):**

- Browser extension / autofill
- TOTP/2FA storage
- Password generator
- Sharing via one-time view link
- Password strength scanning / leaked password detection
- Native mobile app
- Recurring rotation reminders

Each non-goal is a clear Phase 2 candidate; we'll re-prioritize after
seeing usage.

## 4. User stories

1. **As a property owner**, I want to paste in 50 logins from scattered
   docs once and have them organized by property forever.
2. **As an admin**, I want any of my team members (with the right
   permission) to be able to access AppFolio for Telegraph Commons
   without me being a single point of failure.
3. **As a leasing agent restricted to Bldg A**, I want to see only
   credentials for Bldg A — I shouldn't even know what credentials
   exist for Bldg B.
4. **As an admin auditor**, I want to know who opened the bank-account
   credential last week, and from what IP.
5. **As a security-conscious operator**, I want copied passwords to
   disappear from my clipboard automatically.
6. **As an agency operator**, I want to see the vault for any client I
   impersonate, and I want every reveal I do as that impersonator
   tagged in the audit log as "Adam-as-SG-Real-Estate".

## 5. Threat model

We need to defend against:

| Threat | Defense |
|---|---|
| DB dump leak (someone exfiltrates the Prisma rows) | Envelope encryption: per-org DEK (data-encryption key) wrapped by a master KEK (key-encryption key) stored in env. DB alone yields nothing. |
| Compromised env var (someone steals the master key) | Org DEKs are stored encrypted at rest; rotating the master KEK re-wraps DEKs but doesn't require re-encrypting every credential. |
| Compromised LeaseStack admin account | Audit log surfaces unusual access patterns. Future: 2FA-gate on reveal. |
| Tenant A reading tenant B | Existing `tenantWhere(scope)` + per-row `orgId` scope. Re-validated server-side on every read. |
| Restricted user reading out-of-scope property | Existing `propertyWhereFragment(scope, ids)` applied to vault queries. Validated server-side. |
| Replay attack on reveal endpoint | Rate limit per-user (10 reveals / min) + audit log. |
| MITM | HTTPS only, Clerk auth, no JWT in URL. |
| Browser extension scraping reveal modal | Reveal modal auto-closes after 30 sec; clipboard auto-clears. |
| Operator pastes the wrong file (e.g. .env) on import | CSV import is staged — the operator reviews a preview before committing. Magic-byte sniff to reject anything that doesn't look like CSV. |
| Backup leak | Backups respect the same envelope encryption — Neon backups contain ciphertext, not plaintext. |

## 6. Security model

### Envelope encryption (NIST SP 800-57)

```
master KEK   (env: VAULT_MASTER_KEK_B64, 32 bytes base64)
   ↓ wraps
org DEK      (stored encrypted on Organization.vaultDekWrapped)
   ↓ encrypts
credential   (CredentialEntry.secretCiphertext + iv + authTag)
```

- **Master KEK**: 32-byte base64 in `VAULT_MASTER_KEK_B64` env var.
  Generated once, never rotated except via documented rotation script.
- **Org DEK**: 32-byte random key generated the first time a vault row
  is created for an org. Wrapped with AES-256-GCM using the master KEK
  and stored on `Organization.vaultDekWrapped` (Bytes + nonce).
- **Credential ciphertext**: AES-256-GCM with a fresh 12-byte IV per
  credential. `authTag` stored alongside.

Properties of this model:

- Stolen DB dump alone yields nothing — attacker needs the env KEK.
- Stolen env KEK alone yields nothing — attacker also needs the DB.
- Per-org DEK isolation: compromised org DEK cannot decrypt other
  orgs' credentials.
- Rotation: rotating the master KEK only requires re-wrapping each
  org's DEK (small, fast). Rotating an org's DEK requires re-encrypting
  that org's credentials (medium effort, scoped, scriptable).

### Plaintext lifecycle

- Plaintext password never persists. Decrypted only inside a server
  action, never written to a DB column or log.
- Plaintext crosses the wire only on explicit "Reveal" — never on list
  fetch.
- Server returns plaintext with `Cache-Control: no-store, private`.
- Client clears plaintext from React state after 30 sec or modal close.
- Clipboard write uses navigator.clipboard.writeText + setTimeout
  navigator.clipboard.writeText("") 30 sec later.

### Authorization

Every read/write goes through:

1. `requireScope()` — must be authenticated + in an org
2. `tenantWhere(scope)` — credential must belong to caller's org
3. `propertyWhereFragment(scope, ids)` — if the credential has a
   propertyId, it must be in the caller's allowed property set
4. New `canAccessVault(scope.role)` permission gate — by default
   AGENCY_*, CLIENT_OWNER, CLIENT_ADMIN. LEASING_AGENT denied unless
   explicitly granted per-credential (Phase 2).

### Audit log

Every operation writes an `AuditEvent`:

- `entityType = "CredentialEntry"`
- `action = CREATE | UPDATE | DELETE | EXPORT` (EXPORT used for
  "reveal" — operator is exporting plaintext out of the vault)
- `description = "Revealed Stripe production key (TelegraphCommons)"`
- `actor`, `orgId`, `entityId`, `ipAddress`, `userAgent`

Reveal events have an additional dedicated `CredentialAccessLog` row
so the audit query can show "last 10 reveals on this credential"
without scanning the global audit log.

## 7. Data model

```prisma
model CredentialEntry {
  id            String          @id @default(cuid())
  orgId         String
  org           Organization    @relation(fields: [orgId], references: [id], onDelete: Cascade)

  // NULL = org-wide. Non-NULL = scoped to one property.
  propertyId    String?
  property      Property?       @relation(fields: [propertyId], references: [id], onDelete: SetNull)

  // Clear-text metadata. The operator sees these in the list view.
  name          String          // "Google Analytics 4 — Telegraph"
  platform      String?         // free-text or enum: google-ads, meta-ads, appfolio, ...
  websiteUrl    String?         // login URL
  username      String?         // email / username
  notes         String?         @db.Text
  tags          String[]        @default([])

  // Encrypted secret payload. Always AES-256-GCM with the org's DEK.
  // secretCiphertext is the ciphertext, iv is the 12-byte nonce,
  // authTag is the 16-byte GCM tag. All base64-encoded.
  secretCiphertext String        @db.Text
  secretIv         String
  secretAuthTag    String

  // Lifecycle metadata.
  createdById   String?
  lastRevealedAt DateTime?
  lastRotatedAt  DateTime?
  expiresAt      DateTime?       // optional — operator-set rotation reminder

  // Soft-delete so audit log references remain queryable.
  deletedAt     DateTime?
  deletedById   String?

  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  accessLogs    CredentialAccessLog[]

  @@index([orgId, propertyId])
  @@index([orgId, platform])
  @@index([orgId, deletedAt])
}

model CredentialAccessLog {
  id           String          @id @default(cuid())
  credentialId String
  credential   CredentialEntry @relation(fields: [credentialId], references: [id], onDelete: Cascade)

  // Cached scope info — denormalized so the access log survives even
  // when the credential row is later soft-deleted.
  orgId        String
  userId       String?
  userEmail    String
  asImpersonatorId String?       // agency staff impersonating a tenant

  action       String          // "reveal" | "copy" | "edit" | "delete"
  ipAddress    String?
  userAgent    String?
  occurredAt   DateTime        @default(now())

  @@index([credentialId, occurredAt(sort: Desc)])
  @@index([orgId, occurredAt(sort: Desc)])
}

// Added to Organization:
//   vaultDekWrapped   Bytes?  // null until first credential created
//   vaultDekNonce     Bytes?  // 12-byte nonce used to wrap the DEK
//   vaultEnabledAt    DateTime?
```

## 8. UI surface (Phase 1)

**`/portal/vault`** — main page
- KPI strip: total credentials, credentials added this week, last
  reveal time, revealing user count (audit signal)
- Filter row: property multi-select, platform dropdown, search by name
- Table: name, platform, property, username, last revealed, actions
  (reveal / edit / copy-username / delete)
- Each row has a "•••••••• 👁" pattern — click eye to reveal modal
- Top-right: "Add credential", "Import CSV"

**Reveal modal**
- Full credential displayed for 30 sec, count-down ring
- "Copy password" + "Copy username" buttons; clipboard auto-clears 30s
- "View access history" link → drawer with last 20 access events
- Closing the modal clears plaintext from React state

**Add/Edit modal**
- Form: name (required), platform (autocomplete), property (optional),
  url, username, password (paste / generate), notes, tags, expiresAt
- Generator: 24-char random with symbols (uses
  `crypto.getRandomValues`)

**CSV import**
- Two-step wizard
- Step 1: paste CSV OR upload .csv
  - Required columns: `name`, `password`. Optional: `url`,
    `username`, `notes`, `platform`, `property_slug`
- Step 2: preview first 10 rows + total count. Operator confirms.
  Anything that fails validation surfaces inline; valid rows commit
  in a single transaction.

**Admin visibility**
- `/admin` adds a "Vault" tile showing platform-wide stats: total
  vaults, total credentials, reveals in last 24h, orgs with stale
  credentials (expiresAt < now)
- `/admin/clients/[id]` shows the same per-tenant

## 9. API surface

### Server actions (lib/actions/vault.ts)

- `createCredential(input)` → `{ ok, id }`
- `updateCredential(id, input)` → `{ ok }`
- `deleteCredential(id)` → `{ ok }` (soft delete)
- `revealCredential(id)` → `{ ok, password, accessLogId }` — audit row
  written before plaintext returned
- `importCredentialsFromCsv(csvText, options)` → `{ ok, created,
  skipped, errors }`
- `getCredentialAccessLog(id, limit?)` → `{ logs[] }`

### REST endpoints

None in Phase 1. Server actions only — keeps the attack surface tight.

## 10. Pricing / packaging

Vault is a **paid add-on** at $10/mo/property (matches how Norman
described the value — per-property utility) with org-wide pricing
floors:
- $25/mo flat for org-wide vault on Starter
- $50/mo flat for org-wide vault on Growth
- Included free on Scale

This is a separate `moduleVault` boolean on Organization so we can
gate the whole feature behind plan.

## 11. Phasing

**Phase 1 (this week):** Schema, crypto, server actions, /portal/vault
UI, CSV import, audit log, admin tile. Ship as `moduleVault` add-on.

**Phase 2 (next):** TOTP storage, password generator, sharing via
one-time view link, 2FA gate on reveal.

**Phase 3:** Browser extension (Chrome/Edge), mobile autofill, leaked
password detection (HIBP integration).

**Phase 4:** Recurring rotation reminders, automated rotation for
platforms we already integrate with (Google Ads, Meta Ads).

## 12. Open questions for Norman

1. **Master-key access model:** "Anyone with LeaseStack admin access
   should be able to see all credentials." Confirm — does that mean:
   - (a) Any user with role >= CLIENT_ADMIN sees all credentials org-
     wide? (current proposal)
   - (b) CLIENT_OWNER only — admins need explicit grant?
   - (c) Some other tier?
2. **Leasing agents:** should LEASING_AGENT see credentials for their
   permitted property by default, or be denied unless an admin
   explicitly shares a credential? (Phase 2 question, but worth
   confirming Phase 1 default.)
3. **Import format:** is 1Password CSV the right starting format, or
   should we also accept Bitwarden / LastPass / Google PW Manager
   export formats? (Bitwarden's JSON would be cleanest.)
4. **Per-property mandatory:** should every credential be required to
   pick a property, or is org-wide the default? Norman's text suggests
   per-property is the dominant model but it's "kind of annoying."
   Proposal: optional property, default to org-wide, big "scope to
   property" toggle in the editor.
5. **2FA on reveal:** Phase 2 or do we want it in Phase 1? Adds ~2
   days of work but the security story is dramatically better.

## 13. Risks

- **Crypto correctness:** any bug in encryption is catastrophic.
  Mitigation: small, well-tested module; treat the crypto file as a
  security boundary; reuse Node's built-in `crypto` instead of a
  third-party lib.
- **Operator pastes a real .env into CSV import:** mitigated by the
  preview step and the fact that .env doesn't look like CSV.
- **Insider threat:** any admin can read everything. Mitigated by
  audit log; addressed long-term by Phase 2 2FA-on-reveal.
- **Backup hygiene:** must verify Neon backups don't include
  decrypted snapshots anywhere (they don't — Neon stores PostgreSQL
  rows verbatim).
- **Legal:** storing customer passwords for third-party platforms
  creates a security responsibility. Update privacy policy + ToS
  before GA.

## 14. Success metrics

- 30% of orgs adopt the vault within 60 days of launch
- ≥10 credentials/org median by day 30
- Zero plaintext leaks (every reveal logged)
- < 5 sec p95 reveal latency
- Customer NPS comments mention "central credentials" positively

---

**Decision point for Adam:** confirm the open questions in §12, then
I'll ship Phase 1 (~5-7 days of work).
