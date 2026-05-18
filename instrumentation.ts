export async function register() {
  // Validate env vars on server startup (fail-fast in production)
  const { validateEnv } = await import("@/lib/env");
  validateEnv();

  // Vault master KEK check — warn at boot if it's missing/malformed
  // rather than fail-fast, because the vault is opt-in (moduleVault).
  // Orgs without the vault enabled don't need the KEK, so blocking
  // boot on a missing KEK would punish every tenant for a feature
  // most don't use. The crypto module itself throws clearly on first
  // encrypt/decrypt if the KEK is bad, so the error surface is still
  // honest — we just don't punish unrelated traffic.
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
