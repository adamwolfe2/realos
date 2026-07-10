"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { ContentFormat, DraftStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// /portal/content/[id] — TipTap-backed inline editor with streaming chat
// assistant on the left.
//
// Layout
//   ┌─────────────────────────────────────────────────────────────────┐
//   │ ← back  [BLOG]   <Title>           1,420w  Draft  [Submit ▸]   │
//   ├──────────────────┬──────────────────────────────────────────────┤
//   │  Chat thread     │  TipTap editor                               │
//   │  (left, 420px)   │  (right, fills)                              │
//   │  ...history      │   h1   The Title                             │
//   │  textarea        │   p    First paragraph...                    │
//   │  Write Connectors│   bq   Quick answer block                    │
//   │           [send] │   h2   Section heading                       │
//   └──────────────────┴──────────────────────────────────────────────┘
//
// Tag-label gutter: the per-block "h1" / "h2" / "p" / "bq" label that
// hangs in the left margin of each ProseMirror block is the headline
// visual. CSS for it lives at the bottom of this file as a <style jsx
// global> block so it stays co-located with the editor instance.
//
// Streaming: server returns a plain text stream from `streamText()`.
// We read it with `ReadableStream.getReader()` so we don't take a new
// runtime dependency (`useChat` is in @ai-sdk/react which we're not
// installing).
// ---------------------------------------------------------------------------

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  ts: string;
};

const FORMAT_LABEL: Record<ContentFormat, string> = {
  BLOG_POST: "Blog Post",
  NEIGHBORHOOD_PAGE: "Neighborhood Page",
  PROPERTY_DESCRIPTION: "Property Description",
  META_REWRITE: "Meta Rewrite",
  FAQ_BLOCK: "FAQ Block",
  AD_COPY: "Ad Copy",
};

const STATUS_LABEL: Record<DraftStatus, string> = {
  GENERATING: "Generating",
  PENDING_REVIEW: "In review",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
  REJECTED: "Rejected",
  SHIPPED: "Shipped",
  EXPIRED: "Expired",
};

type SaveState = "idle" | "saving" | "saved" | "error";

type Props = {
  draftId: string;
  format: ContentFormat;
  status: DraftStatus;
  initialTitle: string;
  initialHtml: string;
  initialMessages: ChatMessage[];
  brandVoice: string | null;
  cornerstonePages: Array<{ url?: string; title?: string; markdown?: string }>;
};

// ---------------------------------------------------------------------------
// Utility — debounce. Stays inline so we don't expand the dependency
// surface for one helper. Capped at 800ms per the spec.
// ---------------------------------------------------------------------------
function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(
    (...args: Args) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), delayMs);
    },
    [delayMs],
  );
}

