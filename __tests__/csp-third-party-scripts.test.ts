import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every third-party script the app loads must be allowed by the CSP in
// next.config.mjs. Until 2026-09-26 the pixel, GTM, Crisp and the Cal.com
// "Book a demo" embed were all silently blocked on leasestack.co.
const config = readFileSync("next.config.mjs", "utf8");
const directive = (name: string) =>
  config.match(new RegExp(`"${name} ([^"]+)"`))?.[1] ?? "";

describe("CSP allows the third-party scripts we ship", () => {
  it.each([
    ["script-src", "https://cdn.idpixel.app"],
    ["connect-src", "https://collector.idpixel.app"],
    ["script-src", "https://www.googletagmanager.com"],
    ["script-src", "https://client.crisp.chat"],
    ["connect-src", "wss://client.relay.crisp.chat"],
    ["script-src", "https://app.cal.com"],
    ["frame-src", "https://app.cal.com"],
  ])("%s includes %s", (name, host) => {
    expect(directive(name).split(" ")).toContain(host);
  });
});
