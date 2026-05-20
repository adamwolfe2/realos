# SG Real Estate — Embed Install Guide

Goal: install the LeaseStack **chatbot** and **popup** embeds on SG Real Estate's marketing site so leads flow into the SG org in LeaseStack within 30 seconds of submission.

SG's tenant slug is **`sg-real-estate`** (the canonical `Organization.slug`). All embed scoping is by this slug; no API keys are required (the embeds are public, slug-scoped, server-resolved, and rate-limited).

If SG has multiple properties under one org (e.g. a Telegraph Commons-style multi-building setup), append a property slug to scope the chatbot to a single building.

---

## 1. Chatbot snippet (paste in `<head>`)

```html
<script
  src="https://www.leasestack.co/embed/chatbot.js"
  data-slug="sg-real-estate"
  defer
></script>
```

- Mounts the AI leasing assistant bubble in the bottom-right corner.
- Reads live config from `/api/public/chatbot/config?slug=sg-real-estate` (cached 60s at the CDN edge — operator edits in `/portal/chatbot` propagate within one minute).
- Captures leads either pre-chat (intro form) or mid-conversation (extractor). Both paths fire the operator's primary-contact email **and** the in-app bell notification in `/portal`.
- Shadow DOM isolates all styles; no CSS collisions with the SG site.

To scope to a specific property (e.g. `1100-yosemite`):

```html
<script
  src="https://www.leasestack.co/embed/chatbot.js"
  data-slug="1100-yosemite"
  defer
></script>
```

The chatbot endpoint resolves the slug against `Property.slug` first and falls back to `Organization.slug`, so a single property slug works as the data-slug value when the org and property are uniquely identified by it.

---

## 2. Popup snippet (paste before `</body>`)

```html
<script
  async
  src="https://www.leasestack.co/embed/popup.js"
  data-tenant="sg-real-estate"
></script>
```

Scope to a single property:

```html
<script
  async
  src="https://www.leasestack.co/embed/popup.js"
  data-tenant="sg-real-estate"
  data-property="1100-yosemite"
></script>
```

- Fetches `/api/public/popup/config/sg-real-estate?property=…` and renders any **ACTIVE** popup campaign whose URL targeting matches.
- Exit-intent, scroll-depth, time-on-page, idle-time, and immediate triggers all supported.
- Lead submission `POST /api/public/popup/lead`:
  - Creates a `Lead` (source = `FORM`, sourceDetail = `popup:<popupId>`).
  - Fires Slack notification + tenant Resend email + in-app bell.
  - Records a `CONVERTED` PopupEvent atomically with the lead.
  - Bumps a matched `Visitor` to `MATCHED_TO_LEAD` for attribution.

---

## 3. Replacing the OLD popup embed

If SG's site has an older popup script (likely from a Wholesail/Cursive template), find and remove it. Search-and-replace patterns:

```bash
# Search SG's site source for any of:
grep -rE "popup\.js|popup-embed|wholesail.*popup|cursive.*popup" .

# Replace with the LeaseStack tag:
<script async src="https://www.leasestack.co/embed/popup.js" data-tenant="sg-real-estate"></script>
```

Anything not pointing at `www.leasestack.co/embed/popup.js` should be deleted. The LeaseStack popup is the only one that posts back to SG's org in `/portal/leads`.

---

## 4. Verification (do this before Friday)

### 4.1 Chatbot

1. Open SG's marketing site in an incognito window. Open DevTools → Network.
2. Expect requests:
   - `GET /api/public/chatbot/config?slug=sg-real-estate` → 200 with `{ enabled: true, … }`
   - `GET /api/public/chatbot/listings-summary?slug=sg-real-estate` → 200
3. Click the bubble, send a message. Expect:
   - `POST /api/public/chatbot/chat` → 200 (streaming)
4. Trigger lead capture (either intro form or type "my name is Test and email me at test@example.com"). Expect:
   - `POST /api/public/chatbot/lead` → 201 (pre-chat path), **or**
   - lead extracted mid-conversation during the next `/chat` call.
5. Within 30 seconds, verify in LeaseStack:
   - `/portal/leads` shows the new lead with `source = chatbot`.
   - Bell icon in `/portal` shows the new chatbot lead notification.
   - Primary contact email (set in `/portal/settings`) receives the Resend lead email.

### 4.2 Popup

1. Reload SG's marketing site. DevTools → Network:
   - `GET /api/public/popup/config/sg-real-estate` → 200 with `{ ok: true, popups: [...] }`
2. Trigger the popup (move mouse to top edge for exit intent, or wait for the configured trigger).
   - `POST /api/public/popup/events` → records `SHOWN`.
3. Fill the form, submit:
   - `POST /api/public/popup/lead` → 201 with `{ ok: true, leadId: "…" }`.
