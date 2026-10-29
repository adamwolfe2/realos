"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChatbotCaptureMode } from "@prisma/client";
import { BookOpen, Check, ChevronLeft, ChevronRight, Code2, Mail, RotateCcw, UserPlus, UserRound, type LucideIcon } from "lucide-react";
import { saveChatbotConfig } from "@/lib/actions/chatbot-config";
import { Panel } from "@/components/portal/overview/kit";
import { cn } from "@/lib/utils";
import { AvatarPicker } from "./avatar-picker";
import { EmbedPreview, type PreviewBase, type PreviewDraft } from "./embed-preview";

type FormState = PreviewDraft & {
  chatbotEnabled: boolean;
  ga4MeasurementId: string;
  gtmContainerId: string;
};

type Section = "identity" | "knowledge" | "capture" | "routing" | "install";

const KB_MAX = 5000;
// Under this the bot mostly answers "I'll have the team follow up".
const KB_THIN = 300;

const CAPTURE_OPTIONS: Array<{ value: ChatbotCaptureMode; label: string; hint: string }> = [
  { value: ChatbotCaptureMode.ON_INTENT, label: "When they're interested", hint: "Asks once a renter asks about price, tours or move-in. Recommended." },
  { value: ChatbotCaptureMode.PRE_CHAT, label: "Before chatting", hint: "Name and email first. More leads, fewer conversations." },
  { value: ChatbotCaptureMode.OFF, label: "Never", hint: "Only answers questions. Use if another tool captures leads." },
];

const PLACEHOLDERS = ["{property_name}", "{starting_rent}", "{open_count}", "{next_available}"];

const INPUT =
  "h-9 w-full rounded-[8px] border border-[var(--t-border)] bg-white px-3 text-[13.5px] text-[var(--t-ink)] placeholder:text-[var(--t-muted)] focus:border-[var(--t-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--t-accent)]/15";
const AREA = cn(INPUT, "h-auto py-2 leading-relaxed");

type Status = { ok: boolean; summary: string };

/**
 * /portal/chatbot studio: settings as a short list (left), the real widget
 * on a mock property site (centre), how it is doing (right). A row opens
 * its editor in a slide-over so the stage stays visible while you edit.
 */