function htmlToMarkdown(html: string): string {
  // Lightweight HTML -> markdown for keeping outputMarkdown in sync.
  // Not a full renderer — covers the StarterKit node set (h1-h3, p, ul,
  // ol, blockquote, code, hr, strong/em). Anything else falls back to
  // its inner text. Good enough for downstream consumers that already
  // tolerate stripped formatting.
  if (!html) return "";
  let md = html
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `# ${stripTags(t)}\n\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `## ${stripTags(t)}\n\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `### ${stripTags(t)}\n\n`)
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t) =>
      stripTags(t)
        .split("\n")
        .filter(Boolean)
        .map((line) => `> ${line}`)
        .join("\n") + "\n\n",
    )
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${stripTags(t)}\n`)
    .replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `${stripTags(t)}\n\n`)
    .replace(/<hr\s*\/?>(?:\s*)/gi, "\n---\n\n")
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<br\s*\/?>(?:\s*)/gi, "\n");
  md = stripTags(md);
  return md.replace(/\n{3,}/g, "\n\n").trim();
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

function countWords(html: string): number {
  const text = stripTags(html);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EditorClient(props: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(props.initialTitle);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>(
    props.initialMessages,
  );
  const [chatInput, setChatInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "done" | "error"
  >("idle");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // StarterKit defaults are fine. Heading levels limited to h1-h3
        // because that's what the SEO formats actually use; allowing h4+
        // just clutters the tag gutter.
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder:
          "Start writing, or ask the assistant on the left to draft a section.",
      }),
    ],
    content: props.initialHtml || `<h1>${escapeHtml(props.initialTitle)}</h1><p></p>`,
    immediatelyRender: false, // SSR safety for Next.js
    editorProps: {
      attributes: {
        class:
          "ProseMirror content-editor-prose focus:outline-none min-h-[400px]",
      },
    },
  });

  // Autosave: PATCH /api/portal/content/[id] 800ms after the last edit.
  const debouncedSave = useDebouncedCallback(
    async (html: string, currentTitle: string) => {
      setSaveState("saving");
      try {
        const markdown = htmlToMarkdown(html);
        const res = await fetch(`/api/portal/content/${props.draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            htmlBody: html,
            outputMarkdown: markdown,
            title: currentTitle,
          }),
        });
        if (!res.ok) throw new Error(`save ${res.status}`);
        setSaveState("saved");
      } catch (err) {
        console.error("[content-editor] save failed", err);
        setSaveState("error");
      }
    },
    800,
  );

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const html = editor.getHTML();
      debouncedSave(html, title);
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor, debouncedSave, title]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const wordCount = useMemo(() => {
    if (!editor) return 0;
    return countWords(editor.getHTML());
  }, [editor, saveState]);

  // -------------------------------------------------------------------------
  // Apply an assistant tool-call edit to the document. The chat route
  // can return JSON of shape { __applyEdit: { target, content } } as the
  // final line of its stream — we parse it client-side and dispatch.
  // -------------------------------------------------------------------------
  const applyEdit = useCallback(
    (edit: { target: string; content: string }) => {
      if (!editor) return;
      switch (edit.target) {
        case "title": {
          setTitle(edit.content);
          // Replace the first H1 in the document if it exists, else
          // prepend one.
          const html = editor.getHTML();
          if (/<h1[^>]*>[\s\S]*?<\/h1>/i.test(html)) {
            const next = html.replace(
              /<h1[^>]*>[\s\S]*?<\/h1>/i,
              `<h1>${escapeHtml(edit.content)}</h1>`,
            );
            editor.commands.setContent(next, { emitUpdate: true });
          } else {
            editor.commands.insertContentAt(0, `<h1>${escapeHtml(edit.content)}</h1>`);
          }
          break;
        }
        case "body": {
          editor.commands.setContent(edit.content, { emitUpdate: true });
          break;
        }
        case "section":
        case "metaDescription":
        default: {
          // Append the new section / fragment to the end of the doc.
          editor.commands.focus("end");
          editor.commands.insertContent(edit.content);
          break;
        }
      }
    },
    [editor],
  );

  // -------------------------------------------------------------------------
  // Send a chat message to /api/portal/content/[id]/chat and stream the
  // response back. We use fetch + ReadableStream so we don't need
  // useChat. The server streams plain text via streamText.toTextStreamResponse,
  // and may end the stream with a JSON-encoded line beginning with the
  // sentinel `\n<<APPLY_EDIT>>` for tool calls.
  // -------------------------------------------------------------------------
  const sendChat = useCallback(async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isStreaming || !editor) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: trimmed,
      ts: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setChatInput("");
    setIsStreaming(true);

    // Push a placeholder assistant message we'll stream into.
    let assistantText = "";
    setMessages((m) => [
      ...m,
      { role: "assistant", content: "", ts: new Date().toISOString() },
    ]);

    try {
      const res = await fetch(`/api/portal/content/${props.draftId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          htmlBody: editor.getHTML(),
          title,
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`chat ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Look for tool-call sentinel anywhere in the buffer.
        const sentinelIdx = buffer.indexOf("<<APPLY_EDIT>>");
        if (sentinelIdx >= 0) {
          const visible = buffer.slice(0, sentinelIdx);
          assistantText = visible;
          const payload = buffer.slice(sentinelIdx + "<<APPLY_EDIT>>".length);
          try {
            const parsed = JSON.parse(payload) as {
              target: string;
              content: string;
            };
            applyEdit(parsed);
          } catch {
            // Tool call not yet fully buffered — drop the sentinel from
            // display but keep buffering.
            buffer = visible;
          }
        } else {
          assistantText = buffer;
        }

        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: assistantText,
          };
          return next;
        });
      }
    } catch (err) {
      console.error("[content-editor] chat failed", err);
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = {
          ...next[next.length - 1],
          content:
            assistantText ||
            "Sorry — the assistant errored. Try sending that again.",
        };
        return next;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [
    chatInput,
    isStreaming,
    editor,
    messages,
    props.draftId,
    title,
    applyEdit,
  ]);

  const submitForApproval = useCallback(async () => {
    if (submitState === "submitting") return;
    setSubmitState("submitting");
    try {
      // Flush any pending autosave first so the reviewer sees the
      // latest version.
      if (editor) {
        const html = editor.getHTML();
        await fetch(`/api/portal/content/${props.draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            htmlBody: html,
            outputMarkdown: htmlToMarkdown(html),
            title,
          }),
        });
      }
      const res = await fetch(
        `/api/portal/content/${props.draftId}/submit`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`submit ${res.status}`);
      setSubmitState("done");
      router.push("/portal/content");
    } catch (err) {
      console.error("[content-editor] submit failed", err);
      setSubmitState("error");
    }
  }, [editor, props.draftId, router, submitState, title]);

  return (
    <div className="content-editor flex flex-col h-[calc(100vh-64px)]">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <Link
          href="/portal/content"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Back to content"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden>
            <path
              d="M10 12L6 8L10 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-primary">
          {FORMAT_LABEL[props.format]}
        </span>

        <div className="flex-1 flex items-center justify-center min-w-0 px-4">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (editor) {
                debouncedSave(editor.getHTML(), e.target.value);
              }
            }}
            placeholder="Untitled draft"
            className="w-full max-w-[640px] bg-transparent text-center text-[14px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none truncate"
          />
        </div>

        <span className="text-[11px] font-mono text-muted-foreground tabular-nums whitespace-nowrap">
          {wordCount.toLocaleString()} words
        </span>
        <span
          className="rounded-md bg-muted px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-muted-foreground"
          title={STATUS_LABEL[props.status]}
        >
          {STATUS_LABEL[props.status]}
        </span>
        <SaveIndicator state={saveState} />

        <button
          type="button"
          onClick={submitForApproval}
          disabled={
            submitState === "submitting" ||
            props.status === "PENDING_REVIEW" ||
            props.status === "APPROVED"
          }
          className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitState === "submitting"
            ? "Submitting…"
            : props.status === "PENDING_REVIEW"
              ? "Submitted"
              : "Submit for approval"}
        </button>
      </header>

      {/* Two-column body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[420px_1fr] overflow-hidden">
        {/* Left: chat thread */}
        <aside className="hidden lg:flex flex-col border-r border-border bg-background overflow-hidden">
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          >
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-secondary p-4">
                <p className="text-[12px] text-foreground font-medium">
                  Ask the assistant for help.
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Try: &ldquo;Make the intro punchier&rdquo;,
                  &ldquo;Add an FAQ on permitting&rdquo;, or
                  &ldquo;Rewrite section 3 with more specific numbers.&rdquo;
                </p>
              </div>
            ) : null}
            {messages.map((m, i) => (
              <ChatBubble key={`${m.ts}-${i}`} message={m} />
            ))}
            {isStreaming ? <TypingIndicator /> : null}
          </div>

          <div className="border-t border-border bg-card p-3 space-y-2">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendChat();
                }
              }}
              placeholder="Reply to the assistant…"
              rows={3}
              className="block w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                onClick={() =>
                  setChatInput((c) =>
                    c ? `${c}\n\nWrite ` : "Write ",
                  )
                }
              >
                Write
              </button>
              <button
                type="button"
                className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                onClick={() =>
                  setChatInput((c) =>
                    c ? `${c}\n\nConnectors: ` : "Connectors: ",
                  )
                }
              >
                Connectors
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => void sendChat()}
                disabled={isStreaming || !chatInput.trim()}
                aria-label="Send"
                className="rounded-md bg-primary p-1.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="w-4 h-4"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </aside>

        {/* Right: TipTap editor */}
        <main className="overflow-y-auto bg-background">
          <div className="max-w-3xl mx-auto px-12 py-10">
            <EditorContent editor={editor} />
          </div>
        </main>
      </div>

      <style jsx global>{`
        /* -----------------------------------------------------------------
           Tag-label gutter. Every top-level ProseMirror block gets a
           lowercase tag-name label hanging in the left margin. This is
           the visual feature that makes the editor read as "SEO-formatted
           content" rather than freeform prose. The labels are pseudo-
           elements driven by attribute data so we don't have to touch
           TipTap's render path.
           ----------------------------------------------------------------- */
        .content-editor .content-editor-prose {
          font-family: var(--font-serif, "Instrument Serif"), Georgia, serif;
          color: var(--color-foreground);
          font-size: 17px;
          line-height: 1.65;
          padding-left: 56px; /* gutter for tag labels */
          position: relative;
        }
        .content-editor .content-editor-prose > * {
          position: relative;
          margin-top: 1.1em;
          margin-bottom: 1.1em;
        }
        .content-editor .content-editor-prose > *::before {
          position: absolute;
          left: -56px;
          top: 0.45em;
          width: 40px;
          font-family: var(--font-mono, ui-monospace, "SF Mono", monospace);
          font-size: 10px;
          line-height: 1;
          text-transform: lowercase;
          letter-spacing: 0.04em;
          color: var(--color-muted-foreground);
          background: var(--color-muted);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          padding: 3px 6px;
          text-align: center;
          opacity: 0.85;
          pointer-events: none;
        }
        .content-editor .content-editor-prose > h1 {
          font-size: 32px;
          line-height: 1.2;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .content-editor .content-editor-prose > h1::before { content: "h1"; }
        .content-editor .content-editor-prose > h2 {
          font-size: 24px;
          line-height: 1.3;
          font-weight: 600;
          letter-spacing: -0.005em;
          margin-top: 1.6em;
        }
        .content-editor .content-editor-prose > h2::before { content: "h2"; }
        .content-editor .content-editor-prose > h3 {
          font-size: 19px;
          line-height: 1.35;
          font-weight: 600;
        }
        .content-editor .content-editor-prose > h3::before { content: "h3"; }
        .content-editor .content-editor-prose > p {
          font-size: 16px;
        }
        .content-editor .content-editor-prose > p::before { content: "p"; }
        .content-editor .content-editor-prose > ul::before { content: "ul"; }
        .content-editor .content-editor-prose > ol::before { content: "ol"; }
        .content-editor .content-editor-prose > ul,
        .content-editor .content-editor-prose > ol {
          padding-left: 1.5em;
        }
        .content-editor .content-editor-prose > ul > li,
        .content-editor .content-editor-prose > ol > li {
          margin-top: 0.4em;
          margin-bottom: 0.4em;
        }
        .content-editor .content-editor-prose > pre::before { content: "code"; }
        .content-editor .content-editor-prose > pre {
          background: var(--color-muted);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 12px 16px;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 13px;
          overflow-x: auto;
        }
        .content-editor .content-editor-prose > hr {
          border: 0;
          border-top: 1px solid var(--color-border);
          margin: 2em 0;
        }
        .content-editor .content-editor-prose > hr::before { content: "hr"; }

        /* Blockquote — the AEO "quick answer" treatment. Subtle muted
           background, no italic, no thick left border. Reads as a
           Featured-Snippet target block. */
        .content-editor .content-editor-prose > blockquote {
          background: var(--color-accent);
          color: var(--color-foreground);
          border: 1px solid var(--color-border);
          border-radius: 10px;
          padding: 14px 18px;
          font-style: normal;
          font-size: 16px;
          line-height: 1.6;
        }
        .content-editor .content-editor-prose > blockquote::before {
          content: "bq";
          background: var(--color-accent);
          color: var(--color-accent-foreground);
          border-color: var(--color-accent-foreground);
          opacity: 0.85;
        }
        .content-editor .content-editor-prose > blockquote p {
          margin: 0;
        }

        /* Placeholder support for empty editor */
        .content-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: var(--color-muted-foreground);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }

        /* Hide native scrollbar in chat textarea for a cleaner look */
        .content-editor textarea::-webkit-scrollbar { width: 6px; }
        .content-editor textarea::-webkit-scrollbar-thumb {
          background: var(--color-border);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small subcomponents
// ---------------------------------------------------------------------------

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const label =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved"
        : "Save failed";
  const tone =
    state === "error" ? "text-red-600" : "text-muted-foreground";
  return (
    <span className={`text-[11px] font-mono ${tone}`}>{label}</span>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-muted px-3 py-2 text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">
      {message.content}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 text-muted-foreground">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse" />
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:120ms]" />
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-pulse [animation-delay:240ms]" />
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
