import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthStatus = "ok" | "degraded" | "down";

interface HealthCheck {
  status: HealthStatus;
  latencyMs?: number;
  error?: string;
}

async function checkDatabase(): Promise<HealthCheck> {
  const started = Date.now();
  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Date.now() - started };
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

function checkEnv(): HealthCheck {
  const required = [
    "DATABASE_URL",
    "CLERK_SECRET_KEY",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    return { status: "down", error: `missing env: ${missing.join(", ")}` };
  }
  return { status: "ok" };
}

export async function GET() {
  const [database, env] = await Promise.all([
    checkDatabase(),
    Promise.resolve(checkEnv()),
  ]);

  const checks = { database, env };
  const overall: HealthStatus = Object.values(checks).some(
    (c) => c.status === "down"
  )
    ? "down"
    : Object.values(checks).some((c) => c.status === "degraded")
      ? "degraded"
      : "ok";

  return NextResponse.json(
    {
      status: overall,
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      checks,
    },
    { status: overall === "down" ? 503 : 200 }
  );
}
