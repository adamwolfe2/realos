import { NextRequest } from "next/server";
import { handleOAuthCallback } from "@/lib/integrations/oauth-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleOAuthCallback(req, "meta-ads");
}
