export async function register() {
  // Validate env vars on server startup (fail-fast in production)
  const { validateEnv } = await import("@/lib/env");
  validateEnv();

  // Vault master KEK check — Node runtime ONLY. The vault crypto
  // module imports `node:crypto`, which Edge runtime forbids. The
  // first iteration of this file dynamic-imported the module
  // unconditionally; Next.js then pulled it into the Edge middleware
  // bundle and the build failed with NOW_SANDBOX_WORKER_EDGE_FUNCTION
  // _UNSUPPORTED_MODULES. Gate via NEXT_RUNTIME so this only runs in
  // the Node boot path.
  //
  // Vault is opt-in (moduleVault flag), so a missing KEK should warn,
  // not fail-fast — orgs without the vault don't need it. The crypto
  // module itself throws clearly on first use if the KEK is bad.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { assertVaultKekConfigured } = await import("@/lib/vault/crypto");
      assertVaultKekConfigured();
      console.log("[instrumentation] vault master KEK configured ok");
    } catch (err) {
      console.warn(
        "[instrumentation] vault master KEK NOT configured — set VAULT_MASTER_KEK_B64 in env before enabling moduleVault on any org. Generate with: openssl rand -base64 32",
        err instanceof Error ? err.message : err,
      );
    }
  }
}
