import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { EditorClient, type ChatMessage } from "./editor-client";

export const metadata: Metadata = { title: "Edit draft" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/content/[id] — the AI-powered content editor.
//
// Server component: resolves scope, loads the ContentDraft + the org's
// SiteIntelligence row (brand voice + cornerstone pages) so the chat
// assistant can ground its responses. Hands everything to the client
// editor which owns TipTap + the streaming chat sidebar.
// ---------------------------------------------------------------------------

type RouteProps = { params: Promise<{ id: string }> };

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.role === "user" || v.role === "assistant") &&
    typeof v.content === "string"
  );
}

function parseChatThread(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isChatMessage).map((m) => ({
    role: m.role,
    content: m.content,
    ts: typeof m.ts === "string" ? m.ts : new Date().toISOString(),
  }));
}

export default async function ContentDraftEditorPage(props: RouteProps) {
  const scope = await requireScope();
  const { id } = await props.params;

  const where: Record<string, unknown> = { id, ...tenantWhere(scope) };

  const draft = await prisma.contentDraft.findFirst({
    where: where as never,
    select: {
      id: true,
      format: true,
      brief: true,
      targetQuery: true,
      status: true,
      htmlBody: true,
      outputMarkdown: true,
      output: true,
      aiContext: true,
      chatThread: true,
      estimatedScore: true,
      createdAt: true,
      updatedAt: true,
      propertyId: true,
      property: { select: { id: true, name: true } },
    },
  });

  if (!draft) notFound();

  // Property-RBAC: if the operator is restricted and this draft is
  // anchored to a property outside their set, treat it as missing.
  if (
    scope.allowedPropertyIds &&
    draft.propertyId &&
    !scope.allowedPropertyIds.includes(draft.propertyId)
  ) {
    notFound();
  }

  // Shipped drafts redirect to the read-only viewer the agent uses.
  // The inline editor is for in-flight pieces only — once shipped a
  // draft becomes an immutable record.
  if (draft.status === "SHIPPED" || draft.status === "EXPIRED") {
    redirect(`/portal/content`);
  }

  // SiteIntelligence: pull brand voice + the first 3 crawled pages so
  // the chat assistant can stay on-voice. Best-effort — drafts work
  // fine even if intelligence has never run.
  const intel = await prisma.siteIntelligence.findUnique({
    where: { orgId: scope.orgId },
    select: { brandVoice: true, pages: true },
  });

  type IntelPage = { url?: string; title?: string; markdown?: string };
  const rawPages = Array.isArray(intel?.pages) ? (intel.pages as unknown[]) : [];
  const pages: IntelPage[] = rawPages
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .slice(0, 5)
    .map((p) => ({
      url: typeof p.url === "string" ? p.url : undefined,
      title: typeof p.title === "string" ? p.title : undefined,
      markdown: typeof p.markdown === "string" ? p.markdown : undefined,
    }));

  const initialMessages = parseChatThread(draft.chatThread);

  const initialTitle =
    (draft.output as { title?: string } | null)?.title ??
    (draft.htmlBody?.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] ?? "") ??
    "Untitled draft";

  return (
    <EditorClient
      draftId={draft.id}
      format={draft.format}
      status={draft.status}
      initialTitle={initialTitle}
      initialHtml={draft.htmlBody ?? ""}
      initialMessages={initialMessages}
      brandVoice={intel?.brandVoice ?? null}
      cornerstonePages={pages}
    />
  );
}
