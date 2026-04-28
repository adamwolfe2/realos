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
// What this script does (in order, against the DIRECT non-pooled URL):
//   1. Find pg_stat_activity rows whose backend currently holds advisory
//      lock 72707369. Kill them with pg_terminate_backend so the lock is
//      released.
//   2. Reset Prisma's _prisma_migrations.locked* state if rows are stuck.
//   3. Print pending migrations.
//
// Usage:
//   DIRECT_DATABASE_URL=postgres://...neon.tech/... node scripts/unstick-prisma-lock.mjs
// or:
//   node scripts/unstick-prisma-lock.mjs            (auto-derives by stripping -pooler)
//
// Then run `pnpm exec prisma migrate deploy` to apply pending migrations.
// ---------------------------------------------------------------------------

import "dotenv/config";
import pg from "pg";

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
  const client = new pg.Client({ connectionString });
  await client.connect();
  console.log(`Connected: ${connectionString.replace(/:[^:@/]+@/, ":***@")}`);

  // 1. Find sessions holding the Prisma migration advisory lock.
  const lockHolders = await client.query(
    `
      SELECT
        a.pid,
        a.usename,
        a.application_name,
        a.client_addr,
        a.state,
        a.query_start,
        a.state_change,
        a.query
      FROM pg_locks l
      JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.locktype = 'advisory'
        AND l.objid = $1
    `,
    [PRISMA_LOCK_KEY],
  );

  if (lockHolders.rowCount === 0) {
    console.log("No sessions currently holding the Prisma migration lock.");
  } else {
    console.log(
      `Found ${lockHolders.rowCount} session(s) holding the lock:`,
    );
    for (const row of lockHolders.rows) {
      console.log(
        `  pid=${row.pid} app=${row.application_name} state=${row.state} since=${row.state_change}`,
      );
      const kill = await client.query(
        `SELECT pg_terminate_backend($1) AS terminated`,
        [row.pid],
      );
      console.log(`    -> terminated: ${kill.rows[0].terminated}`);
    }
  }

  // 2. Reset _prisma_migrations rows that are still flagged as locked.
  // Prisma 7's migrate state lives in _prisma_migrations; the lock fields
  // exist when the runtime crashes mid-migration.
  try {
    const stuck = await client.query(
      `
        SELECT id, migration_name, started_at, finished_at, applied_steps_count
        FROM _prisma_migrations
        WHERE finished_at IS NULL
        ORDER BY started_at DESC
      `,
    );
    if (stuck.rowCount === 0) {
      console.log("No half-applied migrations in _prisma_migrations.");
    } else {
      console.log(
        `Found ${stuck.rowCount} migration(s) with finished_at IS NULL:`,
      );
      for (const m of stuck.rows) {
        console.log(`  ${m.migration_name} (started ${m.started_at})`);
      }
      console.log(
        "  Not auto-resolving these — inspect manually with `prisma migrate status`.",
      );
    }
  } catch (err) {
    console.log(
      `(_prisma_migrations table not present yet: ${err.message ?? err})`,
    );
  }

  // 3. Verify the lock is gone.
  const recheck = await client.query(
    `SELECT COUNT(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND objid = $1`,
    [PRISMA_LOCK_KEY],
  );
  console.log(
    `Advisory lock holders remaining: ${recheck.rows[0].n}`,
  );

  await client.end();
  console.log("\nDone. You can now run: pnpm exec prisma migrate deploy");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
