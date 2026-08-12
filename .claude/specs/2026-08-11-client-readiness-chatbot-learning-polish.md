# Client Readiness Chatbot Learning Polish

## Brief

Improve the chatbot learning workflow so a client reviewing the SG portfolio can understand what changed, what is urgent, and what is safe to act on without operator explanation.

## Scope

- Surface learning freshness and automation state on `/portal/conversations/insights`.
- Make follow-up task counts more operational: overdue, due today, high priority.
- Improve AI follow-up task cards with readable task/channel labels and draft character counts.
- Make manual learning pass results more specific.
- Keep all AI changes human-reviewed. No auto-send and no automatic chatbot/site mutation.

## Non-Goals

- No schema changes.
- No billing, auth, or webhook changes.
- No new LLM calls beyond the existing learning loop.

## Verification

- Focused Vitest coverage for learning summary/run action behavior.
- ESLint on touched files.
- TypeScript.
- Production build before shipping.
