// Polyfill `crypto.randomUUID` for non-secure-context origins.
//
// Why this exists: the chatbot widget (`components/chatbot/*`) calls
// `crypto.randomUUID()` unconditionally on mount. That API is only
// available in [secure contexts](https://w3c.github.io/webappsec-secure-contexts/).
// Our tenant tests resolve `*.realestaite.co` to 127.0.0.1 via Chromium's
// --host-resolver-rules so we can exercise the real tenant middleware,
// but the resulting origin is non-secure and the bare call throws.
//
// We polyfill instead of swallowing the error so that any OTHER bug in
// the page surfaces normally.
//
// See BUILD_LOG.md for the underlying product bug. Once the chatbot
// widget guards its own randomUUID call, this polyfill becomes dead code
// and can be removed.

export const SECURE_CONTEXT_POLYFILL = `
(function () {
  if (typeof window === "undefined") return;
  var c = window.crypto || (window.crypto = {});
  if (typeof c.randomUUID !== "function") {
    c.randomUUID = function () {
      // RFC4122 v4 using Math.random — fine for test isolation, NOT
      // fine for security-sensitive identifiers.
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (ch) {
        var r = (Math.random() * 16) | 0;
        var v = ch === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
  }
})();
`;
