#!/usr/bin/env node
// Crawl a running build and record what the web fonts are asked to render:
// characters per family (after text-transform, incl. ::before/::after,
// placeholders, list markers), weights, styles, sizes, OpenType settings,
// hyphens, plus the font files each page downloads and preloads.
//
// Usage: node scripts/fonts/collect-usage.mjs <baseUrl> <out.json> [routesFile]
//   routesFile: one path per line (default: scripts/fonts/routes.txt)
// Output feeds scripts/fonts/subset-fonts.py, which checks the weights and
// OpenType features against what it keeps. Rerun when those change.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const [baseUrl, out, routesFile = "scripts/fonts/routes.txt"] = process.argv.slice(2);
if (!baseUrl || !out) {
  console.error("usage: collect-usage.mjs <baseUrl> <out.json> [routesFile]");
  process.exit(1);
}
const routes = readFileSync(routesFile, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

// Runs in the page. Keyed by the first family in the computed stack.
function collect() {
  const fam = (s) => s.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
  const usage = {};
  const add = (style, text) => {
    if (!text) return;
    const f = fam(style);
    const u = (usage[f] ??= { chars: new Set(), weights: new Set(), styles: new Set(), sizes: new Set(), features: new Set(), variants: new Set(), variations: new Set(), opsz: new Set(), hyphens: new Set() });
    const t = style.textTransform;
    const variants = [text];
    if (t === "uppercase" || t === "capitalize") variants.push(text.toUpperCase());
    if (t === "lowercase" || t === "capitalize") variants.push(text.toLowerCase());
    for (const v of variants) for (const ch of v) u.chars.add(ch.codePointAt(0));
    u.weights.add(style.fontWeight);
    u.styles.add(style.fontStyle);
    u.sizes.add(Math.round(parseFloat(style.fontSize) * 100) / 100);
    u.features.add(style.fontFeatureSettings);
    u.variants.add([style.fontVariantNumeric, style.fontVariantLigatures, style.fontVariantCaps, style.fontVariantEastAsian, style.fontKerning].join("|"));
    u.variations.add(style.fontVariationSettings);
    u.opsz.add(style.fontOpticalSizing);
    u.hyphens.add(style.hyphens);
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName)) continue;
    const text = n.nodeValue.replace(/[\n\r\t]/g, "");
    if (text.trim()) add(getComputedStyle(el), text);
  }
  for (const el of document.body.querySelectorAll("*")) {
    for (const pseudo of ["::before", "::after", "::placeholder", "::marker"]) {
      const s = getComputedStyle(el, pseudo);
      const c = s.content;
      if (pseudo === "::placeholder") { if (el.placeholder) add(s, el.placeholder); continue; }
      if (pseudo === "::marker") {
        if (getComputedStyle(el).display === "list-item" && /decimal|alpha|roman/.test(s.listStyleType || getComputedStyle(el).listStyleType)) add(s, "0123456789.");
        continue;
      }
      const m = c && c !== "none" && c !== "normal" && c.match(/^"(.*)"$/s);
      if (m) add(s, m[1]);
    }
    if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA") && el.value && el.type !== "hidden") add(getComputedStyle(el), el.value);
  }
  const ser = {};
  for (const [f, u] of Object.entries(usage)) ser[f] = Object.fromEntries(Object.entries(u).map(([k, v]) => [k, [...v]]));
  const fonts = performance.getEntriesByType("resource").filter((e) => /\.(woff2?|ttf|otf)(\?|$)/.test(e.name)).map((e) => ({ url: e.name, bytes: e.encodedBodySize || e.transferSize }));
  const preloads = [...document.querySelectorAll('link[rel="preload"][as="font"]')].map((l) => l.href);
  return { usage: ser, fonts, preloads };
}

const browser = await chromium.launch();
const result = {};
for (const route of routes) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    const res = await page.goto(baseUrl + route, { waitUntil: "networkidle", timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    result[route] = { status: res?.status(), finalUrl: page.url().replace(baseUrl, ""), ...(await page.evaluate(collect)) };
    console.log(route, result[route].status, result[route].fonts.length, "font files");
  } catch (err) {
    console.error(route, "FAILED", err.message);
    result[route] = { error: err.message };
  }
  await ctx.close();
}
await browser.close();
writeFileSync(out, JSON.stringify(result, null, 1));
