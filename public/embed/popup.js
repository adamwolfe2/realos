/*!
 * LeaseStack Popup Embed v1.0
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
 * Pipeline:
 *   1. Read data-* attributes from the script tag
 *   2. Fetch /api/public/popup/config/[tenant]?property=[slug]
 *   3. For each ACTIVE campaign:
 *      - Skip if URL doesn't match targetUrlPatterns
 *      - Skip if frequency cap blocks (session / once_per_day / always)
 *      - Wire the trigger (exit_intent / scroll / time / immediate)
 *      - On trigger fire: render the popup, record SHOWN
 *   4. User dismiss → record DISMISSED + set frequency cap
 *   5. User CTA → record CTA_CLICKED, follow ctaUrl
 *   6. User form submit → POST to /api/public/leads, record CONVERTED
 */
(function () {
  "use strict";
  if (window.__leasestackPopupLoaded) return;
  window.__leasestackPopupLoaded = true;

  // document.currentScript is reliable during synchronous parsing
  // but null when an async script executes after parse on some
  // browsers (Firefox/Safari edge). Fall back to a selector lookup.
  var script =
    document.currentScript ||
    document.querySelector('script[src*="/embed/popup.js"]');
  var TENANT = script && script.getAttribute("data-tenant");
  var PROPERTY = script && script.getAttribute("data-property");
  if (!TENANT) {
    console.warn("[leasestack-popup] missing data-tenant attribute — embed will not render");
    return;
  }

  // Resolve API origin from the script's own src so the embed works
  // whether installed from leasestack.co, a staging URL, or a custom
  // CNAME. Falls back to leasestack.co if anything goes wrong.
  var API_ORIGIN = (function () {
    try {
      return new URL(script.src).origin;
    } catch (_) {
      return "https://leasestack.co";
    }
  })();

  // Stable per-session id so multiple events from the same visitor
  // tie together. sessionStorage scopes to the tab so leaving the tab
  // and returning re-rolls the id; that's intentional for SHOWN/
  // DISMISSED dedupe.
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
  function fetchConfig() {
    var url =
      API_ORIGIN +
      "/api/public/popup/config/" +
      encodeURIComponent(TENANT) +
      (PROPERTY ? "?property=" + encodeURIComponent(PROPERTY) : "");
    return fetch(url, { method: "GET", credentials: "omit" })
      .then(function (r) {
        if (!r.ok) throw new Error("config fetch failed: " + r.status);
        return r.json();
      })
      .then(function (j) {
        return (j && j.popups) || [];
      })
      .catch(function (err) {
        console.warn("[leasestack-popup]", err);
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
        // Allow the request to live past page unload so a CTA_CLICKED
        // event isn't dropped when the visitor navigates away.
        keepalive: true,
      });
    } catch (_) {
      // No-op — analytics failure should never block user-visible UX.
    }
  }

  function submitLead(popup, data) {
    // Dedicated popup endpoint resolves tenantSlug + propertySlug
    // server-side and writes through the same notification side-effects
    // a chatbot capture does. Pre-fix this hit /api/public/leads,
    // whose schema demands `orgId` + a LeadSource enum — the embed
    // sends neither, so every popup conversion silently 400'd.
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
        // Visitor identity for pixel attribution. Best-effort — the
        // pixel sets this cookie on tenant marketing sites; the popup
        // may run on other sites where the cookie won't be present.
        visitorHash: readCookie("ls_vid"),
      }),
    })
      .then(function (r) {
        return r.json().catch(function () {
          return { ok: false };
        });
      })
      .catch(function () {
        return { ok: false };
      });
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
    } catch (_) {
      /* ignore */
    }
    return undefined;
  }

  // ──────────────────────────────────────────────────────────────────
  // Frequency cap — prevents popup fatigue
  // ──────────────────────────────────────────────────────────────────
  function frequencyKey(popupId) {
    return "leasestack.popup.shown." + popupId;
  }

  function shouldShow(popup) {
    if (popup.frequency === "always") return true;
    try {
      var key = frequencyKey(popup.id);
      var stored =
        popup.frequency === "once_per_day"
          ? localStorage.getItem(key)
          : sessionStorage.getItem(key);
      if (!stored) return true;
      if (popup.frequency === "once_per_day") {
        var lastShown = parseInt(stored, 10);
        return Number.isFinite(lastShown) &&
          Date.now() - lastShown > 24 * 60 * 60 * 1000;
      }
      return false;
    } catch (_) {
      return true;
    }
  }

  function markShown(popup) {
    try {
      var key = frequencyKey(popup.id);
      var value = String(Date.now());
      if (popup.frequency === "once_per_day") {
        localStorage.setItem(key, value);
      } else if (popup.frequency === "session") {
        sessionStorage.setItem(key, value);
      }
      // "always" doesn't write — every page load re-renders
    } catch (_) {
      /* ignore */
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // URL allowlist
  // ──────────────────────────────────────────────────────────────────
  function urlMatches(popup) {
    var patterns = popup.targetUrlPatterns;
    if (!patterns || patterns.length === 0) return true;
    var path = window.location.pathname + window.location.search;
    for (var i = 0; i < patterns.length; i += 1) {
      if (path.indexOf(patterns[i]) !== -1) return true;
    }
    return false;
  }

  // ──────────────────────────────────────────────────────────────────
  // DOM render — mirrors components/portal/popups/popup-preview.tsx
  // ──────────────────────────────────────────────────────────────────
  function safe(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // safeNavTarget — defense-in-depth XSS guard for popup CTA navigation.
  // The server-side schema already gates schemes to http/https/mailto/
  // tel/relative, but the embed MUST NOT trust a value pulled from the
  // network at runtime. A javascript: URI assigned to location.href
  // executes arbitrary JS in the host site's origin — that's a full
  // cross-site script on every domain running our embed. Returns the
  // URL if safe, null otherwise.
  var SAFE_NAV_SCHEMES = ["http:", "https:", "mailto:", "tel:"];
  function safeNavTarget(raw) {
    if (!raw || raw === "#") return null;
    var trimmed = String(raw).trim();
    if (!trimmed || trimmed === "#") return null;
    // Same-origin / relative — the browser resolves against the host
    // site, no scheme risk.
    if (
      trimmed.charAt(0) === "/" ||
      trimmed.charAt(0) === "#" ||
      trimmed.charAt(0) === "?"
    ) {
      return trimmed;
    }
    try {
      // new URL with the host site's location as base — same resolution
      // the browser would do for an anchor href.
      var u = new URL(trimmed, window.location.href);
      if (SAFE_NAV_SCHEMES.indexOf(u.protocol) === -1) return null;
      return u.toString();
    } catch (_) {
      return null;
    }
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
      ".ls-popup-wrap.ls-pos-bottom-right{bottom:20px;right:20px;max-width:420px;width:calc(100% - 40px)}",
      ".ls-popup-wrap.ls-pos-bottom-left{bottom:20px;left:20px;max-width:420px;width:calc(100% - 40px)}",
      ".ls-popup-wrap.ls-pos-top-banner{top:0;left:0;right:0}",
      ".ls-popup-card{position:relative;overflow:hidden;box-shadow:0 24px 48px -12px rgba(15,23,42,.18),0 0 0 1px rgba(15,23,42,.06);width:100%;max-width:420px;border-radius:16px}",
      ".ls-popup-card.ls-pos-top-banner{max-width:none;border-radius:0}",
      ".ls-popup-close{position:absolute;top:10px;right:10px;z-index:1;background:rgba(0,0,0,.06);border:0;width:28px;height:28px;border-radius:9999px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1;color:inherit}",
      ".ls-popup-close:hover{background:rgba(0,0,0,.12)}",
      ".ls-popup-hero{width:100%;height:128px;object-fit:cover;display:block}",
      ".ls-popup-body{padding:20px}",
      ".ls-popup-body.ls-pos-top-banner{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 20px}",
      ".ls-popup-headline{margin:0;font-weight:600;letter-spacing:-.01em;line-height:1.3;font-size:20px}",
      ".ls-popup-body.ls-pos-top-banner .ls-popup-headline{font-size:15px}",
      ".ls-popup-text{margin:6px 0 0;font-size:14px;line-height:1.55;opacity:.78}",
      ".ls-popup-code{display:inline-flex;align-items:center;gap:8px;border:2px dashed;padding:6px 12px;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;font-weight:600;background:transparent;cursor:pointer;margin-top:12px}",
      ".ls-popup-form{margin-top:12px;display:flex;flex-direction:column;gap:8px}",
      ".ls-popup-input{width:100%;padding:9px 12px;border-radius:8px;border:1px solid rgba(0,0,0,.1);background:rgba(255,255,255,.7);font-size:14px;outline:none}",
      ".ls-popup-input:focus{box-shadow:0 0 0 2px var(--ls-accent)}",
      ".ls-popup-cta{margin-top:12px;width:100%;padding:10px 16px;border-radius:8px;border:0;color:#fff;font-weight:600;font-size:14px;cursor:pointer;transition:opacity .15s}",
      ".ls-popup-cta:hover{opacity:.92}",
      ".ls-popup-cta.ls-pos-top-banner{margin:0;width:auto;flex-shrink:0}",
      ".ls-popup-secondary{margin-top:8px;background:none;border:0;width:100%;font-size:12px;font-weight:500;opacity:.5;cursor:pointer}",
      ".ls-popup-secondary:hover{opacity:.8}",
      "@keyframes ls-pop-fade{from{opacity:0}to{opacity:1}}",
      "@keyframes ls-pop-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}",
      "@media (prefers-reduced-motion:reduce){.ls-popup-wrap,.ls-popup-backdrop{animation:none}}",
    ].join("\n");
    document.head.appendChild(s);
  }

  function render(popup) {
    ensureStyles();

    var position = popup.position || "CENTER";
    var posClass =
      position === "CENTER"
        ? "ls-pos-center"
        : position === "BOTTOM_LEFT"
          ? "ls-pos-bottom-left"
          : position === "TOP_BANNER"
            ? "ls-pos-top-banner"
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
    wrap.style.setProperty("--ls-accent", popup.primaryColor || "#2563EB");

    var card = document.createElement("div");
    card.className = "ls-popup-card " + posClass;
    card.style.backgroundColor = popup.backgroundColor || "#FFFFFF";
    card.style.color = popup.textColor || "#0F172A";

    var heroHtml =
      popup.heroImageUrl && position !== "TOP_BANNER"
        ? '<img class="ls-popup-hero" src="' + safe(popup.heroImageUrl) + '" alt="" />'
        : "";

    var codeHtml = popup.offerCode
      ? '<button type="button" class="ls-popup-code" data-ls-action="copy-code" style="border-color:' +
        safe(popup.primaryColor) +
        ';color:inherit"><span>' +
        safe(popup.offerCode) +
        "</span></button>"
      : "";

    var formHtml = popup.captureEmail
      ? '<form class="ls-popup-form" data-ls-action="submit">' +
        '<input class="ls-popup-input" type="email" name="email" required placeholder="Your email" />' +
        (popup.capturePhone
          ? '<input class="ls-popup-input" type="tel" name="phone" placeholder="Phone (optional)" />'
          : "") +
        '<button type="submit" class="ls-popup-cta" style="background-color:' +
        safe(popup.primaryColor) +
        '">' +
        safe(popup.ctaText || "Claim offer") +
        "</button>" +
        "</form>"
      : '<button type="button" class="ls-popup-cta ' +
        (position === "TOP_BANNER" ? "ls-pos-top-banner" : "") +
        '" data-ls-action="cta" style="background-color:' +
        safe(popup.primaryColor) +
        '">' +
        safe(popup.ctaText || "Claim offer") +
        "</button>";

    var secondaryHtml =
      popup.secondaryText && position !== "TOP_BANNER"
        ? '<button type="button" class="ls-popup-secondary" data-ls-action="dismiss">' +
          safe(popup.secondaryText) +
          "</button>"
        : "";

    if (position === "TOP_BANNER") {
      card.innerHTML =
        '<button type="button" class="ls-popup-close" data-ls-action="dismiss" aria-label="Dismiss">×</button>' +
        '<div class="ls-popup-body ls-pos-top-banner">' +
        '<div style="flex:1;min-width:0">' +
        '<h2 class="ls-popup-headline">' + safe(popup.headline) + "</h2>" +
        "</div>" +
        codeHtml +
        formHtml +
        "</div>";
    } else {
      card.innerHTML =
        '<button type="button" class="ls-popup-close" data-ls-action="dismiss" aria-label="Dismiss">×</button>' +
        heroHtml +
        '<div class="ls-popup-body">' +
        '<h2 class="ls-popup-headline">' + safe(popup.headline) + "</h2>" +
        '<p class="ls-popup-text">' + safe(popup.body) + "</p>" +
        codeHtml +
        formHtml +
        secondaryHtml +
        "</div>";
    }

    wrap.appendChild(card);
    root.appendChild(wrap);
    document.body.appendChild(root);

    // Record SHOWN immediately + mark frequency cap so a navigation
    // during the same session doesn't re-fire.
    recordEvent(popup.id, "SHOWN");
    markShown(popup);

    function teardown() {
      try {
        document.body.removeChild(root);
      } catch (_) {
        /* ignore */
      }
    }

    function onDismiss() {
      recordEvent(popup.id, "DISMISSED");
      teardown();
    }

    function onCta() {
      recordEvent(popup.id, "CTA_CLICKED");
      var url = safeNavTarget(popup.ctaUrl);
      teardown();
      if (url) window.location.href = url;
    }

    function onCopyCode(btn) {
      if (!popup.offerCode) return;
      try {
        navigator.clipboard
          .writeText(popup.offerCode)
          .then(function () {
            var label = btn.querySelector("span");
            if (label) {
              var prev = label.textContent;
              label.textContent = "Copied";
              setTimeout(function () {
                label.textContent = prev;
              }, 1500);
            }
          })
          .catch(function () {
            /* ignore */
          });
      } catch (_) {
        /* ignore */
      }
    }

    async function onSubmit(form) {
      var fd = new FormData(form);
      var email = String(fd.get("email") || "").trim();
      if (!email) return;
      var phone = String(fd.get("phone") || "").trim() || undefined;

      var btn = form.querySelector("button[type=submit]");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Submitting…";
      }

      var result = await submitLead(popup, { email: email, phone: phone });
      var leadId = result && result.leadId;
      // CONVERTED is now written server-side inside the lead route
      // (atomically with Lead.create) so we only fall back to the
      // client-fired event when the lead capture itself didn't return
      // ok — that way a network blip on the lead POST still increments
      // the campaign counter so dashboards aren't misleading. When the
      // server confirmed the capture, skip to avoid double-counting.
      if (!result || result.ok !== true) {
        recordEvent(popup.id, "CONVERTED", leadId);
      }

      if (btn) btn.textContent = "Thanks!";
      setTimeout(function () {
        teardown();
        var url = safeNavTarget(popup.ctaUrl);
        if (url) window.location.href = url;
      }, 900);
    }

    // Click handlers via delegation.
    root.addEventListener("click", function (e) {
      var t = e.target;
      while (t && t !== root) {
        var action = t.getAttribute && t.getAttribute("data-ls-action");
        if (action === "dismiss") {
          onDismiss();
          return;
        }
        if (action === "cta") {
          onCta();
          return;
        }
        if (action === "copy-code") {
          onCopyCode(t);
          return;
        }
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
      render(popup);
      return;
    }

    if (popup.trigger === "TIME_ON_PAGE") {
      var seconds = Math.max(0, Number(popup.triggerThreshold) || 0);
      setTimeout(function () {
        if (shouldShow(popup)) render(popup);
      }, seconds * 1000);
      return;
    }

    if (popup.trigger === "IDLE_TIME") {
      // Fires after N seconds of no scroll/click/keypress/mousemove.
      // Implemented as a resettable timer driven by activity events.
      // Captures bored visitors who landed but never engaged — usually
      // a better signal than "time on page" because someone actively
      // reading shouldn't get interrupted by a popup.
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
      // Wrap in IIFE so each popup gets its own `fired` flag — pre-fix
      // both SCROLL_DEPTH + EXIT_INTENT declared `var fired` in the
      // outer wireTrigger scope, which hoisted into a SHARED variable
      // when an org had multiple popups with different triggers. The
      // first one to fire would prevent the others from ever showing.
      (function () {
        var pct = Math.max(1, Math.min(100, Number(popup.triggerThreshold) || 50));
        var fired = false;
        function onScroll() {
          if (fired) return;
          var scrolled =
            (window.scrollY || document.documentElement.scrollTop || 0) +
            window.innerHeight;
          var height =
            document.documentElement.scrollHeight || document.body.scrollHeight;
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

    // EXIT_INTENT (default) — same IIFE pattern to scope `fired`
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

  // ──────────────────────────────────────────────────────────────────
  // Boot
  // ──────────────────────────────────────────────────────────────────
  function boot() {
    fetchConfig().then(function (popups) {
      for (var i = 0; i < popups.length; i += 1) {
        try {
          wireTrigger(popups[i]);
        } catch (err) {
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
