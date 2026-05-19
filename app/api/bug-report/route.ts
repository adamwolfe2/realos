import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { put } from "@vercel/blob";
import { BugReportSeverity, BugReportStatus, Prisma } from "@prisma/client";
import { getScope } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { getResend } from "@/lib/email/shared";
import { BRAND_NAME } from "@/lib/brand";
import {
  bugReportLimiter,
  checkRateLimit,
  rateLimited,
} from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// POST /api/bug-report
//
// Captures bug reports from the in-app floating button. Three side
// effects in parallel:
//   1. Persists a BugReport row to our own DB so /admin/bug-reports
//      has a triage queue + approval workflow
//   2. Files a GitHub issue (when GITHUB_TOKEN + GITHUB_BUG_REPORT_REPO
//      are set) so engineering has it in their standard tracker
//   3. Emails the ops inbox so Adam gets paged immediately
//
// Body: multipart/form-data OR application/json
//   - When multipart: fields + optional `images` (1-5 files, ≤8MB each)
//     uploaded to Vercel Blob under bug-reports/<reportId>/
//   - When JSON: same fields, no images
//
// Auth: any signed-in user. We attach their email + org so the report
// has enough context to reproduce. Anonymous reports are rejected to
// avoid spam.
// ---------------------------------------------------------------------------

const SEVERITIES = ["low", "medium", "high", "blocker"] as const;
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB per image
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const inputSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(5).max(8000),
  severity: z.enum(SEVERITIES).default("medium"),
  pageUrl: z.string().url().max(2048).optional(),
  pagePath: z.string().max(512).optional(),
  userAgent: z.string().max(512).optional(),
  viewport: z.string().max(64).optional(),
});

type Attachment = {
  url: string;
  pathname: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
};

function severityEnum(value: string): BugReportSeverity {
  switch (value) {
    case "low":
      return BugReportSeverity.LOW;
    case "high":
      return BugReportSeverity.HIGH;
    case "blocker":
      return BugReportSeverity.BLOCKER;
    default:
      return BugReportSeverity.MEDIUM;
  }
}

