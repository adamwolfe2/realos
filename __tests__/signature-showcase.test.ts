import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INCLUDED, SHOWCASE } from "@/lib/signature/showcase";

// A build the page cannot frame shows a blank box, and nothing else fails. Adding an entry without its host in
// the Content-Security-Policy, or without its screenshot, should fail here instead.
describe("signature showcase", () => {
  const frameSrc = readFileSync("next.config.mjs", "utf8").match(/"frame-src [^"]+"/)?.[0] ?? "";

  it("every live build's host is allowed in frame-src", () => {
    for (const view of SHOWCASE.flatMap((e) => e.views)) {
      expect(frameSrc, view.url).toContain(new URL(view.url).origin);
    }
  });

  it("every screenshot exists", () => {
    const files = [...SHOWCASE.flatMap((e) => e.views.map((v) => v.poster)), ...INCLUDED.map((f) => f.img)];
    for (const f of files) expect(existsSync(`public${f}`), f).toBe(true);
  });

  it("a concept build says it is one", () => {
    for (const e of SHOWCASE.filter((x) => x.status === "Concept")) expect(e.note, e.name).toBeTruthy();
  });
});
