// Build guard for the 20260525_site_engine_intake migration.
//
// That migration failed partway on prod once, leaving a failed marker in
// _prisma_migrations that blocks every `prisma migrate deploy` with P3009.
// The migration is now idempotent, so it is safe to re-run — we just need to
// clear the failed marker first. This deletes ONLY an unfinished marker for
// that single migration, so once it applies cleanly this becomes a permanent
// no-op. Safe to delete this script + its vercel-build step after the next
// green deploy.
import { neon } from "@neondatabase/serverless";

const MIGRATION = "20260525_site_engine_intake";
const url = process.env.DATABASE_URL;

if (!url) {
  console.log("[heal] DATABASE_URL not set — skipping");
  process.exit(0);
}

try {
  const sql = neon(url);
  const rows = await sql`
    DELETE FROM "_prisma_migrations"
    WHERE migration_name = ${MIGRATION}
      AND finished_at IS NULL
    RETURNING id
  `;
  console.log(`[heal] cleared ${rows.length} failed "${MIGRATION}" marker(s)`);
} catch (err) {
  // Never block the build: if _prisma_migrations doesn't exist yet (fresh DB)
  // or the connection fails, let `prisma migrate deploy` surface the real error.
  console.log(`[heal] skipped (${err?.message ?? err})`);
}
