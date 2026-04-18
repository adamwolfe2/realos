(function () {
  "use strict";

  // RealEstaite chatbot embed.
  //
  // Usage:
  //   <script src="https://app.realestaite.co/embed/chatbot.js"
  //           data-slug="telegraph-commons" defer></script>
  //
  // Zero deps. Shadow DOM for style isolation. Works on any host platform
  // (Wix, WordPress, Vercel, static HTML). No cookies, no localStorage.

  if (typeof window === "undefined") return;
  if (window.__realestaiteChatbotLoaded) return;
  window.__realestaiteChatbotLoaded = true;

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
    console.warn("[realestaite chatbot] missing data-slug");
    return;
  }

  var scriptUrl = new URL(script.src, window.location.href);
  var origin = scriptUrl.origin;
  var CONFIG_URL = origin + "/api/public/chatbot/config?slug=" + encodeURIComponent(slug);
  var CHAT_URL = origin + "/api/public/chatbot/chat";
  var LEAD_URL = origin + "/api/public/chatbot/lead";

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    })
    .catch(function (err) {
      console.warn("[realestaite chatbot] config fetch failed:", err);
    });

  function mount() {
    var host = document.createElement("div");
    host.id = "realestaite-chatbot-host";
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
    elements.form = root.querySelector(".rec-form");
    elements.input = root.querySelector(".rec-input");
    elements.send = root.querySelector(".rec-send");
    elements.intro = root.querySelector(".rec-intro");

    elements.launcher.addEventListener("click", togglePanel);
    elements.panelClose.addEventListener("click", closePanel);
    elements.teaserClose.addEventListener("click", dismissTeaser);
    elements.teaser.addEventListener("click", function (e) {
      if (e.target === elements.teaserClose) return;
      dismissTeaser();
      openPanel();
    });
    elements.form.addEventListener("submit", onSubmit);

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
    if (!EMAIL_RE.test(email)) {
      if (errEl) errEl.textContent = "Please enter a valid email.";
      return;
    }

    state.introSubmitting = true;
    if (submitBtn) submitBtn.disabled = true;

    fetch(LEAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({
        slug: slug,
        firstName: firstName,
        email: email,
        phone: phone || undefined,
        pageUrl: window.location.href,
      }),
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) {
            throw new Error("HTTP " + res.status + ": " + t);
          });
        }
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.sessionId) {
          throw new Error("Missing sessionId in response");
        }
        state.sessionId = data.sessionId;
        state.needsIntro = false;
        root.classList.remove("rec-intro-mode");
        renderGreeting();
        setTimeout(function () {
          if (elements.input) elements.input.focus();
        }, 50);
      })
      .catch(function (err) {
        console.warn("[realestaite chatbot] lead capture failed:", err);
        if (errEl) {
          errEl.textContent =
            "Couldn't start chat — please try again.";
        }
      })
      .then(function () {
        state.introSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
      });
  }

  function renderGreeting() {
    appendMessage("assistant", state.config.greeting, { animate: false });
  }

  function togglePanel() {
    if (state.open) closePanel(); else openPanel();
  }

  function openPanel() {
    state.open = true;
    dismissTeaser();
    root.classList.add("rec-open");
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
      })
      .catch(function (err) {
        console.warn("[realestaite chatbot] send failed:", err);
        assistantEl.classList.remove("rec-streaming");
        assistantEl.textContent =
          "Sorry, something went wrong. Please try again or reach us directly.";
      })
      .then(function () {
        state.sending = false;
        elements.send.disabled = false;
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
      '<div class="rec-panel" role="dialog" aria-label="' + brand + ' chat">' +
      '  <header class="rec-header">' +
      '    ' + avatarMarkup +
      '    <div>' +
      '      <div class="rec-title">' + brand + "</div>" +
      '      <div class="rec-subtitle">' + persona + "</div>" +
      "    </div>" +
      '    <button class="rec-panel-close" aria-label="Close">&times;</button>' +
      "  </header>" +
      '  <div class="rec-messages" role="log"></div>' +
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
      ".rec-launcher { all: unset; cursor: pointer; width: 56px; height: 56px; border-radius: 999px; background: var(--rec-color); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(0,0,0,0.18); transition: transform .15s ease; }" +
      ".rec-launcher:hover { transform: scale(1.05); }" +
      ".rec-teaser { position: absolute; right: 72px; bottom: 8px; max-width: 280px; background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 14px; padding: 10px 32px 10px 12px; display: none; align-items: center; gap: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.14); cursor: pointer; font-size: 13px; line-height: 1.4; }" +
      ".rec-root.rec-teaser-visible .rec-teaser { display: flex; }" +
      ".rec-teaser-close { position: absolute; top: 4px; right: 6px; all: unset; cursor: pointer; font-size: 16px; color: #888; padding: 2px 6px; line-height: 1; }" +
      ".rec-avatar { width: 28px; height: 28px; border-radius: 999px; object-fit: cover; flex-shrink: 0; }" +
      ".rec-avatar-dot { background: var(--rec-color); }" +
      ".rec-panel { position: absolute; right: 0; bottom: 72px; width: 380px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 100px); background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.24); display: none; flex-direction: column; overflow: hidden; }" +
      ".rec-root.rec-open .rec-panel { display: flex; }" +
      ".rec-header { display: flex; align-items: center; gap: 10px; padding: 14px 14px 12px; border-bottom: 1px solid rgba(0,0,0,0.06); }" +
      ".rec-header .rec-avatar { width: 34px; height: 34px; }" +
      ".rec-title { font-weight: 600; font-size: 14px; }" +
      ".rec-subtitle { font-size: 11px; color: #666; }" +
      ".rec-panel-close { all: unset; cursor: pointer; margin-left: auto; font-size: 22px; color: #888; padding: 2px 8px; line-height: 1; }" +
      ".rec-messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px; background: #fafafa; }" +
      ".rec-msg { max-width: 82%; padding: 8px 12px; border-radius: 12px; font-size: 14px; line-height: 1.45; white-space: pre-wrap; word-wrap: break-word; }" +
      ".rec-msg-assistant { align-self: flex-start; background: #fff; border: 1px solid rgba(0,0,0,0.06); }" +
      ".rec-msg-user { align-self: flex-end; background: var(--rec-color); color: #fff; }" +
      ".rec-streaming::after { content: '\\2022'; animation: rec-blink 1s infinite; margin-left: 4px; }" +
      "@keyframes rec-blink { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0.2; } }" +
      ".rec-form { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-top: 1px solid rgba(0,0,0,0.06); background: #fff; }" +
      ".rec-input { flex: 1; border: 1px solid rgba(0,0,0,0.12); border-radius: 999px; padding: 10px 14px; font-size: 14px; outline: none; }" +
      ".rec-input:focus { border-color: var(--rec-color); }" +
      ".rec-send { all: unset; cursor: pointer; width: 36px; height: 36px; border-radius: 999px; background: var(--rec-color); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }" +
      ".rec-send[disabled] { opacity: 0.5; cursor: not-allowed; }" +
      ".rec-intro { display: none; flex: 1; overflow-y: auto; padding: 18px 16px; background: #fafafa; }" +
      ".rec-root.rec-intro-mode .rec-intro { display: block; }" +
      ".rec-root.rec-intro-mode .rec-messages { display: none; }" +
      ".rec-root.rec-intro-mode .rec-form { display: none; }" +
      ".rec-intro-form { display: flex; flex-direction: column; gap: 10px; }" +
      ".rec-intro-heading { font-size: 13px; color: #333; margin-bottom: 4px; line-height: 1.45; }" +
      ".rec-intro-field { display: flex; flex-direction: column; gap: 4px; }" +
      ".rec-intro-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.04em; }" +
      ".rec-intro-input { border: 1px solid rgba(0,0,0,0.14); border-radius: 8px; padding: 9px 11px; font-size: 14px; outline: none; font-family: inherit; background: #fff; color: #111; }" +
      ".rec-intro-input:focus { border-color: var(--rec-color); }" +
      ".rec-intro-error { color: #b91c1c; font-size: 12px; min-height: 16px; }" +
      ".rec-intro-submit { all: unset; cursor: pointer; background: var(--rec-color); color: #fff; text-align: center; padding: 11px 14px; border-radius: 10px; font-size: 14px; font-weight: 600; margin-top: 4px; }" +
      ".rec-intro-submit[disabled] { opacity: 0.6; cursor: not-allowed; }" +
      "@media (max-width: 480px) { .rec-panel { width: calc(100vw - 16px); right: -8px; bottom: 68px; height: 70vh; } }"
    );
  }
})();
