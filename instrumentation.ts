export async function register() {
  // Validate env vars on server startup (fail-fast in production)
  const { validateEnv } = await import("@/lib/env");
  validateEnv();
}
