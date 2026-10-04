import { after } from "next/server";

// Run best-effort side effects (analytics, internal alerts) after the response
// is sent so they never block it. Outside a request scope (cron, scripts,
// tests) after() throws, so fall back to running inline; callers keep the
// work bounded (short timeouts), and failures are logged, never thrown.
export async function runAfter(
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  const safe = async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[after:${label}] failed:`, err);
    }
  };
  try {
    after(safe);
  } catch {
    // after() unavailable here (no request scope): run inline instead.
    await safe();
  }
}
