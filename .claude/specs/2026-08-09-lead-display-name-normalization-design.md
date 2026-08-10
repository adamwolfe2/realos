# Lead Display Name Normalization Design

Status: Approved design
Date: 2026-08-09

## Goal

Remove "Unknown lead" from operator-facing LeaseStack views when an email address provides a useful identity, while never overwriting captured or imported lead names.

## Design

- Add one shared display-name formatter for operator-facing lead surfaces.
- Prefer the stored first and last name whenever either is present.
- Otherwise infer a display label from the email local part:
  - split clear separators such as periods, underscores, and hyphens;
  - preserve a single alphabetic local part as one title-cased label;
  - reject role mailboxes and unusable numeric local parts as person names.
- When no person-like name can be inferred, show the email address. When no email exists, show "Unidentified lead".
- Mark inferred values as presentation-only. Do not write inferred names into `Lead.firstName` or `Lead.lastName`.
- Apply the formatter consistently to attribution, lead tables, activity feeds, review rows, exports, and other operator-facing lead summaries that currently create their own fallback.

## Guardrails

- Captured and PMS-provided names always win.
- Inferred names must never participate in matching, attribution, deduplication, notifications, personalization, or outbound messaging.
- The formatter is deterministic and has no network or AI dependency.
- Tenant and property scoping remain unchanged.

## Acceptance checks

- Common addresses such as `john.smith@`, `john_smith@`, and `john-smith@` render as "John Smith".
- An alphabetic address such as `phuongpham@` renders as "Phuongpham" instead of "Unknown lead".
- Role or numeric addresses render as their email address, not a fabricated person name.
- Stored names are never replaced by inferred values.
- Shared tests cover separators, capitalization, role mailboxes, numeric values, missing emails, and partial stored names.
