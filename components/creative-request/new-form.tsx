"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreativeFormat } from "@prisma/client";

const FORMAT_LABELS: Record<CreativeFormat, string> = {
  INSTAGRAM_STORY: "Instagram Story (9:16)",
  INSTAGRAM_FEED: "Instagram Feed (1:1)",
  FACEBOOK_FEED: "Facebook Feed (1.91:1)",
  GOOGLE_DISPLAY: "Google Display (various)",
  GOOGLE_SEARCH_COPY: "Google Search ad copy",
  EMAIL_HEADER: "Email header image",
  WEB_BANNER: "Website banner",
  PRINT_FLYER: "Print flyer",
  OTHER: "Other",
};

export function CreativeRequestForm({
  properties,
}: {
  properties: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [refUrls, setRefUrls] = useState<string[]>([]);
  const [brandUrls, setBrandUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState<"ref" | "brand" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(
    files: FileList,
    kind: "ref" | "brand"
  ): Promise<void> {
    setUploading(kind);
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
      if (kind === "ref") setRefUrls((prev) => [...prev, ...uploaded]);
      else setBrandUrls((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      propertyId: (fd.get("propertyId") as string) || null,
      title: (fd.get("title") as string) ?? "",
      description: (fd.get("description") as string) ?? "",
      format: (fd.get("format") as string) ?? undefined,
      targetDate: (fd.get("targetDate") as string) || undefined,
      copyIdeas: (fd.get("copyIdeas") as string) || undefined,
      targetAudience: (fd.get("targetAudience") as string) || undefined,
      referenceImageUrls: refUrls,
      brandAssetsUrls: brandUrls,
    };
    if (payload.targetDate) {
      payload.targetDate = new Date(payload.targetDate as string).toISOString();
    }

    startTransition(async () => {
      const res = await fetch("/api/tenant/creative-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !body.id) {
        setError(body.error ?? "Submit failed");
        return;
      }
      router.push(`/portal/creative/${body.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs tracking-widest uppercase opacity-70">
            For property
          </span>
          <select
            name="propertyId"
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs tracking-widest uppercase opacity-70">
            Format
          </span>
          <select
            name="format"
            required
            className="border rounded px-3 py-2 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Pick one…
            </option>
            {Object.values(CreativeFormat).map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs tracking-widest uppercase opacity-70">
          Title
        </span>
        <input
          name="title"
          required
          placeholder="Fall 2026 move-in push"
          className="border rounded px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs tracking-widest uppercase opacity-70">
          What do you want us to make?
        </span>
        <textarea
          name="description"
          required
          rows={5}
          className="border rounded px-3 py-2 text-sm"
          placeholder="Describe the creative you need, including vibe, audience, and any constraints."
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs tracking-widest uppercase opacity-70">
            Needed by
          </span>
          <input
            name="targetDate"
            type="date"
            className="border rounded px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs tracking-widest uppercase opacity-70">
            Audience
          </span>
          <input
            name="targetAudience"
            placeholder="Incoming freshmen, parents, international students"
            className="border rounded px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs tracking-widest uppercase opacity-70">
          Copy ideas
        </span>
        <textarea
          name="copyIdeas"
          rows={3}
          className="border rounded px-3 py-2 text-sm"
          placeholder="Headlines, taglines, tone, CTAs."
        />
      </label>

      <UploadField
        label="Reference images (inspiration)"
        hint="Screenshot or share examples. We'll match the vibe."
        urls={refUrls}
        uploading={uploading === "ref"}
        onFiles={(files) => upload(files, "ref")}
      />
      <UploadField
        label="Brand assets (logos, photos, lockups)"
        hint="Anything we should include verbatim."
        urls={brandUrls}
        uploading={uploading === "brand"}
        onFiles={(files) => upload(files, "brand")}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="submit"
        disabled={pending || !!uploading}
        className="bg-foreground text-background px-5 py-2 text-sm font-semibold rounded disabled:opacity-40"
      >
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}

function UploadField({
  label,
  hint,
  urls,
  uploading,
  onFiles,
}: {
  label: string;
  hint: string;
  urls: string[];
  uploading: boolean;
  onFiles: (files: FileList) => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-xs tracking-widest uppercase opacity-70">{label}</p>
      <p className="text-xs opacity-60">{hint}</p>
      <input
        type="file"
        multiple
        accept="image/*,application/pdf"
        disabled={uploading}
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
      {uploading ? <p className="text-xs opacity-70">Uploading…</p> : null}
      {urls.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-1">
          {urls.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={u}
              src={u}
              alt=""
              className="w-20 h-20 object-cover rounded border"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
