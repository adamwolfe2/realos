"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CreativeRequestStatus } from "@prisma/client";

type Message = {
  role: "client" | "agency";
  from: "client" | "agency";
  content: string;
  attachmentUrls?: string[];
  timestamp: string;
};

export type ThreadRequest = {
  id: string;
  title: string;
  description: string;
  format: string;
  targetDate: string | null;
  status: CreativeRequestStatus;
  copyIdeas: string | null;
  targetAudience: string | null;
  referenceImageUrls: string[];
  brandAssetsUrls: string[];
  deliverableUrls: string[];
  messages: Message[];
  revisionCount: number;
};

export function CreativeRequestThread({
  request,
  viewer,
}: {
  request: ThreadRequest;
  viewer: "client" | "agency";
}) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deliverables, setDeliverables] = useState<string[]>(
    request.deliverableUrls ?? []
  );

  function postMessage() {
    if (!reply.trim()) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/tenant/creative-requests/${request.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: reply.trim() }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to post message");
        return;
      }
      setReply("");
      setError(null);
      router.refresh();
    });
  }

  function updateStatus(status: CreativeRequestStatus) {
    startTransition(async () => {
      const body: Record<string, unknown> = { status };
      if (status === "DELIVERED") body.deliverableUrls = deliverables;
      const res = await fetch(
        `/api/tenant/creative-requests/${request.id}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Status change failed");
        return;
      }
      router.refresh();
    });
  }

  async function uploadDeliverables(files: FileList) {
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/tenant/uploads", {
          method: "POST",
          body: fd,
        });
        const body = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !body.url)
          throw new Error(body.error ?? "Upload failed");
        uploaded.push(body.url);
      }
      setDeliverables((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const canClientApprove =
    viewer === "client" && request.status === "DELIVERED";
  const canAgencyDeliver =
    viewer === "agency" &&
    (request.status === "IN_PROGRESS" ||
      request.status === "IN_REVIEW" ||
      request.status === "REVISION_REQUESTED");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-bold">{request.title}</h1>
        <p className="text-xs opacity-60">
          {request.format} · {request.status}
          {request.revisionCount
            ? ` · ${request.revisionCount} revisions`
            : ""}
        </p>
      </header>

      <section className="border rounded-md p-5 space-y-3">
        <p className="whitespace-pre-wrap text-sm">{request.description}</p>
        {request.copyIdeas ? (
          <p className="text-sm">
            <span className="font-semibold">Copy ideas: </span>
            {request.copyIdeas}
          </p>
        ) : null}
        {request.targetAudience ? (
          <p className="text-sm">
            <span className="font-semibold">Audience: </span>
            {request.targetAudience}
          </p>
        ) : null}
        {request.targetDate ? (
          <p className="text-sm opacity-70">
            Needed by {new Date(request.targetDate).toLocaleDateString()}
          </p>
        ) : null}
      </section>

      {(request.referenceImageUrls?.length ?? 0) > 0 ? (
        <AssetGrid label="Reference images" urls={request.referenceImageUrls} />
      ) : null}
      {(request.brandAssetsUrls?.length ?? 0) > 0 ? (
        <AssetGrid label="Brand assets" urls={request.brandAssetsUrls} />
      ) : null}

      <section className="border rounded-md p-5 space-y-3">
        <h2 className="font-serif text-lg font-bold">Deliverables</h2>
        {deliverables.length === 0 ? (
          <p className="text-sm opacity-70">No deliverables uploaded yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {deliverables.map((u) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={u} href={u} target="_blank" rel="noreferrer">
                <img
                  src={u}
                  alt="deliverable"
                  className="w-40 h-40 object-cover rounded border"
                />
              </a>
            ))}
          </div>
        )}
        {canAgencyDeliver ? (
          <div className="space-y-2 text-xs">
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              disabled={uploading}
              onChange={(e) =>
                e.target.files && uploadDeliverables(e.target.files)
              }
            />
            {uploading ? <p className="opacity-70">Uploading…</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending || deliverables.length === 0}
                onClick={() => updateStatus("DELIVERED")}
                className="bg-foreground text-background px-3 py-1.5 rounded disabled:opacity-40"
              >
                Mark delivered
              </button>
            </div>
          </div>
        ) : null}
        {canClientApprove ? (
          <div className="flex gap-2 pt-2 text-xs">
            <button
              type="button"
              disabled={pending}
              onClick={() => updateStatus("APPROVED")}
              className="bg-emerald-600 text-white px-3 py-1.5 rounded disabled:opacity-40"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => updateStatus("REVISION_REQUESTED")}
              className="border px-3 py-1.5 rounded disabled:opacity-40"
            >
              Request revision
            </button>
          </div>
        ) : null}
      </section>

      <section className="border rounded-md p-5 space-y-4">
        <h2 className="font-serif text-lg font-bold">Conversation</h2>
        <div className="space-y-3">
          {request.messages.length === 0 ? (
            <p className="text-xs opacity-60">
              No messages yet. Say hi to get started.
            </p>
          ) : (
            request.messages.map((m, i) => (
              <div
                key={i}
                className={`p-3 rounded-md text-sm ${
                  m.role === viewer
                    ? "bg-muted ml-8"
                    : "bg-slate-900 text-white mr-8"
                }`}
              >
                <div
                  className={`text-[10px] tracking-widest uppercase mb-1 ${
                    m.role === viewer ? "opacity-60" : "opacity-70"
                  }`}
                >
                  {m.role} · {new Date(m.timestamp).toLocaleString()}
                </div>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {(m.attachmentUrls ?? []).map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={u} href={u} target="_blank" rel="noreferrer">
                    <img
                      src={u}
                      alt=""
                      className="mt-2 w-24 h-24 object-cover rounded border"
                    />
                  </a>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="space-y-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder={
              viewer === "agency"
                ? "Reply to the client…"
                : "Ask a question, share a note, or request a change."
            }
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={postMessage}
              disabled={pending || !reply.trim()}
              className="bg-foreground text-background px-3 py-1.5 text-xs rounded disabled:opacity-40"
            >
              {pending ? "Sending…" : "Send"}
            </button>
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function AssetGrid({ label, urls }: { label: string; urls: string[] }) {
  return (
    <section className="border rounded-md p-5">
      <h3 className="font-serif text-sm font-semibold mb-3">{label}</h3>
      <div className="flex flex-wrap gap-2">
        {urls.map((u) => (
          // eslint-disable-next-line @next/next/no-img-element
          <a key={u} href={u} target="_blank" rel="noreferrer">
            <img
              src={u}
              alt=""
              className="w-28 h-28 object-cover rounded border"
            />
          </a>
        ))}
      </div>
    </section>
  );
}
