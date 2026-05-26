import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import { logPacketDownload } from "@/app/admin/site-engine/[id]/actions";

// ---------------------------------------------------------------------------
// GET /api/site-requests/[id]/packet
//
// Builds the zip Adam (or whoever is fulfilling) pulls into a local
// Claude Code session to start the actual build. Contents:
//
//   /intake.json              — full SiteRequest + IntakeResponse payload
//   /README.md                — build kickoff instructions tailored to this row
//   /assets/MANIFEST.json     — every uploaded asset (url, type, label, size)
//   /assets/<filename>        — fetched blob bytes (best-effort)
//
// Asset bytes are fetched from Vercel Blob inline. Failures don't abort
// the packet — they're recorded in MANIFEST.json so the builder can pull
// them manually if needed.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireAgency();
  } catch {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const sr = await prisma.siteRequest.findUnique({
    where: { id },
    include: { intake: true, assets: true, org: true },
  });
  if (!sr) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const zip = new JSZip();

  // 1. Canonical intake payload — feeds the build prompts directly.
  const intakePayload = {
    siteRequest: {
      id: sr.id,
      slug: sr.slug,
      tier: sr.tier,
      status: sr.status,
      submittedAt: sr.submittedAt.toISOString(),
      source: sr.source,
      utm: {
        source: sr.utmSource,
        medium: sr.utmMedium,
        campaign: sr.utmCampaign,
      },
      submitter: {
        name: sr.submittedByName,
        email: sr.submittedByEmail,
        phone: sr.submittedByPhone,
        company: sr.submittedByCompany,
      },
      linkedOrg: sr.org
        ? { id: sr.org.id, name: sr.org.name, slug: sr.org.slug }
        : null,
    },
    intake: sr.intake,
  };
  zip.file("intake.json", JSON.stringify(intakePayload, null, 2));

  // 2. README scaffolds the local Claude Code session.
  const brandName = sr.intake?.brandName ?? sr.submittedByName;
  const readme = `# Build packet — ${brandName}

Site request: \`${sr.slug}\`
Submitted: ${sr.submittedAt.toISOString()}
Tier: ${sr.tier}
${sr.intake?.timelineExpectation ? `Target timeline: ${sr.intake.timelineExpectation}` : ""}

## What's in this packet

- \`intake.json\` — every form answer the client provided
- \`prompt-09-kickoff.md\` — the prompt to paste into Claude Code first
- \`site.spec.template.json\` — starter shape; Prompt 02 fills this in
- \`assets/MANIFEST.json\` — uploaded asset metadata (urls, sizes, types)
- \`assets/<type>/*\` — best-effort downloaded copies of each asset

## Build kickoff

1. Unzip into a fresh directory.
2. Open it in Claude Code.
3. Paste the contents of \`prompt-09-kickoff.md\` as your first message.
4. Confirm the variables at the top of that prompt (slug, repo name, kit path).
5. Follow the prompt sequence (01 → 02 → 05 → 03 → 04 → audits → deploy).
6. Paste the resulting GitHub URL + Vercel preview URL into \`/admin/site-engine/${sr.id}\`.

## Inspiration

${
  sr.intake?.inspirationUrls?.length
    ? sr.intake.inspirationUrls.map((u) => `- ${u}`).join("\n")
    : "_None provided._"
}

## Preset

${sr.intake?.presetChoice ?? "_None chosen — pick the closest one in the kit._"}

## Notes from the client

${sr.intake?.anythingElse ?? "_(none)_"}
`;
  zip.file("README.md", readme);

  // Prompt 09 — embedded so the operator doesn't need to switch tabs. Kept
  // in sync with the canonical copy in site-engine-kit/prompts/.
  zip.file("prompt-09-kickoff.md", PROMPT_09_KICKOFF);

  // Site spec scaffold — Prompt 02 fills this in. Including the empty
  // shape here gives the operator a target structure even before they
  // run the merger.
  const specTemplate = {
    version: 1,
    siteRequestId: sr.id,
    slug: sr.slug,
    generatedAt: null,
    brand: {
      name: sr.intake?.brandName ?? sr.submittedByName,
      tagline: sr.intake?.tagline ?? null,
      vertical: sr.intake?.vertical ?? null,
      primaryColor: sr.intake?.brandColorHex ?? null,
      accentColor: null,
      voice: sr.intake?.voiceSample ? "extracted-from-sample" : null,
      compliance: {
        license: sr.intake?.licenseNumber ?? null,
        brokerage: sr.intake?.brokerageName ?? null,
        state: sr.intake?.licenseState ?? null,
      },
    },
    preset: sr.intake?.presetChoice ?? null,
    typography: { display: null, body: null, mono: null },
    informationArchitecture: [],
    pages: [],
    content: {
      bio: sr.intake?.bio ?? null,
      services: sr.intake?.services ?? [],
      testimonials: sr.intake?.testimonials ?? [],
      keyStats: sr.intake?.keyStats ?? [],
    },
    integrations: {
      calendly: sr.intake?.calendlyUrl ?? null,
      ga4: sr.intake?.ga4Id ?? null,
      mlsPreference: sr.intake?.mlsPreference ?? null,
    },
    domain: {
      host: sr.intake?.domain ?? null,
      registrar: "unknown",
      dnsAccess: sr.intake?.dnsAccess ?? null,
    },
    conflicts: [],
  };
  zip.file("site.spec.template.json", JSON.stringify(specTemplate, null, 2));

  // 3. Asset manifest + best-effort downloads.
  const assetsFolder = zip.folder("assets")!;
  const manifest: Array<{
    type: string;
    filename: string;
    mimeType: string;
    size: number;
    url: string;
    downloaded: boolean;
    error?: string;
  }> = [];

  for (const asset of sr.assets) {
    let downloaded = false;
    let errMsg: string | undefined;
    try {
      const r = await fetch(asset.blobUrl);
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        const safe = asset.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        // Prefix with the type so the builder can sort visually in Finder.
        assetsFolder.file(`${asset.type.toLowerCase()}/${safe}`, buf);
        downloaded = true;
      } else {
        errMsg = `HTTP ${r.status}`;
      }
    } catch (err) {
      errMsg = err instanceof Error ? err.message : "fetch failed";
    }
    manifest.push({
      type: asset.type,
      filename: asset.filename,
      mimeType: asset.mimeType,
      size: asset.size,
      url: asset.blobUrl,
      downloaded,
      error: errMsg,
    });
  }
  assetsFolder.file("MANIFEST.json", JSON.stringify(manifest, null, 2));

  // 4. Audit log — record that the packet was pulled so the timeline shows
  // who started the build and when.
  await logPacketDownload(id).catch(() => undefined);

  const blob = await zip.generateAsync({ type: "nodebuffer" });
  const filename = `site-request-${sr.slug}-${brandName.replace(/[^a-zA-Z0-9-]/g, "_")}.zip`;

  // Re-wrap as a plain Uint8Array<ArrayBuffer> so it satisfies BodyInit —
  // @types/node types Buffer over ArrayBufferLike, which the Response body
  // union rejects.
  return new NextResponse(new Uint8Array(blob), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// ---------------------------------------------------------------------------
// Inline copy of site-engine-kit/prompts/09-claude-code-session-kickoff.md
// kept in this file so the packet endpoint has zero filesystem dependencies
// (Vercel builds don't bundle external repos). When the canonical version in
// site-engine-kit changes materially, update this constant to match.
// ---------------------------------------------------------------------------
const PROMPT_09_KICKOFF = `# Prompt 09 — Claude Code Session Kickoff

This is the **first prompt** you paste into a fresh Claude Code session after unzipping a build packet.

## Context

Your working directory contains:

- \`intake.json\` — full SiteRequest + IntakeResponse payload
- \`README.md\` — tailored to this client
- \`site.spec.template.json\` — starter shape; Prompt 02 writes \`site.spec.json\` from it
- \`assets/\` with \`MANIFEST.json\` + downloaded blobs

You also have read access to the master kit at \`$SITE_ENGINE_KIT\` (default \`~/site-engine-kit\`).

## Variables to confirm

- \`SITE_REQUEST_ID\` — from \`intake.json.siteRequest.id\`
- \`SITE_REQUEST_SLUG\` — from \`intake.json.siteRequest.slug\`
- \`CLIENT_REPO_NAME\` — proposed \`am-collective-clients/<slug>\`
- \`VERCEL_TEAM_SCOPE\` — \`am-collective\`
- \`LEASESTACK_APP_URL\` — \`https://leasestack.co\`
- \`SITE_ENGINE_KIT\` — local path, default \`~/site-engine-kit\`

## Sequence

| # | Prompt | Purpose |
|---|---|---|
| 01 | reverse-prd-extraction | One run per inspiration URL |
| 02 | intake-to-spec-merger | Merge into canonical \`site.spec.json\` |
| — | **pause for Adam's spec review** | Resolve any \`conflicts[]\` |
| 05 | image-asset-processing | Process \`assets/\` into web-ready variants |
| 03 | build-site-from-spec | Scaffold client repo from \`starter-template\` |
| 04 | content-generation | Fill copy gaps in \`lib/site.config.ts\` |
| — | Local validation | \`pnpm typecheck && pnpm lint && pnpm build && pnpm dev\` |
| — | Audits | \`/security-audit\` + \`/performance-audit\` |
| — | Preview deploy | \`vercel deploy --yes\` |
| — | Hand back | Paste preview URL + GitHub URL into LeaseStack admin |

## Hard rules

- Every site is custom. Never ship a clone.
- Components come from \`site-engine-kit/components/\` — write new ones only when no existing one fits.
- Voice patterns from \`intake.voiceSample\` — never generic marketing copy.
- License + brokerage in the footer of every page for residential RE.
- Mobile-first. Verify at 375px before declaring done.
`;
