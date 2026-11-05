// CJS require hook: stub `server-only` so one-off scripts can import lib/
// modules that carry the Next.js server guard. Use with
//   tsx --require ./scripts/_no-server-only.cjs <script>
const Module = require("module");
const path = require("path");
const orig = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return path.join(__dirname, "_empty.cjs");
  return orig.call(this, request, ...rest);
};
