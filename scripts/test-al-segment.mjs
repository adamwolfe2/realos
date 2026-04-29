// Quick verification: hit AL with the demo org's saved key and the
// supplied segment ID. Reports status, member count on first page, and
// the raw meta keys AL returns.
//
// Run: pnpm tsx scripts/test-al-segment.mjs <segment-id>

import "dotenv/config";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const segmentId = process.argv[2];
if (!segmentId) {
  console.error("Usage: pnpm tsx scripts/test-al-segment.mjs <segment-id>");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
const encryptionKey = process.env.ENCRYPTION_KEY;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

function decrypt(payload) {
  if (!payload || !encryptionKey) return null;
  try {
    const key = Buffer.from(encryptionKey, "hex");
    const buf = Buffer.from(payload, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
      "utf8",
    );
  } catch (err) {
    return null;
  }
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

const org = await prisma.organization.findUnique({
  where: { slug: "audience-sync-demo" },
  select: { id: true, cursiveApiKeyOverride: true },
});
if (!org) {
  console.error("audience-sync-demo org not found");
  process.exit(1);
}

const overrideKey = decrypt(org.cursiveApiKeyOverride);
const key = overrideKey ?? process.env.CURSIVE_API_KEY ?? null;
if (!key) {
  console.error("No AL key found (no override, no platform CURSIVE_API_KEY).");
  process.exit(1);
}
console.log(
  "Using key:",
  overrideKey ? "ORG_OVERRIDE" : "PLATFORM_DEFAULT",
  `(last 4: ${key.slice(-4)})`,
);

const base = process.env.CURSIVE_API_URL ?? "https://api.audiencelab.io";
const url = `${base}/segments/${encodeURIComponent(segmentId)}?page=1&page_size=3`;
console.log("Hitting:", url);

const start = Date.now();
const res = await fetch(url, {
  headers: { "X-Api-Key": key, Accept: "application/json" },
});
const ms = Date.now() - start;
const body = await res.text();
console.log("Status:", res.status, `(${ms}ms)`);

if (!res.ok) {
  console.error("Body:", body.slice(0, 500));
  process.exit(1);
}

let json;
try {
  json = JSON.parse(body);
} catch {
  console.error("Non-JSON response:", body.slice(0, 500));
  process.exit(1);
}

const arrays = Object.entries(json).filter(([_, v]) => Array.isArray(v));
const items = arrays.length > 0 ? arrays[0][1] : [];

console.log("Top-level keys:", Object.keys(json));
console.log(
  "Array detected on key:",
  arrays.length > 0 ? arrays[0][0] : "(none)",
);
console.log("First-page members returned:", items.length);
if (items[0]) {
  console.log(
    "Sample member field names:",
    Object.keys(items[0]).slice(0, 30),
  );
  // Censored sample to keep PII out of the log
  const sample = items[0];
  const censored = {};
  for (const [k, v] of Object.entries(sample)) {
    if (typeof v === "string" && v.length > 4) {
      censored[k] = v.slice(0, 2) + "***" + v.slice(-2);
    } else {
      censored[k] = v;
    }
  }
  console.log("Sample (censored):", censored);
}

await prisma.$disconnect();
