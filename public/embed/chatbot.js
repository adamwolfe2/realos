(function () {
  "use strict";

  // LeaseStack chatbot embed.
  //
  // Usage:
  //   <script src="https://app.leasestack.co/embed/chatbot.js"
  //           data-slug="telegraph-commons" defer></script>
  //
  // Zero deps. Shadow DOM for style isolation. Works on any host platform
  // (Wix, WordPress, Vercel, static HTML). Mirrors the Telegraph Commons
  // chatbot template: quick actions grid, live inventory greeting,
  // contextual quick reply chips, inline lead capture bubble.

  if (typeof window === "undefined") return;
  if (window.__leasestackChatbotLoaded) return;
  window.__leasestackChatbotLoaded = true;

  var script = document.currentScript ||
    (function () {
      var all = document.getElementsByTagName("script");
      for (var i = all.length - 1; i >= 0; i--) {
        if ((all[i].src || "").indexOf("/embed/chatbot.js") !== -1) return all[i];
      }
      return null;
    })();

  if (!script) return;

  var slug = script.getAttribute("data-slug");
  if (!slug) {
    console.warn("[leasestack chatbot] missing data-slug");
    return;
  }

  var scriptUrl = new URL(script.src, window.location.href);
  var origin = scriptUrl.origin;
  var CONFIG_URL = origin + "/api/public/chatbot/config?slug=" + encodeURIComponent(slug);
  var LISTINGS_URL = origin + "/api/public/chatbot/listings-summary?slug=" + encodeURIComponent(slug);
  var CHAT_URL = origin + "/api/public/chatbot/chat";
  var LEAD_URL = origin + "/api/public/chatbot/lead";

  var EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
  var EMAIL_STRICT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Contextual chip buckets. First match wins, fall through to DEFAULT_CHIPS.
  var CHIP_BUCKETS = [
    {
      test: /\b(tour|visit|walk[- ]?through|see the|show me)\b/i,
      chips: ["Request a tour", "Current availability", "Amenities"],
    },
    {
      test: /(rate|price|\$|rent|cost|how much)/i,
      chips: ["Current availability", "What's included?", "Request a tour"],
    },
    {
      test: /\b(apply|application|lease)\b/i,
      chips: ["Start application", "Request a tour", "Room types"],
    },
    {
      test: /\b(room|bed|bedroom|floor ?plan|studio)\b/i,
      chips: ["Shared rooms", "Private rooms", "Current availability"],
    },
    {
      test: /\b(location|campus|close|near|walk|neighborhood|transit|bus|bart)\b/i,
      chips: ["Nearby dining", "Public transit", "Current availability"],
    },
  ];
  var DEFAULT_CHIPS = [
    "Tell me about amenities",
    "How close is campus?",
    "What's included?",
  ];

  var state = {
    open: false,
    teaserShown: false,
    teaserDismissed: false,
    sending: false,
    sessionId: randomUuid(),
    history: [],
    config: null,
    // PRE_CHAT gate: when true, the intro form is rendered in place of the
    // normal messages/composer surface and the sessionId is assigned by the
    // server after the lead is captured.
    needsIntro: false,
    introSubmitting: false,
    // Inline lead capture: injected as a chat bubble ~800ms after first AI
    // reply when captureMode is ON_INTENT. Skipped if we already passively
    // detected an email.
    inlineLeadShown: false,
    leadCaptured: false,
    leadSubmitting: false,
    firstReplyDone: false,
  };

  var shadow = null;
  var root = null;
  var elements = {};

  fetch(CONFIG_URL, { method: "GET", credentials: "omit" })
    .then(function (res) { return res.json(); })
    .then(function (cfg) {
      if (!cfg || !cfg.enabled) return;
      state.config = cfg;
      mount();
      fetchListingsSummary();
    })
    .catch(function (err) {
      console.warn("[leasestack chatbot] config fetch failed:", err);
    });

  function mount() {
    var host = document.createElement("div");
    host.id = "leasestack-chatbot-host";
    host.style.all = "initial";
    document.body.appendChild(host);
    shadow = host.attachShadow({ mode: "closed" });

    var style = document.createElement("style");
    style.textContent = css(state.config);
    shadow.appendChild(style);

    root = document.createElement("div");
    root.className = "rec-root";
    root.innerHTML = markup(state.config);
    shadow.appendChild(root);

    elements.teaser = root.querySelector(".rec-teaser");
    elements.teaserClose = root.querySelector(".rec-teaser-close");
    elements.launcher = root.querySelector(".rec-launcher");
    elements.panel = root.querySelector(".rec-panel");
    elements.panelClose = root.querySelector(".rec-panel-close");
    elements.messages = root.querySelector(".rec-messages");
    elements.chips = root.querySelector(".rec-chips");
    elements.form = root.querySelector(".rec-form");
    elements.input = root.querySelector(".rec-input");
    elements.send = root.querySelector(".rec-send");
    elements.intro = root.querySelector(".rec-intro");
    elements.actions = root.querySelector(".rec-actions");

    elements.launcher.addEventListener("click", function () {
      if (state.open) closePanel(); else openPanel("button");
    });
    elements.panelClose.addEventListener("click", closePanel);
    elements.teaserClose.addEventListener("click", function (e) {
      e.stopPropagation();
      dismissTeaser();
    });
    elements.teaser.addEventListener("click", function (e) {
      if (e.target === elements.teaserClose) return;
      dismissTeaser();
      openPanel("bubble");
    });
    elements.form.addEventListener("submit", onSubmit);

    wireQuickActions();

    state.needsIntro = state.config.captureMode === "PRE_CHAT";
    if (state.needsIntro) {
      setupIntroForm();
    } else {
      renderGreeting();
    }

    setTimeout(function () {
      if (!state.open && !state.teaserDismissed) showTeaser();
    }, 4500);
  }

  // --- Live inventory greeting ---------------------------------------------
  // Matches the "we just had rooms come available starting at $X/mo" moment
  // from the Telegraph Commons template. Silent failure → no second bubble.
  function fetchListingsSummary() {
    fetch(LISTINGS_URL, { method: "GET", credentials: "omit" })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (body) {
        if (!body || body.openCount <= 0) return;
        if (state.needsIntro) return;
        var brandName = state.config.brandName || "us";
        var priceLine = body.lowestRent
          ? " starting at $" + body.lowestRent.toLocaleString() + "/mo"
          : "";
        appendMessage(
          "assistant",
          "We just had rooms come available at " + brandName + priceLine +
            ". What can I help you with?"
        );
        renderChips();
      })
      .catch(function () { /* fall back to static greeting */ });
  }

  // --- Quick Actions grid --------------------------------------------------
  function wireQuickActions() {
    if (!elements.actions) return;
    var tourBtn = elements.actions.querySelector(".rec-action-tour");
    var availBtn = elements.actions.querySelector(".rec-action-availability");
    var contactBtn = elements.actions.querySelector(".rec-action-contact");

    if (tourBtn) {
      tourBtn.addEventListener("click", function () {
        if (state.sending || state.needsIntro) return;
        send("I'd like to schedule a tour");
      });
    }
    if (availBtn && state.config.primaryCtaUrl) {
      availBtn.setAttribute("href", state.config.primaryCtaUrl);
    }
    if (contactBtn) {
      var href = state.config.phoneNumber
        ? "tel:" + state.config.phoneNumber
        : state.config.contactEmail
          ? "mailto:" + state.config.contactEmail
          : null;
      if (href) contactBtn.setAttribute("href", href);
    }
  }

  function setupIntroForm() {
    root.classList.add("rec-intro-mode");
    var introForm = elements.intro.querySelector(".rec-intro-form");
    var errEl = elements.intro.querySelector(".rec-intro-error");
    if (introForm && !introForm.__recBound) {
      introForm.__recBound = true;
      introForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (errEl) errEl.textContent = "";
        submitIntro(introForm, errEl);
      });
    }
  }

  function submitIntro(formEl, errEl) {
    if (state.introSubmitting) return;
    var firstName = (formEl.querySelector('[name="firstName"]').value || "").trim();
    var email = (formEl.querySelector('[name="email"]').value || "").trim();
    var phoneEl = formEl.querySelector('[name="phone"]');
    var phone = phoneEl ? (phoneEl.value || "").trim() : "";
    var submitBtn = formEl.querySelector(".rec-intro-submit");

    if (!firstName) {
      if (errEl) errEl.textContent = "Please enter your name.";
      return;
    }
    if (!EMAIL_STRICT_RE.test(email)) {
      if (errEl) errEl.textContent = "Please enter a valid email.";
      return;
    }

    state.introSubmitting = true;
    if (submitBtn) submitBtn.disabled = true;

    submitLead({ firstName: firstName, email: email, phone: phone })
      .then(function (data) {
        if (!data || !data.sessionId) {
          throw new Error("Missing sessionId in response");
        }
        state.sessionId = data.sessionId;
        state.needsIntro = false;
        state.leadCaptured = true;
        root.classList.remove("rec-intro-mode");
        renderGreeting();
        fireAnalytics("chatbot_lead_captured", { via: "pre_chat" });
        setTimeout(function () {
          if (elements.input) elements.input.focus();
        }, 50);
      })
      .catch(function (err) {
        console.warn("[leasestack chatbot] intro lead failed:", err);
        if (errEl) {
          errEl.textContent = "Couldn't start chat — please try again.";
        }
      })
      .then(function () {
        state.introSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
      });
  }

  function submitLead(payload) {
    return fetch(LEAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({
        slug: slug,
        firstName: payload.firstName,
        email: payload.email,
        phone: payload.phone || undefined,
        pageUrl: window.location.href,
      }),
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("HTTP " + res.status + ": " + t);
        });
      }
      return res.json();
    });
  }

  function renderGreeting() {
    appendMessage("assistant", state.config.greeting, { animate: false });
    renderChips();
  }

  // --- Contextual quick reply chips ----------------------------------------
  function renderChips() {
    if (!elements.chips) return;
    elements.chips.innerHTML = "";
    if (state.sending) return;
    var last = lastAssistantText();
    if (!last) return;
    var bucket = null;
    for (var i = 0; i < CHIP_BUCKETS.length; i++) {
      if (CHIP_BUCKETS[i].test.test(last)) {
        bucket = CHIP_BUCKETS[i];
        break;
      }
    }
    var chips = bucket ? bucket.chips : DEFAULT_CHIPS;
    chips.forEach(function (label) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rec-chip";
      btn.textContent = label;
      btn.addEventListener("click", function () {
        if (state.sending || state.needsIntro) return;
        send(label);
      });
      elements.chips.appendChild(btn);
    });
  }

  function lastAssistantText() {
    var nodes = elements.messages.querySelectorAll(".rec-msg-assistant");
    if (!nodes.length) return null;
    return nodes[nodes.length - 1].textContent || null;
  }

  // --- Inline lead capture bubble ------------------------------------------
  function maybeInjectInlineLeadCapture() {
    if (state.inlineLeadShown) return;
    if (state.leadCaptured) return;
    if (state.needsIntro) return;
    if (state.config.captureMode !== "ON_INTENT") return;

    state.inlineLeadShown = true;

    var wrap = document.createElement("div");
    wrap.className = "rec-lead-card";
    wrap.innerHTML =
      '<button class="rec-lead-close" aria-label="Dismiss">&times;</button>' +
      '<div class="rec-lead-heading">Want me to follow up? Drop your info:</div>' +
      '<form class="rec-lead-form" novalidate>' +
      '  <input class="rec-lead-input" name="firstName" type="text" placeholder="Your name" autocomplete="name" required maxlength="120" />' +
      '  <input class="rec-lead-input" name="email" type="email" placeholder="Email" autocomplete="email" required maxlength="200" />' +
      '  <input class="rec-lead-input" name="phone" type="tel" placeholder="Phone (optional)" autocomplete="tel" maxlength="40" />' +
      '  <div class="rec-lead-error" role="alert" aria-live="polite"></div>' +
      '  <button class="rec-lead-submit" type="submit">Send it</button>' +
      "</form>";
    elements.messages.appendChild(wrap);
    elements.messages.scrollTop = elements.messages.scrollHeight;

    var form = wrap.querySelector(".rec-lead-form");
    var errEl = wrap.querySelector(".rec-lead-error");
    var closeBtn = wrap.querySelector(".rec-lead-close");
    closeBtn.addEventListener("click", function () {
      wrap.remove();
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (state.leadSubmitting) return;
      errEl.textContent = "";
      var firstName = (form.querySelector('[name="firstName"]').value || "").trim();
      var email = (form.querySelector('[name="email"]').value || "").trim();
      var phone = (form.querySelector('[name="phone"]').value || "").trim();
      if (!firstName) { errEl.textContent = "Please enter your name."; return; }
      if (!EMAIL_STRICT_RE.test(email)) { errEl.textContent = "Please enter a valid email."; return; }
      state.leadSubmitting = true;
      var submitBtn = form.querySelector(".rec-lead-submit");
      submitBtn.disabled = true;
      submitLead({ firstName: firstName, email: email, phone: phone })
        .then(function () {
          state.leadCaptured = true;
          fireAnalytics("chatbot_lead_captured", { via: "form" });
          wrap.innerHTML =
            '<div class="rec-lead-success">Thanks! The team will reach out shortly.</div>';
        })
        .catch(function (err) {
          console.warn("[leasestack chatbot] inline lead failed:", err);
          errEl.textContent = "Couldn't save that — try again?";
        })
        .then(function () {
          state.leadSubmitting = false;
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  function openPanel(source) {
    state.open = true;
    dismissTeaser();
    root.classList.add("rec-open");
    fireAnalytics("chatbot_opened", { source: source || "button" });
    setTimeout(function () {
      if (elements.input) elements.input.focus();
    }, 50);
  }

  function closePanel() {
    state.open = false;
    root.classList.remove("rec-open");
  }

  function showTeaser() {
    if (state.teaserDismissed || state.open) return;
    state.teaserShown = true;
    root.classList.add("rec-teaser-visible");
  }

  function dismissTeaser() {
    state.teaserDismissed = true;
    root.classList.remove("rec-teaser-visible");
  }

  function onSubmit(e) {
    e.preventDefault();
    if (state.sending) return;
    var text = (elements.input.value || "").trim();
    if (!text) return;
    elements.input.value = "";
    send(text);
  }

  function send(text) {
    state.sending = true;
    elements.send.disabled = true;
    appendMessage("user", text);
    state.history.push({ role: "user", content: text });
    if (elements.chips) elements.chips.innerHTML = "";

    // Passive email regex. If the user typed their email in chat, fire the
    // analytics event (server still persists the Lead + Resend notification).
    if (!state.leadCaptured && EMAIL_RE.test(text)) {
      state.leadCaptured = true;
      fireAnalytics("chatbot_lead_captured", { via: "regex" });
    }

    var assistantEl = appendMessage("assistant", "", { streaming: true });

    fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({
        slug: slug,
        sessionId: state.sessionId,
        messages: state.history,
        pageUrl: window.location.href,
      }),
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            throw new Error("HTTP " + res.status + ": " + t);
          });
        }
        if (!res.body) throw new Error("No response body");
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var acc = "";
        function pump() {
          return reader.read().then(function (chunk) {
            if (chunk.done) return acc;
            acc += decoder.decode(chunk.value, { stream: true });
            assistantEl.textContent = acc;
            elements.messages.scrollTop = elements.messages.scrollHeight;
            return pump();
          });
        }
        return pump();
      })
      .then(function (acc) {
        assistantEl.classList.remove("rec-streaming");
        state.history.push({ role: "assistant", content: acc });
        // 800ms after the first assistant reply completes, consider the
        // inline lead capture card. Skipped if leadCaptured or OFF mode.
        if (!state.firstReplyDone) {
          state.firstReplyDone = true;
          setTimeout(maybeInjectInlineLeadCapture, 800);
        }
      })
      .catch(function (err) {
        console.warn("[leasestack chatbot] send failed:", err);
        assistantEl.classList.remove("rec-streaming");
        assistantEl.textContent =
          "Sorry, something went wrong. Please try again or reach us directly.";
      })
      .then(function () {
        state.sending = false;
        elements.send.disabled = false;
        renderChips();
        if (elements.input) elements.input.focus();
      });
  }

  function appendMessage(role, content, opts) {
    opts = opts || {};
    var el = document.createElement("div");
    el.className = "rec-msg rec-msg-" + role;
    if (opts.streaming) el.classList.add("rec-streaming");
    el.textContent = content;
    elements.messages.appendChild(el);
    elements.messages.scrollTop = elements.messages.scrollHeight;
    return el;
  }

  // --- Analytics -----------------------------------------------------------
  // Push to window.dataLayer (GTM) with window.gtag fallback. No-op when
  // neither is present. Parent-page analytics stays decoupled from the embed
  // shadow DOM; this fires on the HOST window.
  function fireAnalytics(event, params) {
    try {
      if (Array.isArray(window.dataLayer)) {
        var entry = { event: event };
        if (params) {
          for (var k in params) {
            if (Object.prototype.hasOwnProperty.call(params, k)) entry[k] = params[k];
          }
        }
        window.dataLayer.push(entry);
        return;
      }
      if (typeof window.gtag === "function") {
        window.gtag("event", event, params || {});
      }
    } catch (_) { /* ignore */ }
  }

  function randomUuid() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    var s = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
    return s.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function markup(cfg) {
    var brand = escapeHtml(cfg.brandName || "Chat");
    var persona = escapeHtml(cfg.personaName || "Leasing");
    var teaser = escapeHtml(cfg.teaserText || "Questions? I'm here.");
    var avatar = cfg.avatarUrl ? escapeHtml(cfg.avatarUrl) : "";
    var avatarMarkup = avatar
      ? '<img class="rec-avatar" src="' + avatar + '" alt="" />'
      : '<div class="rec-avatar rec-avatar-dot"></div>';
    var avatarWithDot =
      '<div class="rec-avatar-wrap">' + avatarMarkup +
      '<span class="rec-online-dot" aria-hidden="true"></span></div>';

    var ctaLabel = escapeHtml(cfg.primaryCtaText || "Availability");
    var hasAvailability = !!cfg.primaryCtaUrl;
    var hasContact = !!(cfg.phoneNumber || cfg.contactEmail);

    var actionsHtml =
      '<div class="rec-actions">' +
      '  <button type="button" class="rec-action rec-action-tour">' +
      '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' +
      '    <span>Schedule a Tour</span>' +
      '  </button>' +
      (hasAvailability
        ? '<a class="rec-action rec-action-availability" target="_blank" rel="noreferrer">' +
          '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"/></svg>' +
          '  <span>' + ctaLabel + '</span>' +
          '</a>'
        : "") +
      (hasContact
        ? '<a class="rec-action rec-action-contact">' +
          '  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' +
          '  <span>Contact</span>' +
          '</a>'
        : "") +
      '</div>';

    var actionCount =
      1 + (hasAvailability ? 1 : 0) + (hasContact ? 1 : 0);

    return (
      '<div class="rec-teaser" role="button" aria-label="Open chat">' +
      '  <button class="rec-teaser-close" aria-label="Dismiss">&times;</button>' +
      '  ' + avatarMarkup +
      '  <div class="rec-teaser-text">' + teaser + "</div>" +
      "</div>" +
      '<button class="rec-launcher" aria-label="Open chat">' +
      '  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">' +
      '    <path d="M4 5h16v11H7l-3 3V5z" fill="currentColor"/>' +
      "  </svg>" +
      "</button>" +
      '<div class="rec-panel" data-actions="' + actionCount + '" role="dialog" aria-label="' + brand + ' chat">' +
      '  <header class="rec-header">' +
      '    ' + avatarWithDot +
      '    <div class="rec-titles">' +
      '      <div class="rec-title">' + persona + ' <span class="rec-title-brand">· ' + brand + "</span></div>" +
      '      <div class="rec-subtitle"><span class="rec-dot"></span>Online · Usually replies instantly</div>' +
      "    </div>" +
      '    <button class="rec-panel-close" aria-label="Close">&times;</button>' +
      "  </header>" +
      actionsHtml +
      '  <div class="rec-messages" role="log"></div>' +
      '  <div class="rec-chips"></div>' +
      '  <div class="rec-intro">' +
      '    <form class="rec-intro-form" novalidate>' +
      '      <div class="rec-intro-heading">Tell us a bit about you to get started.</div>' +
      '      <label class="rec-intro-field">' +
      '        <span class="rec-intro-label">Your name</span>' +
      '        <input class="rec-intro-input" name="firstName" type="text" autocomplete="name" required maxlength="120" />' +
      '      </label>' +
      '      <label class="rec-intro-field">' +
      '        <span class="rec-intro-label">Email</span>' +
      '        <input class="rec-intro-input" name="email" type="email" autocomplete="email" required maxlength="200" />' +
      '      </label>' +
      '      <label class="rec-intro-field">' +
      '        <span class="rec-intro-label">Phone (optional)</span>' +
      '        <input class="rec-intro-input" name="phone" type="tel" autocomplete="tel" maxlength="40" />' +
      '      </label>' +
      '      <div class="rec-intro-error" role="alert" aria-live="polite"></div>' +
      '      <button class="rec-intro-submit" type="submit">Start chat</button>' +
      '    </form>' +
      '  </div>' +
      '  <form class="rec-form">' +
      '    <input class="rec-input" type="text" placeholder="Type a message..." autocomplete="off" />' +
      '    <button class="rec-send" type="submit" aria-label="Send">' +
      '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">' +
      '        <path d="M3 20l18-8L3 4v6l13 2-13 2v6z" fill="currentColor"/>' +
      "      </svg>" +
      "    </button>" +
      "  </form>" +
      "</div>"
    );
  }

  function css(cfg) {
    var color = cfg.brandColor || "#111111";
    return (
      ".rec-root { --rec-color: " + color + "; position: fixed; inset: auto 16px 16px auto; z-index: 2147483000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111; }" +
      "@supports (bottom: env(safe-area-inset-bottom)) { .rec-root { bottom: max(16px, calc(16px + env(safe-area-inset-bottom))); } }" +
      ".rec-launcher { all: unset; cursor: pointer; width: 56px; height: 56px; border-radius: 999px; background: var(--rec-color); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(0,0,0,0.18); transition: transform .15s ease; }" +
      ".rec-launcher:hover { transform: scale(1.05); }" +
      ".rec-teaser { position: absolute; right: 72px; bottom: 8px; max-width: 280px; background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 14px; padding: 10px 32px 10px 12px; display: none; align-items: center; gap: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.14); cursor: pointer; font-size: 13px; line-height: 1.4; }" +
      ".rec-root.rec-teaser-visible .rec-teaser { display: flex; }" +
      ".rec-teaser-close { position: absolute; top: 4px; right: 6px; all: unset; cursor: pointer; font-size: 16px; color: #888; padding: 2px 6px; line-height: 1; }" +
      ".rec-avatar { width: 28px; height: 28px; border-radius: 999px; object-fit: cover; flex-shrink: 0; }" +
      ".rec-avatar-dot { background: var(--rec-color); }" +
      ".rec-avatar-wrap { position: relative; flex-shrink: 0; }" +
      ".rec-avatar-wrap .rec-avatar { width: 40px; height: 40px; border: 2px solid rgba(255,255,255,0.4); }" +
      ".rec-online-dot { position: absolute; bottom: -2px; right: -2px; width: 12px; height: 12px; border-radius: 999px; background: #34d399; border: 2px solid #fff; }" +
      ".rec-panel { position: absolute; right: 0; bottom: 72px; width: 400px; max-width: calc(100vw - 32px); height: 640px; max-height: calc(100vh - 100px); background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.24); display: none; flex-direction: column; overflow: hidden; }" +
      ".rec-root.rec-open .rec-panel { display: flex; }" +
      ".rec-header { display: flex; align-items: center; gap: 10px; padding: 14px 14px 12px; background: linear-gradient(135deg, var(--rec-color), #1a1a2e); color: #fff; }" +
      ".rec-titles { flex: 1; min-width: 0; }" +
      ".rec-title { font-weight: 600; font-size: 14px; }" +
      ".rec-title-brand { font-weight: 400; opacity: 0.85; }" +
      ".rec-subtitle { font-size: 11px; opacity: 0.9; display: flex; align-items: center; gap: 6px; margin-top: 2px; }" +
      ".rec-subtitle .rec-dot { width: 6px; height: 6px; border-radius: 999px; background: #34d399; }" +
      ".rec-panel-close { all: unset; cursor: pointer; margin-left: auto; font-size: 22px; color: rgba(255,255,255,0.85); padding: 2px 8px; line-height: 1; }" +
      ".rec-panel-close:hover { color: #fff; }" +
      ".rec-actions { display: grid; gap: 8px; padding: 10px 12px; border-bottom: 1px solid rgba(0,0,0,0.06); background: #fff; }" +
      ".rec-panel[data-actions='1'] .rec-actions { grid-template-columns: 1fr; }" +
      ".rec-panel[data-actions='2'] .rec-actions { grid-template-columns: 1fr 1fr; }" +
      ".rec-panel[data-actions='3'] .rec-actions { grid-template-columns: 1fr 1fr 1fr; }" +
      ".rec-action { all: unset; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 8px 4px; border: 1px solid rgba(0,0,0,0.12); border-radius: 10px; font-size: 11px; font-weight: 500; color: #374151; background: #fff; text-align: center; text-decoration: none; }" +
      ".rec-action:hover { background: #f8fafc; }" +
      ".rec-messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px; background: #fafafa; }" +
      ".rec-msg { max-width: 82%; padding: 8px 12px; border-radius: 12px; font-size: 14px; line-height: 1.45; white-space: pre-wrap; word-wrap: break-word; }" +
      ".rec-msg-assistant { align-self: flex-start; background: #fff; border: 1px solid rgba(0,0,0,0.06); }" +
      ".rec-msg-user { align-self: flex-end; background: var(--rec-color); color: #fff; }" +
      ".rec-streaming::after { content: '\\2022'; animation: rec-blink 1s infinite; margin-left: 4px; }" +
      "@keyframes rec-blink { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0.2; } }" +
      ".rec-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 14px 10px; background: #fafafa; }" +
      ".rec-chip { all: unset; cursor: pointer; font-size: 12px; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(0,0,0,0.14); background: #fff; color: #374151; }" +
      ".rec-chip:hover { background: #f1f5f9; }" +
      ".rec-lead-card { background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; padding: 14px 14px 12px; margin-top: 4px; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }" +
      ".rec-lead-close { position: absolute; top: 6px; right: 8px; all: unset; cursor: pointer; font-size: 18px; color: #9ca3af; padding: 2px 6px; line-height: 1; }" +
      ".rec-lead-heading { font-size: 13px; font-weight: 500; color: #111; margin-bottom: 8px; }" +
      ".rec-lead-form { display: flex; flex-direction: column; gap: 6px; }" +
      ".rec-lead-input { border: 1px solid rgba(0,0,0,0.14); border-radius: 8px; padding: 8px 10px; font-size: 13px; font-family: inherit; background: #fff; outline: none; color: #111; }" +
      ".rec-lead-input:focus { border-color: var(--rec-color); }" +
      ".rec-lead-error { color: #b91c1c; font-size: 11px; min-height: 14px; }" +
      ".rec-lead-submit { all: unset; cursor: pointer; background: var(--rec-color); color: #fff; text-align: center; padding: 9px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-top: 2px; }" +
      ".rec-lead-submit[disabled] { opacity: 0.6; cursor: not-allowed; }" +
      ".rec-lead-success { font-size: 13px; color: #065f46; text-align: center; padding: 4px 0; }" +
      ".rec-form { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-top: 1px solid rgba(0,0,0,0.06); background: #fff; }" +
      "@supports (bottom: env(safe-area-inset-bottom)) { .rec-form { padding-bottom: max(10px, calc(10px + env(safe-area-inset-bottom))); } }" +
      ".rec-input { flex: 1; border: 1px solid rgba(0,0,0,0.12); border-radius: 999px; padding: 10px 14px; font-size: 16px; outline: none; }" +
      "@media (min-width: 481px) { .rec-input { font-size: 14px; } }" +
      ".rec-input:focus { border-color: var(--rec-color); }" +
      ".rec-send { all: unset; cursor: pointer; width: 36px; height: 36px; border-radius: 999px; background: var(--rec-color); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }" +
      ".rec-send[disabled] { opacity: 0.5; cursor: not-allowed; }" +
      ".rec-intro { display: none; flex: 1; overflow-y: auto; padding: 18px 16px; background: #fafafa; }" +
      ".rec-root.rec-intro-mode .rec-intro { display: block; }" +
      ".rec-root.rec-intro-mode .rec-messages { display: none; }" +
      ".rec-root.rec-intro-mode .rec-chips { display: none; }" +
      ".rec-root.rec-intro-mode .rec-form { display: none; }" +
      ".rec-root.rec-intro-mode .rec-actions { display: none; }" +
      ".rec-intro-form { display: flex; flex-direction: column; gap: 10px; }" +
      ".rec-intro-heading { font-size: 13px; color: #333; margin-bottom: 4px; line-height: 1.45; }" +
      ".rec-intro-field { display: flex; flex-direction: column; gap: 4px; }" +
      ".rec-intro-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.04em; }" +
      ".rec-intro-input { border: 1px solid rgba(0,0,0,0.14); border-radius: 8px; padding: 9px 11px; font-size: 14px; outline: none; font-family: inherit; background: #fff; color: #111; }" +
      ".rec-intro-input:focus { border-color: var(--rec-color); }" +
      ".rec-intro-error { color: #b91c1c; font-size: 12px; min-height: 16px; }" +
      ".rec-intro-submit { all: unset; cursor: pointer; background: var(--rec-color); color: #fff; text-align: center; padding: 11px 14px; border-radius: 10px; font-size: 14px; font-weight: 600; margin-top: 4px; }" +
      ".rec-intro-submit[disabled] { opacity: 0.6; cursor: not-allowed; }" +
      "@media (max-width: 480px) { .rec-panel { width: calc(100vw - 16px); right: -8px; bottom: 68px; height: 85vh; max-height: none; border-radius: 16px 16px 12px 12px; } }"
    );
  }
})();
