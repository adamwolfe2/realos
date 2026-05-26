import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAlSegmentMembersPage } from "@/lib/integrations/al-segments";

// ---------------------------------------------------------------------------
// GET /api/admin/marketplace/diagnose?id=<UUID>
//
// Admin-only Cursive smoke-test. Hits BOTH the audiences and segments
// surfaces with page_size=1 and returns the raw status + a sample of the
// payload keys, so the operator can immediately tell:
//   - is CURSIVE_API_KEY set?
//   - does the ID exist on either surface?
//   - which surface should the source use?
//   - what raw field names does this segment actually carry? (so we can
//     wire the payload extractor to the right keys)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const apiKeySet = !!process.env.CURSIVE_API_KEY?.trim();
  const apiUrl = process.env.CURSIVE_API_URL ?? "https://api.audiencelab.io";

  const [audiencesResult, segmentsResult] = await Promise.all([
    getAlSegmentMembersPage(id, { surface: "audiences", pageSize: 1 }),
    getAlSegmentMembersPage(id, { surface: "segments", pageSize: 1 }),
  ]);

  const summarize = (r: typeof audiencesResult) => {
    if (!r.ok) {
      return { ok: false, status: r.status, message: r.message };
    }
    const first = r.data.members[0];
    return {
      ok: true,
      memberCount: r.data.members.length,
      hasMore: r.data.hasMore,
      sampleKeys: first ? Object.keys(first.raw ?? {}).slice(0, 60) : [],
      sampleProfileId: first?.profileId ?? null,
    };
  };

  return NextResponse.json({
    env: {
      CURSIVE_API_KEY: apiKeySet ? "SET" : "MISSING",
      CURSIVE_API_URL: apiUrl,
    },
    segmentId: id,
    audiences: summarize(audiencesResult),
    segments: summarize(segmentsResult),
    recommendation:
      audiencesResult.ok && audiencesResult.data.members.length > 0
        ? "Use kind=CURSIVE_AUDIENCE for this id."
        : segmentsResult.ok && segmentsResult.data.members.length > 0
          ? "Use kind=CURSIVE_SEGMENT for this id."
          : "Neither surface returned members. Check the ID + API key permissions.",
  });
}
