// Impersonate a tenant org (e.g. Telegraph Commons), then capture
// every portal route AS that org. Run after login.mjs.
//
// Usage:
//   AUDIT_BASE_URL=https://leasestack.co \
//   AUDIT_TENANT_HINT=Telegraph node scripts/portal-audit/capture-as-tenant.mjs

import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.AUDIT_BASE_URL || "https://leasestack.co";
const TENANT_HINT = process.env.AUDIT_TENANT_HINT || "Telegraph";
const ROOT = path.resolve(".claude/audits/2026-06-03-portal");
const PROFILE_DIR = path.join(ROOT, ".auth/profile");
const ROUTES_PATH = path.join(ROOT, "routes.json");
const SHOT_DIR = path.join(ROOT, "screenshots-as-tenant");
const MANIFEST_PATH = path.join(ROOT, "tenant-capture-manifest.json");

function slugify(s) {
  return s.replace(/^\//, "").replace(/[\/ &]+/g, "_") || "root";
}

async function main() {
  const routesJson = JSON.parse(await readFile(ROUTES_PATH, "utf8"));
  const manifest = { startedAt: new Date().toISOString(), results: [] };

  const isLocal = /localhost|127\.0\.0\.1/.test(BASE_URL);
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: isLocal
      ? [
          "--host-resolver-rules=MAP *.leasestack.co 127.0.0.1, MAP leasestack.co 127.0.0.1",
        ]
      : [],
  });
  const page = context.pages()[0] ?? (await context.newPage());

  // --- Step 1: load /admin/clients, extract Telegraph Commons orgId -------
  console.log(`Loading ${BASE_URL}/admin/clients ...`);
  await page.goto(`${BASE_URL}/admin/clients`, { waitUntil: "networkidle" });
  if (/\/sign-in/.test(page.url())) {
    console.error("AUTH LOST — re-run login.mjs.");
    await context.close();
    process.exit(2);
  }

  const orgId = await page.evaluate((hint) => {
    // Anchors that link to /admin/clients/<id> next to text matching hint.
    const anchors = Array.from(document.querySelectorAll("a[href*='/admin/clients/']"));
    for (const a of anchors) {
      const m = a.getAttribute("href")?.match(/\/admin\/clients\/([^/?#]+)/);
      if (!m) continue;
      // Find row containing the hint by walking up from anchor.
      let el = a;
      for (let i = 0; i < 6 && el; i++) {
        if ((el.textContent || "").toLowerCase().includes(hint.toLowerCase())) {
          return m[1];
        }
        el = el.parentElement;
      }
    }
    return null;
  }, TENANT_HINT);

  if (!orgId) {
    console.error(
      `Could not find a tenant matching '${TENANT_HINT}' on /admin/clients.`,
    );
    await context.close();
    process.exit(3);
  }
  console.log(`Found tenant orgId: ${orgId}`);

  // --- Step 2: POST /api/admin/impersonate/start --------------------------
  console.log("Starting impersonation ...");
  const startResp = await page.evaluate(async (id) => {
    const r = await fetch("/api/admin/impersonate/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: id }),
    });
    return { status: r.status, body: await r.text() };
  }, orgId);
  console.log("Impersonate start:", startResp.status, startResp.body.slice(0, 200));
  if (startResp.status !== 200) {
    console.error("Impersonation failed.");
    await context.close();
    process.exit(4);
  }

  // Clerk metadata propagation can take a beat — give it 2s.
  await page.waitForTimeout(2000);

  // --- Step 3: full route capture pass ------------------------------------
  for (const group of routesJson.groups) {
    const groupDir = path.join(SHOT_DIR, slugify(group.name));
    await mkdir(groupDir, { recursive: true });

    for (const route of group.routes) {
      const slug = slugify(route);
      const file = path.join(groupDir, `${slug}.png`);
      const t0 = Date.now();
      let status = "ok";
      let httpStatus = 0;
      let title = "";
      let error = null;
      let finalUrl = "";

      try {
        const response = await page.goto(`${BASE_URL}${route}`, {
          waitUntil: "networkidle",
          timeout: 30_000,
        });
        httpStatus = response?.status() ?? 0;
        finalUrl = page.url();
        if (/\/sign-in/.test(finalUrl)) {
          status = "auth-lost";
        } else {
          await page.waitForTimeout(800);
          title = await page.title();
          await page.screenshot({ path: file, fullPage: true });
        }
      } catch (err) {
        status = "error";
        error = err.message;
      }

      const ms = Date.now() - t0;
      manifest.results.push({
        group: group.name,
        route,
        file: path.relative(ROOT, file),
        httpStatus,
        title,
        status,
        error,
        finalUrl,
        ms,
      });
      const tag =
        status === "ok" ? "OK" : status === "auth-lost" ? "AUTH" : "ERR";
      console.log(
        `[${tag}] ${route} (${httpStatus}, ${ms}ms)${error ? " — " + error : ""}`,
      );
    }
  }

  // --- Step 4: end impersonation ------------------------------------------
  console.log("Ending impersonation ...");
  await page.evaluate(async () => {
    await fetch("/api/admin/impersonate/end", { method: "POST" });
  });

  manifest.tenantOrgId = orgId;
  manifest.finishedAt = new Date().toISOString();
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest: ${MANIFEST_PATH}`);
  await context.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
