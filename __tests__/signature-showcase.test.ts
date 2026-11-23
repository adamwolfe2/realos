import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INCLUDED, SHOWCASE } from "@/lib/signature/showcase";

// A build the page cannot frame shows a blank box, and nothing else fails. Adding an entry without its host in
// the Content-Security-Policy, or without its screenshot, should fail here instead.
describe("signature showcase", () => {
  // the directive's sources as whole tokens, so a mistyped or path-qualified host cannot pass by containing the origin
  const frameSrc = (readFileSync("next.config.mjs", "utf8").match(/"frame-src ([^"]+)"/)?.[1] ?? "").split(/\s+/);

  it("every live build's host is allowed in frame-src", () => {
    for (const view of SHOWCASE.flatMap((e) => e.views)) {
      expect(frameSrc, view.url).toContain(new URL(view.url).origin);
    }
  });

  it("every reel's host is allowed in media-src, and its poster exists", () => {
    const mediaSrc = (readFileSync("next.config.mjs", "utf8").match(/"media-src ([^"]+)"/)?.[1] ?? "").split(/\s+/);
    const reels = SHOWCASE.flatMap((e) => (e.reel ? [e.reel] : []));
    expect(reels.length).toBeGreaterThan(0); // the hero plays the first one
    for (const reel of reels) {
      expect(mediaSrc, reel.src).toContain(new URL(reel.src).origin);
      expect(mediaSrc, reel.srcSmall).toContain(new URL(reel.srcSmall).origin);
      expect(existsSync(`public${reel.poster}`), reel.poster).toBe(true);
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
