import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    globals: true,
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `import "server-only"` is a Next.js marker that throws if a module is
      // bundled for the client. It has no runtime effect in Node/test
      // environments but doesn't ship a CJS export, so we stub it here so
      // tests can import otherwise-pure server helpers.
      "server-only": path.resolve(__dirname, "__tests__/helpers/server-only-stub.ts"),
    },
  },
});
