import { NextRequest } from "next/server";
import { handleOAuthStart } from "@/lib/integrations/oauth-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleOAuthStart(req, "meta-ads");
}
