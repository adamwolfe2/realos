"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  archiveNeighborhoodPage,
  publishNeighborhoodPage,
  regenerateNeighborhoodPage,
  updateNeighborhoodPage,
  type StoredNeighborhoodPage,
} from "@/lib/actions/neighborhood-pages";

type Property = { id: string; name: string };

const TABS = ["Overview", "Intro", "Sections", "FAQ", "AI citations"] as const;
type Tab = (typeof TABS)[number];

export function EditorClient({
  page,
  properties,
}: {
  page: StoredNeighborhoodPage;
  properties: Property[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [pending, startTransition] = useTransition();

  // Local state mirrors the page so we can edit before saving.
  const [title, setTitle] = useState(page.title);
  const [metaDescription, setMetaDescription] = useState(page.metaDescription);
  const [intro, setIntro] = useState(page.intro);
  const [city, setCity] = useState(page.city);
  const [state, setState] = useState(page.state ?? "");
  const [neighborhood, setNeighborhood] = useState(page.neighborhood);
  const [propertyId, setPropertyId] = useState(page.propertyId ?? "");
  const [sections, setSections] = useState(page.sections);
  const [faqs, setFaqs] = useState(page.faqs);
  const [aiCitations, setAiCitations] = useState<string[]>(
    page.aiCitations ?? [],
  );

  function save() {
    startTransition(async () => {
      const res = await updateNeighborhoodPage(page.id, {
        title,
        metaDescription,
        intro,
        city,
        state: state.trim() || null,
        neighborhood,
        propertyId: propertyId || null,
        sections,
        faqs,
        aiCitations,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  }

  function publish() {
    startTransition(async () => {
      const res = await publishNeighborhoodPage(page.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Published");
      router.refresh();
    });
  }

  function archive() {
    if (!confirm("Archive this page? It will 404 on the public site.")) return;
    startTransition(async () => {
      const res = await archiveNeighborhoodPage(page.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Archived");
      router.refresh();
    });
  }

  function regenerate() {
    if (
      !confirm(
        "Re-run Claude and overwrite the current draft? Your manual edits will be lost.",
      )
    )
      return;
    startTransition(async () => {
      const res = await regenerateNeighborhoodPage(page.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Regenerated — reloading");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-md ${
                tab === t
                  ? "bg-foreground text-background"
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={regenerate}
            disabled={pending}
          >
            Regenerate
          </Button>
          <Button size="sm" variant="outline" onClick={archive} disabled={pending}>
            Archive
          </Button>
          <Button size="sm" variant="outline" onClick={save} disabled={pending}>
            Save
          </Button>
          {page.status !== "PUBLISHED" ? (
            <Button size="sm" onClick={publish} disabled={pending}>
              Publish
            </Button>
          ) : null}
        </div>
      </div>

      {/* Tab content */}
      {tab === "Overview" ? (
        <div className="ls-card p-5 space-y-4">
          <div>
            <Label>SEO title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {title.length}/60 ideal · what shows in Google + browser tab
            </p>
          </div>
          <div>
            <Label>Meta description</Label>
            <textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              maxLength={200}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {metaDescription.length}/155 ideal
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Neighborhood</Label>
              <Input
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
              />
            </div>
            <div>
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <Label>State</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="propertyId">Anchor property</Label>
            <select
              id="propertyId"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            >
              <option value="">None</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {tab === "Intro" ? (
        <div className="ls-card p-5">
          <Label>Intro paragraph</Label>
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={10}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Roughly 120 words. Conversational, specific, no marketing jargon.
          </p>
        </div>
      ) : null}

      {tab === "Sections" ? (
        <div className="space-y-4">
          {sections.map((s, idx) => (
            <div key={idx} className="ls-card p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Section {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSections(sections.filter((_, i) => i !== idx))
                  }
                  className="text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              </div>
              <Input
                value={s.heading}
                onChange={(e) => {
                  const next = [...sections];
                  next[idx] = { ...s, heading: e.target.value };
                  setSections(next);
                }}
              />
              <textarea
                value={s.body}
                onChange={(e) => {
                  const next = [...sections];
                  next[idx] = { ...s, body: e.target.value };
                  setSections(next);
                }}
                rows={8}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setSections([...sections, { heading: "New section", body: "" }])
            }
            className="text-[12px] text-muted-foreground hover:text-foreground"
          >
            + Add section
          </button>
        </div>
      ) : null}

      {tab === "FAQ" ? (
        <div className="space-y-4">
          {faqs.map((f, idx) => (
            <div key={idx} className="ls-card p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  FAQ {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setFaqs(faqs.filter((_, i) => i !== idx))}
                  className="text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              </div>
              <Input
                value={f.question}
                onChange={(e) => {
                  const next = [...faqs];
                  next[idx] = { ...f, question: e.target.value };
                  setFaqs(next);
                }}
              />
              <textarea
                value={f.answer}
                onChange={(e) => {
                  const next = [...faqs];
                  next[idx] = { ...f, answer: e.target.value };
                  setFaqs(next);
                }}
                rows={5}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFaqs([...faqs, { question: "", answer: "" }])}
            className="text-[12px] text-muted-foreground hover:text-foreground"
          >
            + Add FAQ
          </button>
        </div>
      ) : null}

      {tab === "AI citations" ? (
        <div className="ls-card p-5 space-y-3">
          <p className="text-[12px] text-muted-foreground">
            Short factual statements this page should be cited for by AI
            answer engines. The AEO module uses these to verify whether
            ChatGPT / Perplexity / Claude / Gemini actually surface them.
          </p>
          {aiCitations.map((c, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={c}
                onChange={(e) => {
                  const next = [...aiCitations];
                  next[idx] = e.target.value;
                  setAiCitations(next);
                }}
              />
              <button
                type="button"
                onClick={() =>
                  setAiCitations(aiCitations.filter((_, i) => i !== idx))
                }
                className="text-[11px] text-muted-foreground hover:text-destructive shrink-0 px-2"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAiCitations([...aiCitations, ""])}
            className="text-[12px] text-muted-foreground hover:text-foreground"
          >
            + Add citation target
          </button>
        </div>
      ) : null}
    </div>
  );
}
