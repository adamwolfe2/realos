import { cn } from "@/lib/utils";
import { it, expect } from "vitest";
it("keeps micro size next to color", () => {
  expect(cn("text-2xs text-muted-foreground")).toBe("text-2xs text-muted-foreground");
  expect(cn("text-sm text-2xs")).toBe("text-2xs");
});
