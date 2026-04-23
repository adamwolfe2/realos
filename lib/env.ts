import { z } from "zod";

/**
 * Validates required environment variables at startup.
 * Import this in instrumentation.ts so the app fails fast on missing config
 * rather than crashing at runtime when a route tries to use an undefined key.
 *
 * Optional integrations (Bloo.io, Firecrawl, etc.) are NOT validated here —
 * those check at call-time since they're per-client template features.
 */

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth (Clerk)
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, "Clerk publishable key is required"),
  CLERK_SECRET_KEY: z.string().min(1, "Clerk secret key is required"),

  // Cron auth
  CRON_SECRET: z.string().min(1, "CRON_SECRET is required for cron job auth"),

  // Email (Resend) — optional in dev but required in production
  RESEND_API_KEY: z.string().optional(),

  // Stripe — optional (only needed if payments are enabled)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // AI — required for AI-powered routes (quote generation, assistant, etc.)
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required for AI features"),

  // Infrastructure provisioning — domain attachment via Vercel API
  VERCEL_API_TOKEN: z.string().optional(),

  // Admin bootstrap — grants super-admin access
  BOOTSTRAP_SECRET: z.string().min(1, "BOOTSTRAP_SECRET is required for admin bootstrap"),

  // Clerk webhook verification
  CLERK_WEBHOOK_SECRET: z.string().min(1, "CLERK_WEBHOOK_SECRET is required for webhook verification"),

  // Rate limiting (KV store) — warn if missing in production
  KV_REST_API_URL: z.string().optional(),
  KV_REST_API_TOKEN: z.string().optional(),

  // Public app URL (used by client-side code for canonical URLs, OAuth redirects, etc.)
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL"),
});

export type Env = z.infer<typeof envSchema>;

let _validated = false;

export function validateEnv(): Env {
  if (_validated) return process.env as unknown as Env;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // DECISION: warn-only. The marketing surface must stay up before Neon,
    // Clerk, Anthropic, and Stripe land on Vercel. Routes that truly need a
    // missing key will throw at call time with a more specific error that
    // tells the operator exactly what to configure. A hard throw here took
    // the whole domain down including static pages like /sitemap.xml.
    console.warn(
      `\n[env] Missing or invalid environment variables (marketing site will render, feature routes may fail):\n${missing}\n`
    );
  }

  // Warn if KV (rate limiting) is missing in production
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN)
  ) {
    console.warn(
      "[env] KV_REST_API_URL / KV_REST_API_TOKEN not set — rate limiting will be disabled in production"
    );
  }

  _validated = true;
  return (result.success ? result.data : process.env) as unknown as Env;
}