4. Within 30 seconds:
   - `/portal/leads` shows the lead, `source = FORM`, `sourceDetail = popup:<popupId>`.
   - `/portal/popups/<popupId>` shows the converted count incremented.
   - Bell + Resend + Slack notifications all fire.

### 4.3 Production smoke-test cURLs

Run these against production (`www.leasestack.co`) — no auth required, slug-scoped.

```bash
# Chatbot config (expect enabled:true)
curl -s "https://www.leasestack.co/api/public/chatbot/config?slug=sg-real-estate" | jq

# Chatbot pre-chat lead capture
curl -s -X POST "https://www.leasestack.co/api/public/chatbot/lead" \
  -H "Content-Type: application/json" \
  -H "Origin: https://sgrealestate.com" \
  -d '{
    "slug": "sg-real-estate",
    "firstName": "Smoke Test",
    "email": "smoke+chatbot@leasestack.co",
    "pageUrl": "https://sgrealestate.com/"
  }' | jq

# Popup config
curl -s "https://www.leasestack.co/api/public/popup/config/sg-real-estate" | jq

# Popup lead (replace <popupId> with the id from /portal/popups)
curl -s -X POST "https://www.leasestack.co/api/public/popup/lead" \
  -H "Content-Type: application/json" \
  -H "Origin: https://sgrealestate.com" \
  -d '{
    "tenantSlug": "sg-real-estate",
    "popupId": "<popupId>",
    "email": "smoke+popup@leasestack.co",
    "pageUrl": "https://sgrealestate.com/"
  }' | jq
```

After running, verify both `smoke+chatbot@leasestack.co` and `smoke+popup@leasestack.co` appear in `/portal/leads` and delete them.

---

## 5. Security & ops notes

- **CORS:** all public embed endpoints set `Access-Control-Allow-Origin: *` (intentional — the embed runs on arbitrary domains). No credentials are sent and no sensitive data is exposed in responses; `orgId`/`propertyId` are only echoed back to the embed that already knows the slug.
- **Rate limiting:**
  - `chatbotConfigLimiter`: 600 req/min/IP on config + popup-config (defense-in-depth on top of CDN cache hits).
  - `publicApiLimiter`: 60 req/min/IP on `/chat`, `/lead`, `/events`.
  - `publicSignupLimiter`: 5 req/hour/IP on `/popup/lead` (anti-flood).
- **Server-side resolution:** the embed never sends `orgId`. The slug is resolved server-side via `Organization.slug`, so a malicious site can't forge conversions against another tenant.
- **Module gating:** if `org.moduleChatbot` / `org.modulePopups` is false (e.g. SG cancels), the endpoints return `{ enabled: false }` / `{ popups: [] }` and the embed silently no-ops — no broken UI on the host site.
- **Attribution:** chatbot leads have `LeadSource.CHATBOT`; popup leads have `LeadSource.FORM` with `sourceDetail = popup:<id>`. The `/portal/leads` source filter handles both.

---

## 6. Diagnosing "chatbot doesn't appear" on a tenant site

If the script loads (200) and `window.__leasestackChatbotLoaded === true` but no widget renders, hit the config endpoint directly in the browser:

```
https://www.leasestack.co/api/public/chatbot/config?slug=<tenant-slug>
```

- **`{ enabled: true, ... }`** — config is good, the widget should render. Check for CSS conflicts (the shadow DOM should isolate, but a host page CSP without `style-src 'unsafe-inline'` can block the inline `<style>` injected into the shadow root).
- **`{ enabled: false }`** — either `org.moduleChatbot === false`, `tenantSiteConfig.chatbotEnabled === false`, or slug doesn't match any org. Toggle the module ON in `/admin/clients/<id>` and verify `slug` matches `Organization.slug` exactly.
- **HTTP 429 `{ error: "Rate limit exceeded" }`** — the embed now retries with backoff (1s → 2s → 4s, capped at 3 attempts) and surfaces a clear console warning if it persists. Most often this means `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` aren't set in Vercel env; the soft-fallback in-memory limiter degrades from "100% blocked" to "single-instance limited" so the widget usually still loads.
- **HTTP 5xx** — check `/api/public/chatbot/config` logs in Vercel; the DB read is wrapped in try/catch that returns `{ enabled: false }` on failure, so a 5xx implies a deeper outage.

**Upstash env check** (do this if any rate-limited endpoint behaves weirdly):
```
vercel env ls production | grep -E "UPSTASH|KV_REST"
```
Both `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or the Vercel KV equivalents `KV_REST_API_URL` + `KV_REST_API_TOKEN`) MUST be set in production. Without them, security-critical endpoints (auth, checkout, webhooks) fail closed and public widget endpoints degrade to in-memory rate limiting.
