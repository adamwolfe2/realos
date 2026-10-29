"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatbotCaptureMode } from "@prisma/client";

export type PreviewDraft = {
  chatbotAvatarUrl: string;
  chatbotPersonaName: string;
  chatbotGreeting: string;
  chatbotFollowUpMessage: string;
  chatbotTeaserText: string;
  chatbotBrandColor: string;
  chatbotCaptureMode: ChatbotCaptureMode;
  chatbotKnowledgeBase: string;
  chatbotIdleTriggerSeconds: number;
};

export type PreviewBase = {
  slug: string;
  brandName: string;
  orgName: string;
  primaryCtaText: string | null;
  primaryCtaUrl: string | null;
  phoneNumber: string | null;
  contactEmail: string | null;
};

/**
 * The real embed (public/embed/chatbot.js) in preview mode, inside a
 * sandboxed frame. Config is posted in with the same shape and defaults as
 * /api/public/chatbot/config, so this is exactly what visitors get. Test
 * messages come back out to us and are answered by the signed-in
 * preview-chat route from the unsaved draft.
 */
export function EmbedPreview({ state, base, orgPrimaryColor, resetKey }: { state: PreviewDraft; base: PreviewBase; orgPrimaryColor: string | null; resetKey: number }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const draft = useRef(state);
  draft.current = state;

  useEffect(() => {
    const src = `${window.location.origin}/embed/chatbot.js`;
    setSrcDoc(`<!doctype html><html><head><style>html,body{margin:0;height:100%;background:transparent}</style></head><body><script src="${src}" data-slug="${base.slug}" data-preview="1"></script></body></html>`);
    const post = (msg: unknown) => frame.current?.contentWindow?.postMessage(msg, "*");
    const onMessage = async (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === "leasestack:preview-ready") setReady(true);
      if (e.data?.type !== "leasestack:preview-send") return;
      const d = draft.current;
      try {
        const res = await fetch("/api/portal/chatbot/preview-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: e.data.history,
            draft: { personaName: d.chatbotPersonaName, greeting: d.chatbotGreeting, knowledgeBase: d.chatbotKnowledgeBase, captureMode: d.chatbotCaptureMode },
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok || !json.text) throw new Error(json.error ?? `Test reply failed (${res.status})`);
        post({ type: "leasestack:preview-reply", text: json.text });
      } catch (err) {
        console.error("[chatbot preview] test reply failed", err);
        post({ type: "leasestack:preview-reply", text: err instanceof Error ? err.message : "Test reply failed.", error: true });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [base.slug]);

  useEffect(() => {
    if (!ready) return;
    const config = {
      enabled: true,
      slug: base.slug,
      brandName: base.brandName,
      personaName: state.chatbotPersonaName || "Leasing",
      greeting: state.chatbotGreeting || `Hi! I'm with ${base.orgName}. What can I help you with?`,
      followUpMessage: state.chatbotFollowUpMessage || null,
      teaserText: state.chatbotTeaserText || "Questions? I'm here.",
      brandColor: state.chatbotBrandColor || orgPrimaryColor || "#111111",
      avatarUrl: state.chatbotAvatarUrl || null,
      captureMode: state.chatbotCaptureMode,
      idleTriggerSeconds: state.chatbotIdleTriggerSeconds,
      primaryCtaText: base.primaryCtaText,
      primaryCtaUrl: base.primaryCtaUrl,
      phoneNumber: base.phoneNumber,
      contactEmail: base.contactEmail,
      ga4MeasurementId: null,
    };
    // Debounced so typing doesn't remount the widget on every key.
    const t = setTimeout(() => frame.current?.contentWindow?.postMessage({ type: "leasestack:preview", config }, "*"), 250);
    return () => clearTimeout(t);
    // Knowledge edits don't change how the widget looks; skip the remount so
    // a test conversation survives them.
  }, [ready, base, orgPrimaryColor, resetKey, state.chatbotPersonaName, state.chatbotGreeting, state.chatbotFollowUpMessage, state.chatbotTeaserText, state.chatbotBrandColor, state.chatbotAvatarUrl, state.chatbotCaptureMode, state.chatbotIdleTriggerSeconds]);

  return srcDoc ? <iframe ref={frame} title="Chatbot preview" srcDoc={srcDoc} sandbox="allow-scripts allow-forms" className="absolute inset-0 h-full w-full" /> : null;
}
