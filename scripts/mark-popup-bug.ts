import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  // #92 and #93 — both were really one root cause: cross-origin CORS broken on the apex redirect.
  const note = `ROOT CAUSE FOUND. The popup never showed on telegraphcommons.com because the embed script's config fetch was being blocked by CORS. Smoking gun (Chrome console on https://www.telegraphcommons.com): "Access to fetch at 'https://leasestack.co/api/public/popup/config/telegraph-commons' from origin 'https://www.telegraphcommons.com' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource."

The install snippet hits the APEX leasestack.co (because NEXT_PUBLIC_APP_URL is set to the apex). Vercel auto-redirects apex → www with HTTP 307. Those redirect responses do NOT carry Access-Control-Allow-Origin headers. The route handler at /api/public/popup/config/[slug] DOES set CORS correctly, but the browser never reaches it — it aborts on the redirect.

Result: TC has had exactly 1 SHOWN event in 2 days despite real traffic. The single SHOWN was probably a tab that already had a cached config response from when CORS happened to work.

Fix shipped (3 layers):
1. public/embed/popup.js — runtime guard rewrites apex 'leasestack.co' → 'www.leasestack.co' BEFORE deriving API_ORIGIN. Existing installs (like TC) start working as soon as the new script is deployed, no operator action required.
2. public/embed/chatbot.js — same fix (same redirect, same blast radius). The chatbot has been silently failing on the apex host too, just less visibly because the embed degrades to "no chatbot" instead of "wrong UI."
3. app/portal/popups/[id]/page.tsx + app/portal/chatbot/page.tsx — install-snippet generators now rewrite the snippet host to the www form so future installs are CORS-safe out of the box without depending on the runtime guard.

Verification: curl with Origin: https://www.telegraphcommons.com against the www host now returns 'access-control-allow-origin: *' on the actual response body (no redirect). Headless browser test confirmed the bug reproduced on apex, and the fix path resolves it.`;

  for (const num of [92, 93]) {
    const b = await prisma.bugReport.findFirst({ where: { githubIssueNumber: num } });
    if (!b) { console.log(`#${num} not found`); continue; }
    const tl = Array.isArray(b.timeline) ? (b.timeline as any[]) : [];
    tl.push({ at: new Date().toISOString(), by: "system", byEmail: "demo-prep@leasestack.co", kind: "status", from: b.status, to: "FIXED", text: note });
    await prisma.bugReport.update({ where: { id: b.id }, data: { status: "FIXED", resolutionNote: note, timeline: tl as any } });
    console.log(`#${num} -> FIXED`);
  }
  await prisma.$disconnect();
})();
