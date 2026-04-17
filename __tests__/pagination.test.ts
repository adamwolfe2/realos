import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import {
  parseCursorParams,
  buildPrismaCursorArgs,
  buildCursorResponse,
} from "@/lib/pagination";

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/test");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

describe("pagination", () => {
  describe("parseCursorParams", () => {
    it("returns defaults when no params provided", () => {
      const { cursor, take } = parseCursorParams(makeRequest());
      expect(cursor).toBeUndefined();
      expect(take).toBe(50); // DEFAULT_PAGE_SIZE
    });

    it("parses cursor and take from query string", () => {
      const { cursor, take } = parseCursorParams(
        makeRequest({ cursor: "abc-123", take: "25" }),
      );
      expect(cursor).toBe("abc-123");
      expect(take).toBe(25);
    });

    it("clamps take to 1 when below minimum", () => {
      const { take } = parseCursorParams(makeRequest({ take: "0" }));
      expect(take).toBe(1);
    });

    it("clamps take to MAX_PAGE_SIZE (200) when exceeding", () => {
      const { take } = parseCursorParams(makeRequest({ take: "999" }));
      expect(take).toBe(200);
    });

    it("falls back to default when take is not a number", () => {
      const { take } = parseCursorParams(makeRequest({ take: "garbage" }));
      expect(take).toBe(50);
    });

    it("falls back to default for negative take", () => {
      const { take } = parseCursorParams(makeRequest({ take: "-5" }));
      expect(take).toBe(1); // Math.max(-5, 1) = 1
    });
  });

  describe("buildPrismaCursorArgs", () => {
    it("returns only take+1 when no cursor", () => {
      const args = buildPrismaCursorArgs(undefined, 20);
      expect(args).toEqual({ take: 21 });
    });

    it("includes skip and cursor when cursor is provided", () => {
      const args = buildPrismaCursorArgs("cursor-id", 10);
      expect(args).toEqual({
        take: 11,
        skip: 1,
        cursor: { id: "cursor-id" },
      });
    });
  });

  describe("buildCursorResponse", () => {
    it("returns hasMore=true and nextCursor when items exceed take", () => {
      const items = [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
      ];
      const result = buildCursorResponse(items, 2);

      expect(result.hasMore).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data).toEqual([items[0], items[1]]);
      expect(result.nextCursor).toBe("b");
    });

    it("returns hasMore=false and null nextCursor when items fit within take", () => {
      const items = [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ];
      const result = buildCursorResponse(items, 5);

      expect(result.hasMore).toBe(false);
      expect(result.data).toEqual(items);
      expect(result.nextCursor).toBeNull();
    });

    it("handles exactly take items (no extra => hasMore=false)", () => {
      const items = [{ id: "x" }, { id: "y" }];
      const result = buildCursorResponse(items, 2);

      expect(result.hasMore).toBe(false);
      expect(result.data).toEqual(items);
      expect(result.nextCursor).toBeNull();
    });

    it("handles empty items array", () => {
      const result = buildCursorResponse([], 10);

      expect(result.hasMore).toBe(false);
      expect(result.data).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });
});
