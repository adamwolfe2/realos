/**
 * Fire a fresh AEO scan for Telegraph Commons specifically — bypasses
 * the public cron route (which we can't hit locally due to CRON_SECRET
 * having literal "\n" on Vercel from a paste corruption). Calls
 * runAeoScan() directly with all configured engines.
 *
 * Run with:
 *   DATABASE_URL=... ANTHROPIC_API_KEY=... OPENAI_API_KEY=... \
 *     PERPLEXITY_API_KEY=... GEMINI_API_KEY=... \
 *     NODE_OPTIONS="--conditions=react-server" \
 *     pnpm exec tsx scripts/run-tc-aeo-scan.ts
 */

import { runAeoScan } from "../lib/aeo/orchestrate";
import { getEnabledEngines } from "../lib/aeo/engines";

const ORG_ID = "cmo402dwz0002c93lf3okkgi0"; // SG Real Estate

(async () => {
  const engines = getEnabledEngines();
  console.log(
    `Engines configured: ${engines.map((e) => e.engine).join(", ") || "(none)"}`,
  );
  if (engines.length === 0) {
    console.error("No engines configured. Check API keys.");
    process.exit(1);
  }

  console.log(`Running AEO scan for org ${ORG_ID} across ${engines.length} engines…`);
  const start = Date.now();
  const result = await runAeoScan({ orgId: ORG_ID, engines });
  console.log(
    `\nFinished in ${((Date.now() - start) / 1000).toFixed(1)}s.`,
  );
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
