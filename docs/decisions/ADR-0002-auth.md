# ADR-0002: Authentication with Clerk

**Status:** Accepted
**Date:** 2026-02-23

## Context

The MVP has mock auth (hardcoded "ritzcarlton" username stored in sessionStorage). We need real auth with:
- Email/password + social login
- Role-based access (CLIENT, SALES_REP, OPS, ADMIN)
- SSR-compatible middleware for route protection
- Organization/company support for B2B

## Decision

Use **Clerk** for authentication and authorization.

## Rationale

1. **Speed**: Pre-built UI components, 15-minute setup
2. **Middleware**: `clerkMiddleware()` protects routes at the edge
3. **Organizations**: Built-in support for company accounts (matches our Organization model)
4. **Roles**: Custom metadata for role-based access
5. **Webhooks**: User sync to our database
6. **Free tier**: 10,000 MAU — more than enough for 342 B2B accounts

## Alternatives Considered

- **NextAuth**: More flexible but requires more setup. No hosted UI. Self-managed sessions.
- **Supabase Auth**: Good if using Supabase, but we chose Neon.
- **Custom auth**: Maximum flexibility but months of work for session management, password reset, 2FA.

## Implementation

- Clerk middleware in `middleware.ts`
- Route groups: `(marketing)` = public, `(app)` = requires auth
- User role stored in Clerk public metadata
- Webhook syncs Clerk user → `User` table in DB
