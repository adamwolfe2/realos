import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getScope } from "@/lib/tenancy/scope";
import { getResend } from "@/lib/email/shared";
import { BRAND_NAME } from "@/lib/brand";

// ---------------------------------------------------------------------------
// POST /api/bug-report
//
// Captures bug reports from the in-app floating button. Files an issue on
// GitHub (when GITHUB_TOKEN + GITHUB_BUG_REPORT_REPO are set) and emails the
// ops inbox so Adam gets paged immediately during audits / demos.
//
// Auth: any signed-in user. We attach their email + org so the report has
// enough context to reproduce. Anonymous reports are rejected to avoid spam.
// ---------------------------------------------------------------------------

const SEVERITIES = ["low", "medium", "high", "blocker"] as const;

const body = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(5).max(8000),
  severity: z.enum(SEVERITIES).default("medium"),
  pageUrl: z.string().url().max(2048).optional(),
  pagePath: z.string().max(512).optional(),
  userAgent: z.string().max(512).optional(),
  viewport: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  const scope = await getScope();
  if (!scope) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  let parsed;
  try {
    parsed = body.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid body", details: err.issues },
        { status: 400 }
      );
    }
    throw err;
  }

  const reporterLabel = `${scope.email} (${
    scope.isAgency ? "agency" : "client"
  } / ${scope.role})`;
  const reporterPublicLabel = `${scope.isAgency ? "agency" : "client"} / ${scope.role}`;

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

  if (!github.ok && !email.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to file bug report",
        github: github.error,
        email: email.error,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    githubUrl: github.ok ? github.url ?? null : null,
    githubIssueNumber: github.ok ? github.number ?? null : null,
    emailSent: email.ok,
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
}): string {
  const lines = [
    `**Severity:** ${input.severity}`,
    `**Reporter:** ${input.reporter}`,
    input.orgId ? `**Org ID:** \`${input.orgId}\`` : null,
    input.pageUrl ? `**URL:** ${input.pageUrl}` : null,
    input.pagePath ? `**Path:** \`${input.pagePath}\`` : null,
    input.viewport ? `**Viewport:** ${input.viewport}` : null,
    input.userAgent ? `**User-Agent:** ${input.userAgent}` : null,
    "",
    "---",
    "",
    input.description,
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
      return { ok: false, error: `GitHub ${res.status}: ${errText.slice(0, 300)}` };
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
    "adam@leasestack.co";
  const from =
    process.env.RESEND_FROM_EMAIL ?? `${BRAND_NAME} <hello@leasestack.co>`;

  const html = `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:14px;color:#0a0a0a;">
      <p style="margin:0 0 12px;"><strong>Severity:</strong> ${escapeHtml(
        input.severity
      )}</p>
      <p style="margin:0 0 12px;"><strong>From:</strong> ${escapeHtml(input.reporter)}</p>
      <pre style="white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;background:#f6f3ee;padding:12px;border:1px solid #e5e1db;">${escapeHtml(
        input.body
      )}</pre>
    </div>
  `;
  try {
    await resend.emails.send({
      from,
      to,
      subject: `[${input.severity.toUpperCase()}] ${input.title}`,
      html,
      headers: {
        // Bug-report emails go to internal addresses (BRAND_EMAIL),
        // never to customers — but we still ship the deliverability
        // headers so they don't get treated like a stripped-down
        // bot send by Gmail's filters.
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