export async function POST(req: NextRequest) {
  const scope = await getScope();
  if (!scope) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  // Rate-limit BEFORE parsing the multipart body — `req.formData()`
  // streams up to 5×8 MB into memory and pays the storage cost, so a
  // malicious authenticated user could otherwise script `for i in
  // $(seq 1 10000)` and burn through Vercel Blob quota. 30/hour per
  // user is generous for legitimate QA while stopping a runaway loop
  // flat.
  const rl = await checkRateLimit(bugReportLimiter, scope.userId);
  if (!rl.allowed) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((rl.reset - Date.now()) / 1000),
    );
    return rateLimited(
      "Too many bug reports — try again in a few minutes.",
      retryAfterSec,
    );
  }

  // Branch on content-type: multipart for image uploads, JSON for the
  // legacy path. Both end up at the same persistence + side-effects
  // pipeline below.
  const contentType = req.headers.get("content-type") ?? "";
  let parsed: z.infer<typeof inputSchema>;
  let imageFiles: File[] = [];

  if (contentType.startsWith("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid form body" },
        { status: 400 },
      );
    }
    const raw = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      severity: String(form.get("severity") ?? "medium"),
      pageUrl: form.get("pageUrl") ? String(form.get("pageUrl")) : undefined,
      pagePath: form.get("pagePath") ? String(form.get("pagePath")) : undefined,
      userAgent: form.get("userAgent") ? String(form.get("userAgent")) : undefined,
      viewport: form.get("viewport") ? String(form.get("viewport")) : undefined,
    };
    const validate = inputSchema.safeParse(raw);
    if (!validate.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid body", details: validate.error.issues },
        { status: 400 },
      );
    }
    parsed = validate.data;

    const rawFiles = form.getAll("images");
    for (const f of rawFiles) {
      if (!(f instanceof File)) continue;
      // Skip phantom blob inputs that fire on Safari with no real file
      if (f.size === 0) continue;
      imageFiles.push(f);
    }
    if (imageFiles.length > MAX_IMAGES) {
      return NextResponse.json(
        { ok: false, error: `Maximum ${MAX_IMAGES} screenshots per report.` },
        { status: 413 },
      );
    }
    for (const f of imageFiles) {
      if (f.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { ok: false, error: `${f.name} exceeds 8 MB limit.` },
          { status: 413 },
        );
      }
      if (!ALLOWED_IMAGE_TYPES.has(f.type)) {
        return NextResponse.json(
          { ok: false, error: `${f.name}: unsupported file type (${f.type}).` },
          { status: 415 },
        );
      }
    }
  } else {
    try {
      const json = await req.json();
      const validate = inputSchema.safeParse(json);
      if (!validate.success) {
        return NextResponse.json(
          { ok: false, error: "Invalid body", details: validate.error.issues },
          { status: 400 },
        );
      }
      parsed = validate.data;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 },
      );
    }
  }

  const reporterLabel = `${scope.email} (${
    scope.isAgency ? "agency" : "client"
  } / ${scope.role})`;
  const reporterPublicLabel = `${scope.isAgency ? "agency" : "client"} / ${scope.role}`;

  // Get the reporter's org name once for the BugReport row. Best-effort
  // — never let a slow DB call fail the report submission.
  const reporterOrgName = await prisma.organization
    .findUnique({
      where: { id: scope.orgId },
      select: { name: true },
    })
    .then((o) => o?.name ?? null)
    .catch(() => null);

  // 1. Insert the BugReport row immediately so we have an id to scope
  // image uploads under. Status PENDING, no attachments yet.
  const report = await prisma.bugReport.create({
    data: {
      userId: scope.userId,
      reporterEmail: scope.email,
      reporterRole: String(scope.role),
      reporterOrgId: scope.orgId,
      reporterOrgName,
      title: parsed.title,
      description: parsed.description,
      severity: severityEnum(parsed.severity),
      status: BugReportStatus.PENDING,
      pageUrl: parsed.pageUrl,
      pagePath: parsed.pagePath,
      userAgent: parsed.userAgent,
      viewport: parsed.viewport,
      attachments: [],
      timeline: [
        {
          at: new Date().toISOString(),
          by: scope.userId,
          byEmail: scope.email,
          kind: "status",
          to: BugReportStatus.PENDING,
          text: "Report submitted",
        },
      ],
    },
  });

  // 2. Upload screenshots in parallel under bug-reports/<reportId>/.
  // We pre-validate content-type + size above; Vercel Blob just
  // stores. addRandomSuffix:true ensures collisions never happen
  // across re-uploads of files with the same name.
  const attachments: Attachment[] = [];
  if (imageFiles.length > 0) {
    const uploads = await Promise.allSettled(
      imageFiles.map(async (f) => {
        // Sanitize the filename used in the blob path:
        //   - Replace any non-[A-Za-z0-9._-] with _
        //   - Strip leading dots/underscores to defeat hidden-file
        //     conventions + naive ".." traversal segments
        //   - Default to "upload" if the result is empty (e.g. ".....")
        //   - Cap at 100 chars
        // The prefix `bug-reports/${report.id}/` is fixed and `put`
        // doesn't honor `..` segments, so real path traversal is
        // already impossible, but tighten defensively.
        const safeName =
          f.name
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .replace(/^[._]+/, "")
            .slice(0, 100) || "upload";
        const blob = await put(
          `bug-reports/${report.id}/${safeName}`,
          f,
          { access: "public", addRandomSuffix: true, contentType: f.type },
        );
        return {
          url: blob.url,
          pathname: blob.pathname,
          contentType: f.type,
          sizeBytes: f.size,
          uploadedAt: new Date().toISOString(),
        };
      }),
    );
    for (const result of uploads) {
      if (result.status === "fulfilled") attachments.push(result.value);
      else {
        // A failed upload should not kill the whole report. Log and
        // surface in the response so the UI can re-prompt.
        console.error("[bug-report] image upload failed:", result.reason);
      }
    }
    if (attachments.length > 0) {
      await prisma.bugReport.update({
        where: { id: report.id },
        data: { attachments: attachments as Prisma.InputJsonValue },
      });
    }
  }

  const issueTitle = `[Bug] ${parsed.title}`;
  // GitHub body — repo may be public, so omit reporter email and orgId.
  // The full reporter context still goes to the ops email below.
  const githubBody = renderIssueBody({
    description: parsed.description,
    severity: parsed.severity,
    reporter: reporterPublicLabel,
    orgId: null,
    pageUrl: parsed.pageUrl,
    pagePath: parsed.pagePath,
    userAgent: parsed.userAgent,
    viewport: parsed.viewport,
    attachments,
    adminUrl: null,
  });
  const emailBody = renderIssueBody({
    description: parsed.description,
    severity: parsed.severity,
    reporter: reporterLabel,
    orgId: scope.orgId,
    pageUrl: parsed.pageUrl,
    pagePath: parsed.pagePath,
    userAgent: parsed.userAgent,
    viewport: parsed.viewport,
    attachments,
    adminUrl: `/admin/bug-reports/${report.id}`,
  });

  const [github, email] = await Promise.all([
    fileGithubIssue({
      title: issueTitle,
      body: githubBody,
      severity: parsed.severity,
    }),
    sendEmailNotification({
      title: issueTitle,
      body: emailBody,
      severity: parsed.severity,
      reporter: reporterLabel,
    }),
  ]);

  // 3. Update the row with side-effect outcomes (don't block the
  // response on these — the row already exists either way).
  await prisma.bugReport
    .update({
      where: { id: report.id },
      data: {
        githubIssueNumber: github.ok ? github.number ?? null : null,
        githubIssueUrl: github.ok ? github.url ?? null : null,
        emailSent: email.ok,
      },
    })
    .catch(() => {
      /* non-fatal */
    });

  if (!github.ok && !email.ok) {
    // Both side effects failed but we DID persist the row. Surface a
    // soft warning rather than a hard error so the user knows their
    // report was received but ops weren't paged.
    return NextResponse.json({
      ok: true,
      reportId: report.id,
      warning: "Report saved, but notification side-effects failed.",
      attachmentCount: attachments.length,
    });
  }

  return NextResponse.json({
    ok: true,
    reportId: report.id,
    githubUrl: github.ok ? github.url ?? null : null,
    githubIssueNumber: github.ok ? github.number ?? null : null,
    emailSent: email.ok,
    attachmentCount: attachments.length,
  });
}

