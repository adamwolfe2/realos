/*!
 * LeaseStack Popup Embed v1.1
 *
 * Vanilla JS, zero dependencies, IIFE. Pastes once on any external
 * site (Wix, WordPress, Webflow, custom) and renders operator-designed
 * popups based on the campaign's trigger config.
 *
 * Install:
 *   <script async src="https://leasestack.co/embed/popup.js"
 *           data-tenant="your-org-slug"
 *           data-property="optional-property-slug"></script>
 *
 * v1.1 (phase 1) adds:
 *   - DARK / GRADIENT theme rendering with white-on-dark hierarchy
 *   - top gradient accent bar from gradientColors stops
 *   - eyebrow label above the headline
 *   - featured value card (price callout) between body and CTAs
 *   - secondary CTA (outlined) next to primary
 *   - icon support on CTAs (calendar / phone / external / arrow)
 *   - tertiary dismiss link below CTAs
 *   - decorative corner circles on DARK theme
 *
 * Backward compat: popups with NULL phase 1 fields render identically
 * to v1.0 — every new branch is gated on a truthy field check.
 */
(function () {
  "use strict";
  if (window.__leasestackPopupLoaded) return;
  window.__leasestackPopupLoaded = true;

  // Verbose diagnostic mode: on by default so silent failures become
  // loud in DevTools. Operators reported "I embedded it but I don't
  // see it" with no signal in console — every decision the embed
  // makes (config fetched, popups found, trigger wired, frequency
  // blocked, render fired) now prints with the [leasestack-popup]
  // prefix so DevTools → Console filter on that string surfaces the
  // full trail. Set window.__leasestackPopupDebug = false BEFORE the
  // script loads to silence in production.
  var DEBUG =
    typeof window.__leasestackPopupDebug === "boolean"
      ? window.__leasestackPopupDebug
      : true;
  function log() {
    if (!DEBUG) return;
    try {
      var args = ["%c[leasestack-popup]", "color:#2563EB;font-weight:600"];
      for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
      console.info.apply(console, args);
    } catch (_) { /* ignore */ }
  }

  var script =
    document.currentScript ||
    document.querySelector('script[src*="/embed/popup.js"]');
  var TENANT = script && script.getAttribute("data-tenant");
  var PROPERTY = script && script.getAttribute("data-property");
  if (!TENANT) {
    console.warn(
      "[leasestack-popup] missing data-tenant attribute — embed will not render. " +
      "Add data-tenant=\"<your-org-slug>\" to the <script> tag."
    );
    return;
  }
  log("boot — tenant=" + TENANT + (PROPERTY ? ", property=" + PROPERTY : ""));

  var API_ORIGIN = (function () {
    try {
      return new URL(script.src).origin;
    } catch (_) {
      return "https://leasestack.co";
    }
  })();

  // ──────────────────────────────────────────────────────────────────
  // Test-mode query params (operator preview / dedup busting)
  // ──────────────────────────────────────────────────────────────────
  //
  // Operators repeatedly hit the "I added the embed but I don't see
  // the popup" problem because `frequency: "session"` causes the
  // sessionStorage flag to suppress every render after the first one
  // in a tab — including silent renders that fired before the
  // operator was watching. Three query-param escape hatches make
  // testing painless:
  //
  //   ?lspopup=preview  — bypass frequency cap + URL filter + reduce
  //                       trigger threshold to 0 so the first popup
  //                       fires immediately on page load. Use this
  //                       link to preview a campaign without needing
  //                       to clear cookies or open incognito.
  //   ?lspopup=clear    — clear ALL leasestack.popup.shown.* keys
  //                       from both sessionStorage and localStorage,
  //                       then proceed with normal trigger flow.
  //                       Use after dismissing once, to test again.
  //   ?lspopup=off      — skip popups entirely. Use when QA'ing the
  //                       page without the overlay obscuring content.
  //
  // None of these affect production traffic — real users never hit a
  // URL with these params. They show up in the DevTools network tab
  // + console (DEBUG mode logs which mode is active).
  var PREVIEW_MODE = false;
  var POPUP_DISABLED = false;
  (function () {
    try {
      var params = new URLSearchParams(window.location.search);
      var mode = params.get("lspopup");
      if (!mode) return;
      if (mode === "preview") {
        PREVIEW_MODE = true;
        log("preview mode ON — frequency caps, URL filters, and trigger thresholds bypassed");
      } else if (mode === "off") {
        POPUP_DISABLED = true;
        log("popups disabled for this page (?lspopup=off)");
      } else if (mode === "clear") {
        var cleared = 0;
        try {
          for (var i = sessionStorage.length - 1; i >= 0; i--) {
            var k = sessionStorage.key(i);
            if (k && k.indexOf("leasestack.popup.shown.") === 0) {
              sessionStorage.removeItem(k); cleared++;
            }
          }
        } catch (_) { /* ignore */ }
        try {
          for (var j = localStorage.length - 1; j >= 0; j--) {
            var lk = localStorage.key(j);
            if (lk && lk.indexOf("leasestack.popup.shown.") === 0) {
              localStorage.removeItem(lk); cleared++;
            }
          }
        } catch (_) { /* ignore */ }
        log("cleared " + cleared + " popup dedup key(s) — popups will fire again this session");
      } else {
        log("unknown ?lspopup mode '" + mode + "' — expected preview / clear / off");
      }
    } catch (_) { /* malformed URL — ignore */ }
  })();

  var SESSION_KEY = "leasestack.popup.sid";
  var sid = (function () {
    try {
      var existing = sessionStorage.getItem(SESSION_KEY);
      if (existing) return existing;
      var fresh = "ls-popup-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, fresh);
      return fresh;
    } catch (_) {
      return "ls-popup-" + Math.random().toString(36).slice(2);
    }
  })();

  // ──────────────────────────────────────────────────────────────────
  // Network helpers
  // ──────────────────────────────────────────────────────────────────
  function fetchConfig(attempt) {
    attempt = attempt || 0;
    var url =
      API_ORIGIN +
      "/api/public/popup/config/" +
      encodeURIComponent(TENANT) +
      (PROPERTY ? "?property=" + encodeURIComponent(PROPERTY) : "");
    return fetch(url, { method: "GET", credentials: "omit" })
      .then(function (r) {
        if (r.status === 429 || (r.status >= 500 && r.status < 600)) {
          if (attempt >= 3) {
            console.warn(
              "[leasestack-popup] config endpoint returned " +
                r.status +
                " after retries — popups disabled for this page."
            );
            return [];
          }
          var hint = parseInt(r.headers.get("retry-after") || "", 10);
          var waitMs = Math.min(
            10000,
            Math.max(
              isFinite(hint) ? hint * 1000 : 0,
              1000 * Math.pow(2, attempt)
            )
          );
          return new Promise(function (resolve) {
            setTimeout(function () {
              resolve(fetchConfig(attempt + 1));
            }, waitMs);
          });
        }
        if (!r.ok) throw new Error("config fetch failed: " + r.status);
        return r.json().then(function (j) {
          return (j && j.popups) || [];
        });
      })
      .catch(function (err) {
        if (attempt < 3) {
          var waitMs = 1000 * Math.pow(2, attempt);
          return new Promise(function (resolve) {
            setTimeout(function () {
              resolve(fetchConfig(attempt + 1));
            }, waitMs);
          });
        }
        console.warn("[leasestack-popup] config fetch failed:", err);
        return [];
      });
  }

  function recordEvent(popupId, type, leadId) {
    try {
      fetch(API_ORIGIN + "/api/public/popup/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          popupId: popupId,
          type: type,
          sessionId: sid,
          leadId: leadId,
          pageUrl: window.location.href,
          referrer: document.referrer || undefined,
        }),
        keepalive: true,
      });
    } catch (_) { /* no-op */ }
  }

  function submitLead(popup, data) {
    return fetch(API_ORIGIN + "/api/public/popup/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({
        tenantSlug: TENANT,
        propertySlug: PROPERTY || undefined,
        popupId: popup.id,
        email: data.email,
        phone: data.phone,
        pageUrl: window.location.href,
        visitorHash: readCookie("ls_vid"),
      }),
    })
      .then(function (r) {
        return r.json().catch(function () { return { ok: false }; });
      })
      .catch(function () { return { ok: false }; });
  }

  function readCookie(name) {
    try {
      var pairs = document.cookie ? document.cookie.split(";") : [];
      for (var i = 0; i < pairs.length; i++) {
        var idx = pairs[i].indexOf("=");
        var k = idx === -1 ? pairs[i].trim() : pairs[i].slice(0, idx).trim();
        if (k === name) {
          return idx === -1 ? "" : decodeURIComponent(pairs[i].slice(idx + 1));
        }
      }
    } catch (_) { /* ignore */ }
    return undefined;
  }

  // ──────────────────────────────────────────────────────────────────
  // Frequency cap
  // ──────────────────────────────────────────────────────────────────
  function frequencyKey(popupId) { return "leasestack.popup.shown." + popupId; }
  function shouldShow(popup) {
    // Preview mode bypasses every frequency cap so an operator
    // testing a campaign sees it fire on every page load.
    if (PREVIEW_MODE) return true;
    if (popup.frequency === "always") return true;
    try {
      var key = frequencyKey(popup.id);
      var stored = popup.frequency === "once_per_day"
        ? localStorage.getItem(key)
        : sessionStorage.getItem(key);
      if (!stored) return true;
      if (popup.frequency === "once_per_day") {
        var lastShown = parseInt(stored, 10);
        var withinDay = Number.isFinite(lastShown) && Date.now() - lastShown > 24 * 60 * 60 * 1000;
        if (!withinDay) {
          log(
            "blocked by frequency cap — popup '" + popup.headline +
            "' (id=" + popup.id + ") was shown today. " +
            "Clear localStorage['" + key + "'] to re-test."
          );
        }
        return withinDay;
      }
      // session
      log(
        "blocked by frequency cap — popup '" + popup.headline +
        "' (id=" + popup.id + ") was already shown this session. " +
        "Open a new incognito window OR clear sessionStorage['" + key + "'] to re-test."
      );
      return false;
    } catch (_) { return true; }
  }
  function markShown(popup) {
    try {
      var key = frequencyKey(popup.id);
      var value = String(Date.now());
      if (popup.frequency === "once_per_day") localStorage.setItem(key, value);
      else if (popup.frequency === "session") sessionStorage.setItem(key, value);
    } catch (_) { /* ignore */ }
  }

  function urlMatches(popup) {
    var patterns = popup.targetUrlPatterns;
    if (!patterns || patterns.length === 0) return true;
    var path = window.location.pathname + window.location.search;
    for (var i = 0; i < patterns.length; i += 1) {
      if (path.indexOf(patterns[i]) !== -1) return true;
    }
    log(
      "blocked by URL mismatch — popup '" + popup.headline +
      "' targets [" + patterns.join(", ") + "] but current path is " + path
    );
    return false;
  }

  // ──────────────────────────────────────────────────────────────────
  // DOM render
  // ──────────────────────────────────────────────────────────────────
  function safe(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  var SAFE_NAV_SCHEMES = ["http:", "https:", "mailto:", "tel:"];
  function safeNavTarget(raw) {
    if (!raw || raw === "#") return null;
    var trimmed = String(raw).trim();
    if (!trimmed || trimmed === "#") return null;
    if (trimmed.charAt(0) === "/" || trimmed.charAt(0) === "#" || trimmed.charAt(0) === "?") return trimmed;
    try {
      var u = new URL(trimmed, window.location.href);
      if (SAFE_NAV_SCHEMES.indexOf(u.protocol) === -1) return null;
      return u.toString();
    } catch (_) { return null; }
  }

  // Inline SVG icon set — minimal, hand-tuned to stay under the 6KB budget.
  // Strokes inherit currentColor so theme tokens flow through automatically.
  var ICONS = {
    external: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3H3v10h10v-3"/><path d="M9 3h4v4"/><path d="M13 3 7 9"/></svg>',
    calendar: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M5 2v3M11 2v3M2.5 7h11"/></svg>',
    phone: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3.5a1 1 0 0 1 1-1h1.6a1 1 0 0 1 .95.68l.8 2.4a1 1 0 0 1-.3 1.05L6 7.7a8 8 0 0 0 2.3 2.3l1.07-1.05a1 1 0 0 1 1.05-.3l2.4.8a1 1 0 0 1 .68.95V12a1 1 0 0 1-1 1A10 10 0 0 1 3 3.5z"/></svg>',
    arrow: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h10"/><path d="M9 4l4 4-4 4"/></svg>',
    none: ""
  };
  function iconHtml(name) {
    if (!name || name === "none") return "";
    return ICONS[name] || "";
  }

  function splitYearAccent(headline) {
    var m = String(headline || "").match(/(\d{4}\s*[–-]\s*\d{4}|\d{4})/);
    if (!m || m.index == null) return null;
    return {
      head: headline.slice(0, m.index),
      accent: m[0],
      tail: headline.slice(m.index + m[0].length)
    };
  }

  var STYLE_TAG_ID = "leasestack-popup-style";
  function ensureStyles() {
    if (document.getElementById(STYLE_TAG_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_TAG_ID;
    s.textContent = [
      ".ls-popup-root,.ls-popup-root *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif}",
      ".ls-popup-backdrop{position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.4);backdrop-filter:blur(4px);animation:ls-pop-fade .18s ease-out}",
      ".ls-popup-wrap{position:fixed;z-index:2147483647;animation:ls-pop-in .24s cubic-bezier(.16,1,.3,1)}",
      ".ls-popup-wrap.ls-pos-center{inset:0;display:flex;align-items:center;justify-content:center;padding:16px}",
      ".ls-popup-wrap.ls-pos-bottom-right{bottom:20px;right:20px;max-width:520px;width:calc(100% - 40px)}",
      ".ls-popup-wrap.ls-pos-bottom-left{bottom:20px;left:20px;max-width:520px;width:calc(100% - 40px)}",
      ".ls-popup-wrap.ls-pos-top-banner{top:0;left:0;right:0}",
      ".ls-popup-card{position:relative;overflow:hidden;width:100%;max-width:520px;border-radius:18px;box-shadow:0 24px 48px -12px rgba(15,23,42,.18),0 0 0 1px rgba(15,23,42,.06)}",
      ".ls-popup-card.ls-pos-top-banner{max-width:none;border-radius:0}",
      ".ls-popup-card.ls-theme-dark{box-shadow:0 32px 64px -16px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.04)}",
      ".ls-popup-gradient-bar{position:absolute;top:0;left:0;right:0;height:3px;z-index:2}",
      ".ls-popup-deco{position:absolute;border-radius:9999px;pointer-events:none}",
      ".ls-popup-deco-tl{top:-64px;left:-64px;width:176px;height:176px;opacity:.06}",
      ".ls-popup-deco-br{bottom:-80px;right:-64px;width:208px;height:208px;opacity:.05}",
      ".ls-popup-close{position:absolute;top:12px;right:12px;z-index:3;border:0;width:32px;height:32px;border-radius:9999px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;color:inherit}",
      ".ls-popup-card.ls-theme-light .ls-popup-close{background:rgba(15,23,42,.05)}",
      ".ls-popup-card.ls-theme-dark .ls-popup-close{background:rgba(255,255,255,.06)}",
      ".ls-popup-card.ls-theme-gradient .ls-popup-close{background:rgba(15,23,42,.05)}",
      ".ls-popup-hero{width:100%;height:128px;object-fit:cover;display:block}",
      ".ls-popup-body{position:relative;z-index:1;padding:24px}",
      ".ls-popup-card.ls-theme-dark .ls-popup-body{padding:36px}",
      ".ls-popup-body.ls-pos-top-banner{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 20px}",
      ".ls-popup-eyebrow{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.18em;margin:0 0 10px}",
      ".ls-popup-headline{margin:0;font-weight:700;letter-spacing:-.01em;line-height:1.15;font-size:24px}",
      ".ls-popup-card.ls-theme-dark .ls-popup-headline{font-size:32px}",
      ".ls-popup-body.ls-pos-top-banner .ls-popup-headline{font-size:15px}",
      ".ls-popup-text{margin:10px 0 0;font-size:14px;line-height:1.55;opacity:.78}",
      ".ls-popup-featured{margin-top:18px;border-radius:12px;padding:16px 20px}",
      ".ls-popup-card.ls-theme-light .ls-popup-featured{background:rgba(15,23,42,.04);border:1px solid rgba(15,23,42,.06)}",
      ".ls-popup-card.ls-theme-dark .ls-popup-featured{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}",
      ".ls-popup-featured-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.18em}",
      ".ls-popup-featured-value{display:flex;align-items:baseline;gap:8px;margin-top:6px}",
      ".ls-popup-featured-value strong{font-weight:700;letter-spacing:-.02em;line-height:1;font-size:48px}",
      ".ls-popup-card.ls-theme-dark .ls-popup-featured-value strong{font-size:60px}",
      ".ls-popup-featured-unit{font-size:16px;font-weight:500;opacity:.85}",
      ".ls-popup-featured-caption{margin-top:6px;font-size:12px;opacity:.75}",
      ".ls-popup-code{display:inline-flex;align-items:center;gap:8px;border:2px dashed;padding:6px 12px;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;font-weight:600;background:transparent;cursor:pointer;margin-top:16px;color:inherit}",
      ".ls-popup-form{margin-top:16px;display:flex;flex-direction:column;gap:8px}",
      ".ls-popup-input{width:100%;padding:10px 12px;border-radius:8px;font-size:14px;outline:none}",
      ".ls-popup-card.ls-theme-light .ls-popup-input{background:rgba(255,255,255,.7);border:1px solid rgba(0,0,0,.1);color:inherit}",
      ".ls-popup-card.ls-theme-dark .ls-popup-input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff}",
      ".ls-popup-input:focus{box-shadow:0 0 0 2px var(--ls-accent)}",
      ".ls-popup-cta-stack{margin-top:16px;display:flex;flex-direction:column;gap:8px}",
      ".ls-popup-cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px 16px;border-radius:10px;border:0;color:#fff;font-weight:600;font-size:14px;cursor:pointer;transition:opacity .15s}",
      ".ls-popup-cta:hover{opacity:.92}",
      ".ls-popup-card.ls-theme-dark .ls-popup-cta-primary{color:#0F1729}",
      ".ls-popup-cta.ls-pos-top-banner{margin:0;width:auto;flex-shrink:0}",
      ".ls-popup-cta-secondary{background:transparent !important}",
      ".ls-popup-card.ls-theme-light .ls-popup-cta-secondary{color:inherit;border:1.5px solid currentColor}",
      ".ls-popup-card.ls-theme-dark .ls-popup-cta-secondary{color:#fff;border:1.5px solid rgba(255,255,255,.4)}",
      ".ls-popup-dismiss{margin-top:12px;background:none;border:0;width:100%;font-size:12px;font-weight:500;cursor:pointer;color:inherit;opacity:.6}",
      ".ls-popup-card.ls-theme-dark .ls-popup-dismiss{opacity:.7}",
      ".ls-popup-dismiss:hover{opacity:1}",
      ".ls-popup-year-accent{color:var(--ls-accent)}",
      "@keyframes ls-pop-fade{from{opacity:0}to{opacity:1}}",
      "@keyframes ls-pop-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}",
      "@media (prefers-reduced-motion:reduce){.ls-popup-wrap,.ls-popup-backdrop{animation:none}}",
    ].join("\n");
    document.head.appendChild(s);
  }

  function render(popup) {
    log("rendering popup '" + popup.headline + "' (id=" + popup.id + ")");
    ensureStyles();

    var position = popup.position || "CENTER";
    var theme = popup.theme || "LIGHT";
    var themeClass = theme === "DARK" ? "ls-theme-dark" : theme === "GRADIENT" ? "ls-theme-gradient" : "ls-theme-light";
    var isDark = theme === "DARK";
    var accent = popup.accentColor || popup.primaryColor || "#2563EB";

    var posClass =
      position === "CENTER" ? "ls-pos-center"
      : position === "BOTTOM_LEFT" ? "ls-pos-bottom-left"
      : position === "TOP_BANNER" ? "ls-pos-top-banner"
      : "ls-pos-bottom-right";

    var root = document.createElement("div");
    root.className = "ls-popup-root";

    var backdrop = null;
    if (position === "CENTER") {
      backdrop = document.createElement("div");
      backdrop.className = "ls-popup-backdrop";
      root.appendChild(backdrop);
    }

    var wrap = document.createElement("div");
    wrap.className = "ls-popup-wrap " + posClass;
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", position === "CENTER" ? "true" : "false");
    wrap.setAttribute("aria-label", popup.headline || "Promo");
    wrap.style.setProperty("--ls-accent", accent);

    var card = document.createElement("div");
    card.className = "ls-popup-card " + posClass + " " + themeClass;
    // DARK ignores operator textColor — white-on-dark hierarchy is hard-coded
    // so a partial brand-color edit can't break legibility.
    card.style.backgroundColor = isDark
      ? (popup.backgroundColor || "#0F1729")
      : (popup.backgroundColor || "#FFFFFF");
    card.style.color = isDark ? "#FFFFFF" : (popup.textColor || "#0F172A");

    // Gradient accent bar — visible on GRADIENT theme, and on DARK theme when
    // gradientColors stops are present (Telegraph reference shows both).
    var gradientHtml = "";
    if (
      (theme === "GRADIENT" || theme === "DARK") &&
      Array.isArray(popup.gradientColors) &&
      popup.gradientColors.length >= 2
    ) {
      // Only allow hex stops through to inline style — defense against a
      // future schema drift letting non-color strings reach the linear-gradient.
      var safeStops = popup.gradientColors
        .filter(function (c) { return typeof c === "string" && /^#[0-9a-fA-F]{3,6}$/.test(c); });
      if (safeStops.length >= 2) {
        gradientHtml = '<div class="ls-popup-gradient-bar" style="background:linear-gradient(90deg,' + safeStops.join(",") + ')"></div>';
      }
    }

    var decoHtml = "";
    if (isDark && position !== "TOP_BANNER") {
      decoHtml =
        '<span class="ls-popup-deco ls-popup-deco-tl" style="background:' + safe(accent) + '"></span>' +
        '<span class="ls-popup-deco ls-popup-deco-br" style="background:' + safe(accent) + '"></span>';
    }

    var heroHtml = popup.heroImageUrl && position !== "TOP_BANNER"
      ? '<img class="ls-popup-hero" src="' + safe(popup.heroImageUrl) + '" alt="" />'
      : "";

    var eyebrowHtml = popup.eyebrowText && position !== "TOP_BANNER"
      ? '<div class="ls-popup-eyebrow" style="color:' + safe(accent) + '">' + safe(popup.eyebrowText) + "</div>"
      : "";

    // Year-accent split — only applied on DARK theme to match Telegraph reference.
    var headlineInner = safe(popup.headline);
    if (isDark) {
      var split = splitYearAccent(popup.headline || "");
      if (split) {
        headlineInner =
          safe(split.head) +
          '<span class="ls-popup-year-accent">' + safe(split.accent) + "</span>" +
          safe(split.tail);
      }
    }

    var featuredHtml = "";
    if ((popup.featuredValue || popup.featuredLabel) && position !== "TOP_BANNER") {
      featuredHtml =
        '<div class="ls-popup-featured">' +
        (popup.featuredLabel
          ? '<div class="ls-popup-featured-label" style="color:' + safe(accent) + '">' + safe(popup.featuredLabel) + "</div>"
          : "") +
        (popup.featuredValue
          ? '<div class="ls-popup-featured-value" style="color:' + safe(accent) + '"><strong>' + safe(popup.featuredValue) + "</strong>" +
            (popup.featuredUnit ? '<span class="ls-popup-featured-unit">' + safe(popup.featuredUnit) + "</span>" : "") +
            "</div>"
          : "") +
        (popup.featuredCaption
          ? '<div class="ls-popup-featured-caption" style="color:' + safe(accent) + '">' + safe(popup.featuredCaption) + "</div>"
          : "") +
        "</div>";
    }

    var codeHtml = popup.offerCode && position !== "TOP_BANNER"
      ? '<button type="button" class="ls-popup-code" data-ls-action="copy-code" style="border-color:' + safe(accent) + '"><span>' + safe(popup.offerCode) + "</span></button>"
      : "";

    var primaryIcon = iconHtml(popup.primaryCtaIcon);
    var secondaryIcon = iconHtml(popup.secondaryCtaIcon);

    var ctaStackHtml;
    if (popup.captureEmail && position !== "TOP_BANNER") {
      ctaStackHtml =
        '<form class="ls-popup-form" data-ls-action="submit">' +
        '<input class="ls-popup-input" type="email" name="email" required placeholder="Your email" />' +
        (popup.capturePhone ? '<input class="ls-popup-input" type="tel" name="phone" placeholder="Phone (optional)" />' : "") +
        '<button type="submit" class="ls-popup-cta ls-popup-cta-primary" style="background-color:' + safe(accent) + '">' +
        "<span>" + safe(popup.ctaText || "Claim offer") + "</span>" + primaryIcon +
        "</button>" +
        "</form>";
    } else {
      var primaryBtn =
        '<button type="button" class="ls-popup-cta ls-popup-cta-primary ' +
        (position === "TOP_BANNER" ? "ls-pos-top-banner" : "") +
        '" data-ls-action="cta" style="background-color:' + safe(accent) + '">' +
        "<span>" + safe(popup.ctaText || "Claim offer") + "</span>" + primaryIcon +
        "</button>";
      var secondaryBtn = popup.secondaryCtaText && position !== "TOP_BANNER"
        ? '<button type="button" class="ls-popup-cta ls-popup-cta-secondary" data-ls-action="cta-secondary">' +
          "<span>" + safe(popup.secondaryCtaText) + "</span>" + secondaryIcon +
          "</button>"
        : "";
      ctaStackHtml = position === "TOP_BANNER"
        ? primaryBtn
        : '<div class="ls-popup-cta-stack">' + primaryBtn + secondaryBtn + "</div>";
    }

    // dismissText wins over legacy secondaryText. When neither is set we
    // omit the tertiary slot entirely.
    var dismissHtml = "";
    if (position !== "TOP_BANNER") {
      var dismissCopy = popup.dismissText || popup.secondaryText || "";
      if (dismissCopy) {
        dismissHtml = '<button type="button" class="ls-popup-dismiss" data-ls-action="dismiss">' + safe(dismissCopy) + "</button>";
      }
    }

    if (position === "TOP_BANNER") {
      card.innerHTML =
        gradientHtml +
        '<button type="button" class="ls-popup-close" data-ls-action="dismiss" aria-label="Dismiss">×</button>' +
        '<div class="ls-popup-body ls-pos-top-banner">' +
        '<div style="flex:1;min-width:0">' +
        '<h2 class="ls-popup-headline">' + headlineInner + "</h2>" +
        "</div>" +
        codeHtml +
        ctaStackHtml +
        "</div>";
    } else {
      card.innerHTML =
        gradientHtml +
        decoHtml +
        '<button type="button" class="ls-popup-close" data-ls-action="dismiss" aria-label="Dismiss">×</button>' +
        heroHtml +
        '<div class="ls-popup-body">' +
        eyebrowHtml +
        '<h2 class="ls-popup-headline">' + headlineInner + "</h2>" +
        '<p class="ls-popup-text">' + safe(popup.body) + "</p>" +
        featuredHtml +
        codeHtml +
        ctaStackHtml +
        dismissHtml +
        "</div>";
    }

    wrap.appendChild(card);
    root.appendChild(wrap);
    document.body.appendChild(root);

    recordEvent(popup.id, "SHOWN");
    markShown(popup);

    function teardown() {
      try { document.body.removeChild(root); } catch (_) { /* ignore */ }
    }

    function onDismiss() {
      recordEvent(popup.id, "DISMISSED");
      teardown();
    }

    function onCta(url, isSecondary) {
      recordEvent(popup.id, "CTA_CLICKED");
      var target = safeNavTarget(url);
      teardown();
      if (target) window.location.href = target;
      // isSecondary kept for analytics future-proofing
      void isSecondary;
    }

    function onCopyCode(btn) {
      if (!popup.offerCode) return;
      try {
        navigator.clipboard.writeText(popup.offerCode)
          .then(function () {
            var label = btn.querySelector("span");
            if (label) {
              var prev = label.textContent;
              label.textContent = "Copied";
              setTimeout(function () { label.textContent = prev; }, 1500);
            }
          })
          .catch(function () { /* ignore */ });
      } catch (_) { /* ignore */ }
    }

    async function onSubmit(form) {
      var fd = new FormData(form);
      var email = String(fd.get("email") || "").trim();
      if (!email) return;
      var phone = String(fd.get("phone") || "").trim() || undefined;

      var btn = form.querySelector("button[type=submit]");
      var label = btn && btn.querySelector("span");
      if (label) label.textContent = "Submitting…";
      if (btn) btn.disabled = true;

      var result = await submitLead(popup, { email: email, phone: phone });
      var leadId = result && result.leadId;
      if (!result || result.ok !== true) {
        recordEvent(popup.id, "CONVERTED", leadId);
      }

      if (label) label.textContent = "Thanks!";
      setTimeout(function () {
        teardown();
        var url = safeNavTarget(popup.ctaUrl);
        if (url) window.location.href = url;
      }, 900);
    }

    root.addEventListener("click", function (e) {
      var t = e.target;
      while (t && t !== root) {
        var action = t.getAttribute && t.getAttribute("data-ls-action");
        if (action === "dismiss") { onDismiss(); return; }
        if (action === "cta") { onCta(popup.ctaUrl, false); return; }
        if (action === "cta-secondary") { onCta(popup.secondaryCtaUrl, true); return; }
        if (action === "copy-code") { onCopyCode(t); return; }
        t = t.parentElement;
      }
      if (backdrop && e.target === backdrop) onDismiss();
    });
    root.addEventListener("submit", function (e) {
      var t = e.target;
      if (t && t.getAttribute("data-ls-action") === "submit") {
        e.preventDefault();
        onSubmit(t);
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Trigger wiring
  // ──────────────────────────────────────────────────────────────────
  function wireTrigger(popup) {
    if (!urlMatches(popup) || !shouldShow(popup)) return;

    if (popup.trigger === "IMMEDIATE") {
      log("trigger IMMEDIATE — rendering popup '" + popup.headline + "' now");
      render(popup);
      return;
    }

    if (popup.trigger === "TIME_ON_PAGE") {
      var seconds = Math.max(0, Number(popup.triggerThreshold) || 0);
      log(
        "trigger TIME_ON_PAGE — will render popup '" + popup.headline +
        "' in " + seconds + "s"
      );
      setTimeout(function () { if (shouldShow(popup)) render(popup); }, seconds * 1000);
      return;
    }

    if (popup.trigger === "IDLE_TIME") {
      var idleSeconds = Math.max(1, Number(popup.triggerThreshold) || 30);
      var idleTimer = null;
      function resetIdle() {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(function () {
          unwireIdle();
          if (shouldShow(popup)) render(popup);
        }, idleSeconds * 1000);
      }
      function unwireIdle() {
        if (idleTimer) clearTimeout(idleTimer);
        window.removeEventListener("scroll", resetIdle);
        window.removeEventListener("mousemove", resetIdle);
        window.removeEventListener("keydown", resetIdle);
        window.removeEventListener("click", resetIdle);
        window.removeEventListener("touchstart", resetIdle);
      }
      window.addEventListener("scroll", resetIdle, { passive: true });
      window.addEventListener("mousemove", resetIdle, { passive: true });
      window.addEventListener("keydown", resetIdle, { passive: true });
      window.addEventListener("click", resetIdle, { passive: true });
      window.addEventListener("touchstart", resetIdle, { passive: true });
      resetIdle();
      return;
    }

    if (popup.trigger === "SCROLL_DEPTH") {
      (function () {
        var pct = Math.max(1, Math.min(100, Number(popup.triggerThreshold) || 50));
        var fired = false;
        function onScroll() {
          if (fired) return;
          var scrolled = (window.scrollY || document.documentElement.scrollTop || 0) + window.innerHeight;
          var height = document.documentElement.scrollHeight || document.body.scrollHeight;
          if (height > 0 && (scrolled / height) * 100 >= pct) {
            fired = true;
            window.removeEventListener("scroll", onScroll);
            if (shouldShow(popup)) render(popup);
          }
        }
        window.addEventListener("scroll", onScroll, { passive: true });
      })();
      return;
    }

    // EXIT_INTENT (default)
    log(
      "trigger EXIT_INTENT — will render popup '" + popup.headline +
      "' when the visitor moves mouse near the top of the viewport"
    );
    (function () {
      var fired = false;
      function onLeave(e) {
        if (fired) return;
        if (e.clientY != null && e.clientY < 10) {
          fired = true;
          document.removeEventListener("mouseleave", onLeave);
          if (shouldShow(popup)) render(popup);
        }
      }
      document.addEventListener("mouseleave", onLeave);
    })();
  }

  function boot() {
    log("fetching popup config from " + API_ORIGIN + "/api/public/popup/config/" + TENANT);
    fetchConfig().then(function (popups) {
      if (popups.length === 0) {
        log(
          "no ACTIVE popups returned for tenant '" + TENANT + "'. " +
          "Possible causes: (1) the tenant slug doesn't match an org, " +
          "(2) modulePopups is OFF for this org, " +
          "(3) every campaign is in DRAFT/PAUSED/ARCHIVED state. " +
          "Check /portal/popups in the LeaseStack portal."
        );
        return;
      }
      log("found " + popups.length + " ACTIVE popup(s): " +
        popups.map(function (p) {
          return "'" + p.headline + "' [trigger=" + p.trigger +
            ", threshold=" + (p.triggerThreshold || 0) + "]";
        }).join(", "));
      for (var i = 0; i < popups.length; i += 1) {
        try { wireTrigger(popups[i]); } catch (err) {
          console.warn("[leasestack-popup]", err);
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
