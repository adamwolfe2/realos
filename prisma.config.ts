import * as dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local first (Next.js convention), then fall back to .env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

// Prisma migrations must NOT run through a pgBouncer-style pooler. Advisory
// locks don't survive the pooler boundary, so a previous migrate session
// returning its connection to the pool while still holding the migration
// lock causes every subsequent migrate to time out with P1002.
//
// Resolution order:
//   1. DIRECT_DATABASE_URL or DIRECT_URL if explicitly set (Neon's direct
//      endpoint, no `-pooler` in the hostname)
//   2. Auto-derive from DATABASE_URL by stripping `-pooler` from the host
//      (Neon's convention: pooled = `<id>-pooler.<region>...`,
//      direct = `<id>.<region>...`)
//   3. Fall back to DATABASE_URL as-is
function migrationUrl(): string | undefined {
  const direct = process.env["DIRECT_DATABASE_URL"] ?? process.env["DIRECT_URL"];
  if (direct) return direct;
  const pooled = process.env["DATABASE_URL"];
  if (!pooled) return undefined;
  // Match `-pooler.` in the hostname (Neon's convention) and strip it.
  return pooled.replace(/-pooler\./, ".");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl(),
  },
});
