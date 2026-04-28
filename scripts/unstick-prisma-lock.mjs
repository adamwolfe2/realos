#!/usr/bin/env node
// ---------------------------------------------------------------------------
// scripts/unstick-prisma-lock.mjs
//
// One-shot to recover from `Error: P1002 ... Timed out trying to acquire a
// postgres advisory lock (SELECT pg_advisory_lock(72707369))` during
// `prisma migrate deploy`.
//
// Root cause: a prior `prisma migrate deploy` that ran through Neon's
// `-pooler` endpoint (pgBouncer-style) grabbed Prisma's session-scoped
// migration advisory lock, then the connection got returned to the pool
// without releasing the lock. Every subsequent migrate hangs trying to
// acquire the same lock and times out at 10s.
//
// What this script does (against the DIRECT non-pooled URL):
//   1. Find pg_stat_activity rows whose backend currently holds advisory
//      lock 72707369. Kill them with pg_terminate_backend so the lock is
//      released.
//   2. Print any half-applied migrations.
//   3. Verify the lock is gone.
//
// Usage:
//   node scripts/unstick-prisma-lock.mjs
//
// Reads DATABASE_URL (or DIRECT_DATABASE_URL) from .env.local. Auto-strips
// `-pooler` from the host so we hit Neon's direct endpoint.
//
// Then run `pnpm exec prisma migrate deploy` to apply pending migrations.
// ---------------------------------------------------------------------------

import "dotenv/config";
import { neon, neonConfig } from "@neondatabase/serverless";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });
loadDotenv({ path: ".env" });

const PRISMA_LOCK_KEY = 72707369;

function resolveDirectUrl() {
  const direct =
    process.env.DIRECT_DATABASE_URL || process.env.DIRECT_URL;
  if (direct) return direct;
  const pooled = process.env.DATABASE_URL;
  if (!pooled) {
    throw new Error("Set DATABASE_URL or DIRECT_DATABASE_URL in .env.local");
  }
  return pooled.replace(/-pooler\./, ".");
}

async function main() {
  const connectionString = resolveDirectUrl();
  console.log(
    `Connecting: ${connectionString.replace(/:[^:@/]+@/, ":***@")}`,
  );

  // Use the Neon HTTP driver (already in deps). It runs each query as its
  // own request — fine for the diagnostic queries here.
  neonConfig.fetchConnectionCache = true;
  const sql = neon(connectionString);

  // 1. Find sessions holding the Prisma migration advisory lock.
  const lockHolders = await sql`
    SELECT
      a.pid,
      a.usename,
      a.application_name,
      a.state,
      a.state_change
    FROM pg_locks l
    JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE l.locktype = 'advisory'
      AND l.objid = ${PRISMA_LOCK_KEY}
  `;

  if (lockHolders.length === 0) {
    console.log("No sessions currently holding the Prisma migration lock.");
  } else {
    console.log(`Found ${lockHolders.length} session(s) holding the lock:`);
    for (const row of lockHolders) {
      console.log(
        `  pid=${row.pid} app=${row.application_name} state=${row.state} since=${row.state_change}`,
      );
      const kill = await sql`SELECT pg_terminate_backend(${row.pid}) AS terminated`;
      console.log(`    -> terminated: ${kill[0].terminated}`);
    }
  }

  // 2. Half-applied migrations.
  try {
    const stuck = await sql`
      SELECT migration_name, started_at, finished_at, applied_steps_count
      FROM _prisma_migrations
      WHERE finished_at IS NULL
      ORDER BY started_at DESC
    `;
    if (stuck.length === 0) {
      console.log("No half-applied migrations in _prisma_migrations.");
    } else {
      console.log(
        `Found ${stuck.length} migration(s) with finished_at IS NULL:`,
      );
      for (const m of stuck) {
        console.log(`  ${m.migration_name} (started ${m.started_at})`);
      }
    }
  } catch (err) {
    console.log(
      `(_prisma_migrations table not present yet: ${err.message ?? err})`,
    );
  }

  // 3. Verify lock is gone.
  const recheck = await sql`
    SELECT COUNT(*)::int AS n
    FROM pg_locks
    WHERE locktype = 'advisory' AND objid = ${PRISMA_LOCK_KEY}
  `;
  console.log(`Advisory lock holders remaining: ${recheck[0].n}`);

  console.log("\nDone. You can now run: pnpm exec prisma migrate deploy");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