function renderIssueBody(input: {
  description: string;
  severity: string;
  reporter: string;
  orgId: string | null;
  pageUrl?: string;
  pagePath?: string;
  userAgent?: string;
  viewport?: string;
  attachments: Attachment[];
  adminUrl: string | null;
}): string {
  const lines = [
    `**Severity:** ${input.severity}`,
    `**Reporter:** ${input.reporter}`,
    input.orgId ? `**Org ID:** \`${input.orgId}\`` : null,
    input.adminUrl ? `**Admin link:** ${input.adminUrl}` : null,
    input.pageUrl ? `**URL:** ${input.pageUrl}` : null,
    input.pagePath ? `**Path:** \`${input.pagePath}\`` : null,
    input.viewport ? `**Viewport:** ${input.viewport}` : null,
    input.userAgent ? `**User-Agent:** ${input.userAgent}` : null,
    "",
    "---",
    "",
    input.description,
    "",
    input.attachments.length > 0 ? "---" : null,
    input.attachments.length > 0
      ? `**Screenshots (${input.attachments.length}):**`
      : null,
    ...input.attachments.map((a) => `- ${a.url}`),
    "",
    "---",
    `_Filed via in-app bug-report button at ${new Date().toISOString()}_`,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

type GhResult =
  | { ok: true; url?: string; number?: number }
  | { ok: false; error: string };

async function fileGithubIssue(input: {
  title: string;
  body: string;
  severity: string;
}): Promise<GhResult> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_BUG_REPORT_REPO;
  if (!token || !repo) {
    return { ok: false, error: "GitHub bug-report repo not configured" };
  }
  if (!repo.includes("/")) {
    return { ok: false, error: "GITHUB_BUG_REPORT_REPO must be 'owner/repo'" };
  }
  try {
    const labels = ["bug", "in-app-report", `severity:${input.severity}`];
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        labels,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        error: `GitHub ${res.status}: ${errText.slice(0, 300)}`,
      };
    }
    const json = (await res.json()) as { html_url?: string; number?: number };
    return { ok: true, url: json.html_url, number: json.number };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "GitHub call failed",
    };
  }
}

type EmailResult = { ok: true } | { ok: false; error: string };

async function sendEmailNotification(input: {
  title: string;
  body: string;
  severity: string;
  reporter: string;
}): Promise<EmailResult> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "Resend not configured" };

  const to =
    process.env.BUG_REPORT_EMAIL ??
    process.env.ADMIN_EMAIL ??
    "team@leasestack.co";
  const from =
    process.env.RESEND_FROM_EMAIL ?? `${BRAND_NAME} <team@leasestack.co>`;
  // Always cc the canonical ops inbox so triage isn't dependent on a
  // single forwarder. Skip if `to` already routes there.
  const TEAM_INBOX = "team@leasestack.co";
  const cc = to.includes(TEAM_INBOX) ? undefined : TEAM_INBOX;

  const html = `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:14px;color:#0a0a0a;">
      <p style="margin:0 0 12px;"><strong>Severity:</strong> ${escapeHtml(input.severity)}</p>
      <p style="margin:0 0 12px;"><strong>From:</strong> ${escapeHtml(input.reporter)}</p>
      <pre style="white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;background:#f6f3ee;padding:12px;border:1px solid #e5e1db;">${escapeHtml(
        input.body,
      )}</pre>
    </div>
  `;
  try {
    await resend.emails.send({
      from,
      to,
      ...(cc ? { cc } : {}),
      subject: `[${input.severity.toUpperCase()}] ${input.title}`,
      html,
      headers: {
        "List-Unsubscribe": `<mailto:${process.env.UNSUBSCRIBE_EMAIL?.trim() ?? "unsubscribe@leasestack.co"}>`,
        "X-Entity-Ref-ID": `bug-report-${Date.now().toString(36)}`,
      },
      tags: [
        { name: "template", value: "bug-report" },
        { name: "category", value: "transactional" },
      ],
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Email send failed",
    };
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
