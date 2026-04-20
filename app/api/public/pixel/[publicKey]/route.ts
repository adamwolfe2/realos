import { NextRequest, NextResponse } from "next/server";
import { isPublicSiteKeyShape } from "@/lib/api-keys/public-site-key";
import { resolveOrgByPublicKey } from "@/lib/visitors/pixel-ingest";

// ---------------------------------------------------------------------------
// GET /api/public/pixel/[publicKey].js (or /api/public/pixel/[publicKey])
//
// Serves the first-party visitor pixel as a small JavaScript bundle. The
// snippet on the marketing site is just a one-liner that loads this file;
// the heavy lifting (cookies, beacons, identify, scroll tracking) lives
// here so we can ship updates without asking customers to re-paste tags.
//
// Caching: short s-maxage so we get CDN reuse but can roll updates fast.
// CORS: open — this is a public asset.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_SECONDS = 60 * 5; // 5 minutes
const NOT_FOUND_CACHE_SECONDS = 30;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
} as const;

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS_HEADERS, "Access-Control-Max-Age": "86400" },
  });
}

function buildBaseUrl(req: NextRequest): string {
  // Prefer the configured public app URL; fall back to the request host so
  // the snippet still works on preview deploys without an env override.
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function buildPixelScript(publicKey: string, ingestUrl: string): string {
  // Inline minified JS. Keep it dependency-free, IE11-friendly (no arrow
  // functions in critical paths) so it runs on the broadest set of marketing
  // sites without breaking. Total size target: < 4 KB gzipped.
  return `/* RealEstaite Pixel — first-party visitor tracking */
(function (w, d) {
  if (w.__rePixel && w.__rePixel.loaded) { return; }
  var KEY = ${JSON.stringify(publicKey)};
  var INGEST = ${JSON.stringify(ingestUrl)};
  var COOKIE_AID = "re_aid";
  var COOKIE_SID = "re_sid";
  var COOKIE_DAYS_AID = 365;
  var COOKIE_DAYS_SID = 1;

  function readCookie(name) {
    try {
      var match = d.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()\\[\\]\\\\\\/\\+^]/g, "\\\\$&") + "=([^;]*)"));
      return match ? decodeURIComponent(match[1]) : null;
    } catch (e) { return null; }
  }
  function writeCookie(name, value, days) {
    try {
      var expires = "";
      if (days) {
        var d2 = new Date();
        d2.setTime(d2.getTime() + days * 864e5);
        expires = "; expires=" + d2.toUTCString();
      }
      d.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax";
    } catch (e) { /* fail silent */ }
  }
  function rand(len) {
    var bytes = new Uint8Array(len);
    if (w.crypto && w.crypto.getRandomValues) { w.crypto.getRandomValues(bytes); }
    else { for (var i = 0; i < len; i++) { bytes[i] = Math.floor(Math.random() * 256); } }
    var hex = "";
    for (var i = 0; i < bytes.length; i++) { hex += ("0" + bytes[i].toString(16)).slice(-2); }
    return hex;
  }
  function ensureAid() {
    var v = readCookie(COOKIE_AID);
    if (!v) { v = "anon_" + rand(12); writeCookie(COOKIE_AID, v, COOKIE_DAYS_AID); }
    return v;
  }
  function ensureSid() { return readCookie(COOKIE_SID); }
  function setSid(v) { writeCookie(COOKIE_SID, v, COOKIE_DAYS_SID); }

  function parseUtm() {
    var out = {};
    try {
      var q = new URLSearchParams(w.location.search);
      var keys = ["source", "medium", "campaign", "term", "content"];
      for (var i = 0; i < keys.length; i++) {
        var v = q.get("utm_" + keys[i]);
        if (v) { out[keys[i]] = v; }
      }
    } catch (e) {}
    return out;
  }

  function context() {
    return {
      url: w.location.href,
      referrer: d.referrer || null,
      userAgent: w.navigator && w.navigator.userAgent ? w.navigator.userAgent : null,
      language: w.navigator && w.navigator.language ? w.navigator.language : null,
      utm: parseUtm(),
    };
  }

  var queue = [];
  var sending = false;
  function flush(useBeacon) {
    if (sending || queue.length === 0) { return; }
    var batch = queue.splice(0, queue.length);
    var payload = {
      publicKey: KEY,
      anonymousId: ensureAid(),
      sessionToken: ensureSid(),
      context: context(),
      events: batch,
    };
    var body = JSON.stringify(payload);
    sending = true;
    function done(resp) {
      sending = false;
      if (resp && resp.sessionToken) { setSid(resp.sessionToken); }
    }
    if (useBeacon && w.navigator && w.navigator.sendBeacon) {
      try {
        var blob = new Blob([body], { type: "application/json" });
        w.navigator.sendBeacon(INGEST, blob);
        sending = false;
        return;
      } catch (e) { /* fall through */ }
    }
    try {
      fetch(INGEST, {
        method: "POST",
        credentials: "omit",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: body,
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { done(j); })
        .catch(function () { sending = false; });
    } catch (e) { sending = false; }
  }

  function track(type, props) {
    var ev = { type: type, occurredAt: new Date().toISOString() };
    if (type === "pageview") {
      ev.url = w.location.href;
      ev.path = w.location.pathname + w.location.search;
      ev.title = d.title || null;
      ev.referrer = d.referrer || null;
    }
    if (props) {
      for (var k in props) { if (Object.prototype.hasOwnProperty.call(props, k)) { ev[k] = props[k]; } }
    }
    queue.push(ev);
    // Send pageview / identify immediately, batch the rest.
    if (type === "pageview" || type === "identify" || queue.length >= 8) {
      flush(false);
    }
  }

  function identify(traits) {
    var ev = { type: "identify", traits: traits || {} };
    if (traits && traits.email) { ev.email = traits.email; }
    if (traits && traits.firstName) { ev.firstName = traits.firstName; }
    if (traits && traits.lastName) { ev.lastName = traits.lastName; }
    if (traits && traits.phone) { ev.phone = traits.phone; }
    queue.push(ev);
    flush(false);
  }

  // Scroll depth: report at 25 / 50 / 75 / 100 once per page.
  var scrollMarks = { 25: false, 50: false, 75: false, 100: false };
  function scrollPercent() {
    var doc = d.documentElement;
    var body = d.body;
    var h = Math.max(doc.scrollHeight, body ? body.scrollHeight : 0);
    var v = (w.innerHeight + (w.scrollY || w.pageYOffset || 0)) / h;
    return Math.min(100, Math.max(0, Math.round(v * 100)));
  }
  function onScroll() {
    var p = scrollPercent();
    var marks = [25, 50, 75, 100];
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      if (p >= m && !scrollMarks[m]) {
        scrollMarks[m] = true;
        track("scroll", { scrollDepth: m });
      }
    }
  }

  // Time on page: tick every 15s up to 5 min, send on unload.
  var startedAt = Date.now();
  var lastReportSec = 0;
  function tick() {
    var sec = Math.floor((Date.now() - startedAt) / 1000);
    if (sec - lastReportSec >= 15 && sec <= 300) {
      lastReportSec = sec;
      track("timing", { timeOnPageSeconds: sec });
    }
  }

  function onUnload() {
    var sec = Math.floor((Date.now() - startedAt) / 1000);
    queue.push({ type: "unload", timeOnPageSeconds: sec, occurredAt: new Date().toISOString() });
    flush(true);
  }

  function ready(fn) {
    if (d.readyState === "complete" || d.readyState === "interactive") { setTimeout(fn, 0); }
    else { d.addEventListener("DOMContentLoaded", fn); }
  }

  ready(function () {
    track("pageview");
    w.addEventListener("scroll", onScroll, { passive: true });
    setInterval(tick, 15000);
    w.addEventListener("pagehide", onUnload);
    w.addEventListener("beforeunload", onUnload);
  });

  // Public API on window.rePixel
  var queued = (w.rePixel && w.rePixel.q) || [];
  w.rePixel = {
    track: track,
    identify: identify,
    flush: function () { flush(false); },
    loaded: true,
    key: KEY,
  };
  for (var i = 0; i < queued.length; i++) {
    try {
      var args = queued[i];
      var method = args[0];
      if (typeof w.rePixel[method] === "function") {
        w.rePixel[method].apply(w.rePixel, args.slice(1));
      }
    } catch (e) {}
  }

  w.__rePixel = { loaded: true, key: KEY };
})(window, document);
`;
}

function notFoundScript(): string {
  return "/* RealEstaite Pixel: unknown public key — pixel disabled */\n";
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ publicKey: string }> }
) {
  const { publicKey: rawKey } = await ctx.params;
  const publicKey = (rawKey ?? "").replace(/\.js$/i, "").trim();

  const baseHeaders: Record<string, string> = {
    ...CORS_HEADERS,
    "Content-Type": "application/javascript; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": `public, max-age=${NOT_FOUND_CACHE_SECONDS}, s-maxage=${NOT_FOUND_CACHE_SECONDS}`,
  };

  if (!isPublicSiteKeyShape(publicKey)) {
    return new NextResponse(notFoundScript(), { status: 200, headers: baseHeaders });
  }

  const resolution = await resolveOrgByPublicKey(publicKey);
  if (!resolution) {
    return new NextResponse(notFoundScript(), { status: 200, headers: baseHeaders });
  }

  const ingestUrl = `${buildBaseUrl(req)}/api/public/visitors/track`;
  const body = buildPixelScript(publicKey, ingestUrl);

  return new NextResponse(body, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/javascript; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
    },
  });
}
