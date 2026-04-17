import { NextRequest, NextResponse } from "next/server";

// TODO(Sprint 03): rebuild the intake endpoint for the 4-step real-estate
// wizard (Company / Portfolio / Modules / Timeline+Consultation). The new
// endpoint lives at /api/onboarding/route.ts in Sprint 03 and this route is
// either removed or re-exports the new one. For now this stub keeps the route
// tree clean while downstream modules are wired up.
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Intake endpoint is being rebuilt in Sprint 03." },
    { status: 503 }
  );
}