export function ChatbotStudio({
  initial,
  orgPrimaryColor,
  moduleActive,
  previewBase,
  siteLabel,
  insights,
  routing,
  routingStatus,
  install,
  installStatus,
}: {
  initial: FormState;
  orgPrimaryColor: string | null;
  moduleActive: boolean;
  previewBase: PreviewBase;
  siteLabel: string;
  insights: ReactNode;
  routing: ReactNode;
  routingStatus: Status;
  install: ReactNode;
  installStatus: Status;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(initial);
  const [open, setOpen] = useState<Section | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(initial), [state, initial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function save() {
    setError(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(state)) fd.set(k, String(v));
    startTransition(async () => {
      const result = await saveChatbotConfig(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const brand = state.chatbotBrandColor || orgPrimaryColor || "#111111";
  const kbLength = state.chatbotKnowledgeBase.length;
  const kbLines = state.chatbotKnowledgeBase.split("\n").filter((l) => l.trim()).length;
  const capture = CAPTURE_OPTIONS.find((o) => o.value === state.chatbotCaptureMode) ?? CAPTURE_OPTIONS[0];

  const rows: Array<{ id: Section; icon: LucideIcon; title: string; summary: ReactNode; ok: boolean }> = [
    {
      id: "identity", icon: UserRound, title: "Identity", ok: Boolean(state.chatbotPersonaName.trim() && state.chatbotGreeting.trim()),
      summary: (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] border border-black/10" style={{ background: brand }} />
          {state.chatbotPersonaName.trim() || "No name yet"}
          {state.chatbotIdleTriggerSeconds > 0 ? ` · pops up after ${state.chatbotIdleTriggerSeconds}s` : ""}
        </span>
      ),
    },
    { id: "knowledge", icon: BookOpen, title: "Knowledge", ok: kbLength >= KB_THIN, summary: kbLength ? `${kbLines} facts · ${kbLength.toLocaleString()} characters` : "Empty, so answers stay vague" },
    { id: "capture", icon: UserPlus, title: "Asks for contact info", ok: true, summary: capture.label },
    { id: "routing", icon: Mail, title: "Where leads go", ok: routingStatus.ok, summary: routingStatus.summary },
    { id: "install", icon: Code2, title: "Install", ok: installStatus.ok, summary: installStatus.summary },
  ];
  const done = rows.filter((r) => r.ok).length;
  const configSection = open === "identity" || open === "knowledge" || open === "capture" || open === "install";

  return (
    <>
      <div className={cn("grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]", open ? "xl:grid-cols-[440px_minmax(0,1fr)_300px]" : "xl:grid-cols-[300px_minmax(0,1fr)_320px]")}>
        {open ? (
          <section aria-label={rows.find((r) => r.id === open)?.title} className="min-w-0 rounded-[var(--t-radius)] border border-[var(--t-border)] bg-[var(--t-card)] shadow-[var(--t-shadow)]">
            <header className="flex h-12 items-center gap-2 border-b border-[var(--t-divider)] px-2">
              <button type="button" onClick={() => setOpen(null)} aria-label="Back to setup" className="grid h-8 w-8 place-items-center rounded-full text-[var(--t-muted)] hover:bg-[var(--t-wash)] hover:text-[var(--t-ink)]">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="text-[13.5px] font-semibold text-[var(--t-ink)]">{rows.find((r) => r.id === open)?.title}</h2>
            </header>
          <div className="space-y-4 px-4 py-4">
            {open === "identity" ? <IdentityEditor state={state} update={update} brand={brand} orgPrimaryColor={orgPrimaryColor} /> : null}
            {open === "knowledge" ? <KnowledgeEditor value={state.chatbotKnowledgeBase} onChange={(v) => update("chatbotKnowledgeBase", v)} /> : null}
            {open === "capture" ? <CaptureEditor value={state.chatbotCaptureMode} onChange={(v) => update("chatbotCaptureMode", v)} /> : null}
            {open === "routing" ? routing : null}
            {open === "install" ? (
              <>
                {install}
                <div className="grid gap-3 border-t border-[var(--t-divider)] pt-4">
                  <p className="text-[12.5px] font-medium text-[var(--t-text)]">Google Analytics (optional)</p>
                  <Field label="Tag Manager container" hint="Pageviews and chat events go to your own Google account.">
                    <input value={state.gtmContainerId} onChange={(e) => update("gtmContainerId", e.target.value)} placeholder="GTM-XXXXXXX" className={cn(INPUT, "font-mono text-[12.5px]")} />
                  </Field>
                  <Field label="GA4 measurement ID" hint="Routed through Tag Manager when both are set.">
                    <input value={state.ga4MeasurementId} onChange={(e) => update("ga4MeasurementId", e.target.value)} placeholder="G-XXXXXXXXXX" className={cn(INPUT, "font-mono text-[12.5px]")} />
                  </Field>
                </div>
              </>
            ) : null}
          </div>
          {configSection ? (
            <footer className="flex shrink-0 items-center gap-3 border-t border-[var(--t-divider)] px-4 py-3">
              <button type="button" onClick={save} disabled={pending || !dirty || kbLength > KB_MAX} className="inline-flex h-9 items-center rounded-full bg-[var(--t-primary-bg)] px-4 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-40">
                {pending ? "Saving..." : "Save changes"}
              </button>
              <span className="text-[12.5px] text-[var(--t-muted)]">
                {error ? <span className="text-[#b91c1c]">{error}</span> : saved && !dirty ? "Saved. Live on your site now." : dirty ? "The preview shows your unsaved changes" : "No changes"}
              </span>
              {!moduleActive ? <span className="ml-auto text-[12px] text-[var(--t-muted)]">Module off</span> : null}
            </footer>
          ) : null}
          </section>
        ) : (
          <Panel title="Setup" aside={<span className="tabular-nums">{done} of {rows.length} done</span>} flush>
            <ul className="divide-y divide-[var(--t-divider)]">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(r.id)}
                    className={cn("group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--t-wash)]", open === r.id && "bg-[var(--t-wash)]")}
                  >
                    <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-[var(--t-border)] bg-white text-[var(--t-text)]">
                      <r.icon className="h-4 w-4" aria-hidden />
                      <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-white" style={{ background: r.ok ? "#16a34a" : "#d97706" }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium text-[var(--t-ink)]">{r.title}</span>
                      <span className="block truncate text-[12.5px] text-[var(--t-muted)]">{r.summary}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--t-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            {dirty ? (
              <div className="flex items-center gap-2 border-t border-[var(--t-divider)] px-4 py-3">
                <button type="button" onClick={save} disabled={pending || kbLength > KB_MAX} className="inline-flex h-8 items-center rounded-full bg-[var(--t-primary-bg)] px-4 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-40">
                  {pending ? "Saving..." : "Save changes"}
                </button>
                <button type="button" onClick={() => setState(initial)} className="text-[12.5px] text-[var(--t-muted)] hover:text-[var(--t-ink)]">Discard</button>
              </div>
            ) : null}
          </Panel>
        )}

        <section className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3 text-[12.5px] text-[var(--t-muted)]">
            <span>Try it like a renter. Answers come from your knowledge, nothing is saved.</span>
            <button type="button" onClick={() => setResetKey((k) => k + 1)} className="inline-flex items-center gap-1 hover:text-[var(--t-ink)]">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restart
            </button>
          </div>
          <MockSite label={siteLabel} brand={brand}>
            <EmbedPreview state={state} base={previewBase} orgPrimaryColor={orgPrimaryColor} resetKey={resetKey} />
          </MockSite>
        </section>

        <aside className="min-w-0 space-y-5 lg:col-span-2 xl:col-span-1">{insights}</aside>
      </div>
    </>
  );
}

/** A quiet stand-in for the property's website so the widget reads in context. */
function MockSite({ label, brand, children }: { label: string; brand: string; children: ReactNode }) {
  return (
    <div className="relative h-[calc(100vh-180px)] min-h-[640px] overflow-hidden rounded-[var(--t-radius)] border border-[var(--t-border)] bg-white shadow-[var(--t-shadow)]">
      <div className="flex h-10 items-center gap-3 border-b border-[var(--t-divider)] bg-[#f7f9fd] px-4">
        <span className="h-5 flex-1 max-w-[340px] rounded-full border border-[var(--t-border)] bg-white px-3 text-[11.5px] leading-5 text-[var(--t-muted)]">{label}</span>
      </div>
      <div aria-hidden className="pointer-events-none select-none px-10 py-9">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-[#c4ccdc]">{label.replace(/^https?:\/\//, "").split("/")[0]}</span>
          <span className="flex gap-6">{["Floor plans", "Amenities", "Location", "Apply"].map((t) => <span key={t} className="text-[12.5px] text-[#c9d1e0]">{t}</span>)}</span>
        </div>
        <div className="mt-10 h-56 rounded-[14px] bg-[linear-gradient(135deg,#eef2fb,#f7f9fe)]">
          <div className="p-8">
            <div className="h-6 w-80 rounded-full bg-[#dfe6f3]" />
            <div className="mt-3 h-3.5 w-64 rounded-full bg-[#e8edf6]" />
            <div className="mt-6 h-9 w-36 rounded-full opacity-25" style={{ background: brand }} />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-[12px] border border-[#eef1f7] p-4">
              <div className="h-24 rounded-[8px] bg-[#f3f6fb]" />
              <div className="mt-3 h-3 w-24 rounded-full bg-[#e6ebf4]" />
              <div className="mt-2 h-3 w-16 rounded-full bg-[#eef1f7]" />
            </div>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-[var(--t-text)]">{label}</span>
      {children}
      {hint ? <span className="text-[12px] text-[var(--t-muted)]">{hint}</span> : null}
    </label>
  );
}

function IdentityEditor({ state, update, brand, orgPrimaryColor }: {
  state: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  brand: string;
  orgPrimaryColor: string | null;
}) {
  return (
    <>
      <div className="flex items-end gap-3">
        <AvatarPicker value={state.chatbotAvatarUrl} personaName={state.chatbotPersonaName} onChange={(v) => update("chatbotAvatarUrl", v)} />
        <Field label="Name">
          <input value={state.chatbotPersonaName} onChange={(e) => update("chatbotPersonaName", e.target.value)} placeholder="Maya" maxLength={100} className={INPUT} />
        </Field>
      </div>
      <Field label="First message">
        <textarea rows={3} maxLength={500} value={state.chatbotGreeting} onChange={(e) => update("chatbotGreeting", e.target.value)} placeholder="Hi! I'm Maya. Looking for a place for fall?" className={AREA} />
      </Field>
      <Field label="Second message" hint={
        <span className="flex flex-wrap items-center gap-1">
          Insert live data:
          {PLACEHOLDERS.map((p) => (
            <button key={p} type="button" onClick={() => update("chatbotFollowUpMessage", `${state.chatbotFollowUpMessage}${state.chatbotFollowUpMessage && !state.chatbotFollowUpMessage.endsWith(" ") ? " " : ""}${p}`)} className="rounded-[5px] border border-[var(--t-border)] bg-[var(--t-wash)] px-1.5 font-mono text-[10.5px] text-[var(--t-text)] hover:border-[var(--t-accent)] hover:text-[var(--t-accent)]">
              {p.slice(1, -1).replace("_", " ")}
            </button>
          ))}
        </span>
      }>
        <textarea rows={3} maxLength={500} value={state.chatbotFollowUpMessage} onChange={(e) => update("chatbotFollowUpMessage", e.target.value)} placeholder="Optional. Rooms from {starting_rent}, {open_count} open now." className={AREA} />
      </Field>
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <Field label="Pop-up bubble">
          <input value={state.chatbotTeaserText} onChange={(e) => update("chatbotTeaserText", e.target.value)} placeholder="Questions? I'm here." maxLength={200} className={INPUT} />
        </Field>
        <Field label="After">
          <span className="relative block" title="0 turns the bubble off">
            <input type="number" min={0} max={600} value={state.chatbotIdleTriggerSeconds} onChange={(e) => update("chatbotIdleTriggerSeconds", parseInt(e.target.value, 10) || 0)} className={cn(INPUT, "pr-8 tabular-nums")} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] text-[var(--t-muted)]">s</span>
          </span>
        </Field>
      </div>
      <Field label="Colour" hint={orgPrimaryColor ? `Blank uses your brand colour (${orgPrimaryColor}).` : undefined}>
        <span className="flex items-center gap-2">
          <input type="color" value={brand} onChange={(e) => update("chatbotBrandColor", e.target.value)} aria-label="Pick colour" className="h-9 w-10 shrink-0 cursor-pointer rounded-[8px] border border-[var(--t-border)] bg-white p-1" />
          <input value={state.chatbotBrandColor} onChange={(e) => update("chatbotBrandColor", e.target.value)} placeholder={orgPrimaryColor ?? "#111111"} className={cn(INPUT, "font-mono text-[12.5px]")} />
        </span>
      </Field>
    </>
  );
}

function KnowledgeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const over = value.length > KB_MAX;
  return (
    <>
      <p className="text-[13px] text-[var(--t-muted)]">
        One fact per line: rent, fees, pets, parking, tour hours. Approved{" "}
        <Link href="/portal/conversations/insights" className="text-[var(--t-accent)] hover:underline">suggested fixes</Link> land here automatically. Ask the preview a question to check an answer.
      </p>
      <textarea rows={18} value={value} onChange={(e) => onChange(e.target.value)} placeholder={"Rent includes utilities and WiFi.\nPets: cats OK, dogs under 40 lbs, $500 deposit.\nTours: Monday to Saturday, 10am to 6pm."} className={cn(AREA, "text-[13px]")} />
      <div className="flex items-center gap-3">
        <span className="h-1 w-32 overflow-hidden rounded-full bg-[var(--t-wash)]" aria-hidden>
          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (value.length / KB_MAX) * 100)}%`, background: over ? "#dc2626" : "var(--t-accent)" }} />
        </span>
        <span className={cn("text-[12px] tabular-nums", over ? "text-[#b91c1c]" : "text-[var(--t-muted)]")}>
          {value.length.toLocaleString()} / {KB_MAX.toLocaleString()}{over ? " · trim to save" : ""}
        </span>
      </div>
    </>
  );
}

function CaptureEditor({ value, onChange }: { value: ChatbotCaptureMode; onChange: (v: ChatbotCaptureMode) => void }) {
  return (
    <div role="radiogroup" aria-label="When to ask for contact info" className="grid gap-2">
      {CAPTURE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <label key={opt.value} className={cn("cursor-pointer rounded-[10px] border p-3.5 transition-colors", active ? "border-[var(--t-accent)] bg-[#f5f8ff] ring-1 ring-[var(--t-accent)]" : "border-[var(--t-border)] hover:border-[#b9c7e6]")}>
            <input type="radio" name="chatbotCaptureMode" value={opt.value} checked={active} onChange={() => onChange(opt.value)} className="sr-only" />
            <span className="flex items-center justify-between gap-2 text-[13.5px] font-medium text-[var(--t-ink)]">
              {opt.label}
              {active ? <Check className="h-4 w-4 text-[var(--t-accent)]" aria-hidden /> : null}
            </span>
            <span className="mt-1 block text-[12.5px] leading-snug text-[var(--t-muted)]">{opt.hint}</span>
          </label>
        );
      })}
      <p className="pt-1 text-[12.5px] text-[var(--t-muted)]">The preview switches mode as you pick, so you can try each one.</p>
    </div>
  );
}

