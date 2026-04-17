import { NextRequest } from "next/server";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Parse cursor-based pagination params from a request URL.
 * Supports ?cursor=<id>&take=<number>
 */
export function parseCursorParams(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const rawTake = parseInt(searchParams.get("take") ?? "", 10);
  const take = Number.isFinite(rawTake)
    ? Math.min(Math.max(rawTake, 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  return { cursor, take };
}

/**
 * Build Prisma cursor args from parsed params.
 * Returns an object spread-ready for prisma.findMany().
 */
export function buildPrismaCursorArgs(cursor: string | undefined, take: number) {
  return {
    take: take + 1, // fetch one extra to detect hasMore
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  };
}

/**
 * Build a cursor-paginated response payload.
 * Expects items fetched with take+1 (one extra for hasMore detection).
 */
export function buildCursorResponse<T extends { id: string }>(
  items: T[],
  take: number,
) {
  const hasMore = items.length > take;
  const data = hasMore ? items.slice(0, take) : items;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { data, nextCursor, hasMore };
}
