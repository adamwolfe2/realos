@~/.codex/AGENTS.md

# AGENTS.md — LeaseStack

Leasing intelligence platform (track, not manage). www.leasestack.co
github.com/adamwolfe2/realos · Ship: `cap`. Review: `dual-review`.

## Stack (verified package.json)
- Next.js 16.2 + React (name: leasestack)
- Prisma 7.4 client + @prisma/adapter-neon / Neon
- Auth: Clerk (@clerk/nextjs 7.3)
- Anthropic · DataForSEO · Tavily · Stripe · Resend · Upstash · Sentry · Tiptap · react-pdf · simple-icons
- pnpm

## Design Tokens
- Norman-brief polish. Light only. NO dark. NO emojis (Lucide icons).

## Tier-1 Surfaces (Claude `safe-feature-slice` first)
- Stripe billing + webhooks · Clerk auth · lead capture (/audit magnet) · lead-notify

## Commands
- Dev: `pnpm dev` (tmux) · Build: `pnpm build` · Ship: `cap`

## Gotchas
- Repo is "realos", domain is leasestack.co. Key customer: Telegraph Commons / SG Real Estate (Norman Gensinger).
- Track NOT manage — copy frames everything as tracking/intel, never property management.
