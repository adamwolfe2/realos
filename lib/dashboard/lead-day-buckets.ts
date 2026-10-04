import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

// Rolling-window daily lead counts per property, aggregated in Postgres.
// Bucket semantics mirror the old JS dayBucketIndex: idx = W-1-floor(age/day),
// future rows clamp to the last bucket, rows older than W days are dropped.
// Returns propertyId -> W-length array (properties with no rows are absent).
export async function leadDayBucketsByProperty(args: {
  orgId: string;
  propertyIds: string[];
  column: "createdAt" | "firstSeenAt";
  windowDays: number;
  now?: Date;
}): Promise<Map<string, number[]>> {
  const { orgId, propertyIds, column, windowDays } = args;
  const out = new Map<string, number[]>();
  if (propertyIds.length === 0) return out;
  const now = args.now ?? new Date();
  const since = new Date(now.getTime() - windowDays * DAY_MS);
  const col = Prisma.raw(`"${column}"`);
  const nowUtc = Prisma.sql`(${now}::timestamptz at time zone 'UTC')`;

  const rows = await prisma.$queryRaw<
    Array<{ propertyId: string; idx: number; n: bigint }>
  >(Prisma.sql`
    select "propertyId", (${windowDays}::int - 1 - days_ago)::int as idx, count(*) as n
    from (
      select "propertyId",
        greatest(floor(extract(epoch from (${nowUtc} - ${col})) / 86400), 0)::int as days_ago
      from "Lead"
      where "orgId" = ${orgId}
        and "propertyId" in (${Prisma.join(propertyIds)})
        and ${col} >= (${since}::timestamptz at time zone 'UTC')
    ) t
    group by 1, 2`);

  for (const r of rows) {
    const idx = Number(r.idx);
    if (idx < 0 || idx >= windowDays) continue;
    const arr = out.get(r.propertyId) ?? new Array<number>(windowDays).fill(0);
    arr[idx] += Number(r.n);
    out.set(r.propertyId, arr);
  }
  return out;
}
