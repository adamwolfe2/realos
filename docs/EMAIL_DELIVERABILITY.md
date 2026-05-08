# Email Deliverability — LeaseStack

Operator-facing checklist + code-level reference for keeping our transactional and broadcast email out of spam folders.

## What we ship in code (already done)

Every Resend send in this repo now passes through one of the helpers in `lib/email/` and includes:

- **`List-Unsubscribe` header** — `<mailto:unsubscribe@leasestack.co>` for transactional, plus `<https://leasestack.co/...>` for broadcast.
- **`List-Unsubscribe-Post: List-Unsubscribe=One-Click`** on broadcast — RFC 8058 compliance, what makes Gmail render the visible "Unsubscribe" button. Without this, Gmail throttles us to spam at scale.
- **`X-Entity-Ref-ID`** — opaque per-send ID; helps Resend dashboard analytics + receiving-server threading.
- **`tags: [{ template, category }]`** — Resend categorizes per-template stats so we can see "invite has 12% spam rate, fix that template" instead of an aggregate domain number.
- **Reply-To always brand-aligned** — `hello@leasestack.co` (not the inviter's gmail), avoids DMARC-alignment heuristics on the receiving side.
- **`<title>` element** + **preheader text** in every HTML body — small spam-scanner credit + better inbox preview.
- **Sentence-case CTAs** by default — `Set your password` not `SET YOUR PASSWORD`. All-caps + colored CTA reads as bulk to filters.
- **Subject lines** — invite is now `Your {Org} portal access is ready` instead of `{Inviter} invited you to {Org}`. The "invited you to" template phrase is a textbook trigger.

## What still needs DNS + Resend dashboard config

These require touching DNS records on `leasestack.co` and the Resend dashboard. Code can't fix them.

### 1. Verify a dedicated sending subdomain in Resend (highest impact)

Currently we send from `hello@leasestack.co` — the apex domain. Best practice is to isolate transactional mail on a subdomain so it doesn't share reputation with marketing/customer mail.

**Action:**
- In Resend dashboard → Domains → Add Domain → enter `mail.leasestack.co` (or `send.leasestack.co`).
- Resend gives you 3 DNS records to add:
  - `MX` (SPF will check return path)
  - `TXT` for SPF: `v=spf1 include:amazonses.com ~all` (or whatever Resend specifies)
  - 2× `CNAME` for DKIM (e.g. `resend._domainkey.mail.leasestack.co`)
- Add those to the leasestack.co DNS (Cloudflare/Vercel/wherever it's managed).
- Wait for verification (~1 hour to 24 hours).
- Once verified, set `RESEND_FROM_EMAIL=LeaseStack <hello@mail.leasestack.co>` in Vercel env vars for production. Code picks it up automatically.

### 2. Add a DMARC record on leasestack.co

DMARC tells receiving servers what to do when SPF/DKIM fails. Required for Gmail bulk-mail compliance (Gmail's Feb 2024 sender requirements).

**Action — add this TXT record:**

```
Name:  _dmarc.leasestack.co
Type:  TXT
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@leasestack.co; ruf=mailto:dmarc@leasestack.co; fo=1; aspf=r; adkim=r
```

Start with `p=quarantine` (suspicious mail goes to spam). After 30 days of clean reports, tighten to `p=reject` (suspicious mail bounces).

Set up `dmarc@leasestack.co` as a real or forwarded mailbox so you actually receive the daily aggregate reports — they'll tell you exactly what's failing.

### 3. Set up `unsubscribe@leasestack.co` mailbox

The `List-Unsubscribe` header in every email points here. When recipients hit "Unsubscribe" in Gmail (mailto fallback), their mail client emails this address. We need it to actually receive mail.

**Options:**
1. **Easiest**: Set up a Gmail / Google Workspace forwarder from `unsubscribe@leasestack.co` → `hello@leasestack.co` so they all land in the same inbox. Manually unsubscribe people who write in.
2. **Better**: A small inbound parser (Resend supports inbound, or use SendGrid Inbound Parse) that auto-records the suppression in our DB. Not built yet — currently a manual process.

### 4. Verify DNS records actually point at the right thing

Run these three checks from the command line (or use https://mxtoolbox.com):

```bash
# SPF — should return v=spf1 include:amazonses.com ~all (or similar)
dig TXT leasestack.co | grep -i spf

# DKIM (for the apex; check the subdomain you're sending from too)
dig CNAME resend._domainkey.leasestack.co

# DMARC
dig TXT _dmarc.leasestack.co
```

All three should resolve. If any return NXDOMAIN, that's why Norman's invite went to spam.

### 5. Disable Resend click-tracking until reputation is established

Resend wraps every link in your email through a `track.resend.com` redirect by default. On a new sending domain, that wrapper is a deliverability hit — receiving filters associate the redirect with bulk patterns.

**Action — Resend dashboard:**
- Settings → Tracking
- Toggle **off** "Click tracking" until the domain has 30+ days of clean sends.
- (Open tracking is fine to leave on — it's a 1×1 pixel and most filters don't penalize it.)

Once we have 30 days of inbox placement (check Resend dashboard → Sends → look at the bounce/complaint rate), turn click tracking back on.

### 6. Warm up the sending domain

A brand-new domain sending to a fresh recipient (Gmail), with no prior sending history, is the worst-case spam scenario. Gmail aggressively filters new senders.

**Action — gradual ramp:**
- Week 1: send no more than 50 emails/day, all to recipients who actually engage (open/click).
- Week 2: 200/day.
- Week 3: 500/day.
- Week 4+: as much as you need.

For now, send the invite email to a Gmail address you control first, mark it as "Not spam," reply to it. Then send the real invite from the same sender. Gmail's reputation cache will note that interaction.

### 7. Tell Norman to whitelist `hello@leasestack.co`

If the invite still goes to spam after the above, send Norman a Slack message:

> Hey, our invite email landed in your spam folder — Gmail is being aggressive on new senders. Can you mark it as "Not spam" and add `hello@leasestack.co` to your contacts? That'll fix it for future emails.

## Code references

- `lib/email/shared.ts` — `sendBrandedEmail()` helper (centralized), `buildBaseHtml()` with `<title>` + preheader + sentence-case CTA support, `escapeHtml()`
- `lib/email/onboarding-emails.ts` — invite email rewritten with subject "Your {Org} portal access is ready", preheader, sentence-case CTA "Set your password"
- `lib/email/lead-emails.ts`, `lib/email/visitor-emails.ts`, `lib/email/pixel-emails.ts`, `lib/email/lead-sequences.ts`, `lib/email/review-request.ts`, `lib/email/send-report.ts` — all updated with deliverability headers + tags

## Quick deliverability audit

After applying DNS changes, run any of:

- **mail-tester.com** — send a test email to the address it gives you. Returns a 0–10 score with specific failure reasons. Aim for 9+.
- **glockapps.com** — paid but tells you exactly which inboxes (Gmail, Outlook, Yahoo) you're landing in vs spam.
- **Resend dashboard** → Sends → check the per-template bounce rate and complaint rate. Anything > 2% complaints = problem.
