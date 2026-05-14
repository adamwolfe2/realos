"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChatbotCaptureMode } from "@prisma/client";
import { saveChatbotConfig } from "@/lib/actions/chatbot-config";
import { Upload, Trash2, Loader2, AlertTriangle } from "lucide-react";

type FormState = {
  chatbotEnabled: boolean;
  chatbotAvatarUrl: string;
  chatbotPersonaName: string;
  chatbotGreeting: string;
  chatbotFollowUpMessage: string;
  chatbotTeaserText: string;
  chatbotBrandColor: string;
  chatbotCaptureMode: ChatbotCaptureMode;
  chatbotKnowledgeBase: string;
  chatbotIdleTriggerSeconds: number;
  ga4MeasurementId: string;
  gtmContainerId: string;
};

const KB_MAX = 5000;

const CAPTURE_OPTIONS: Array<{
  value: ChatbotCaptureMode;
  label: string;
  hint: string;
}> = [
  {
    value: ChatbotCaptureMode.PRE_CHAT,
    label: "Pre-chat",
    hint: "Ask for name + email before the visitor can send their first message.",
  },
  {
    value: ChatbotCaptureMode.ON_INTENT,
    label: "On intent",
    hint: "Ask for contact info once the conversation signals real interest.",
  },
  {
    value: ChatbotCaptureMode.OFF,
    label: "Off",
    hint: "Never request contact info. Use only on sites with other capture tools.",
  },
];

const INPUT_CLASS =
  "rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-full";
const LABEL_CLASS = "text-[10px] tracking-widest uppercase font-semibold text-muted-foreground";

export function ChatbotConfigForm({
  initial,
  orgPrimaryColor,
  moduleActive,
}: {
  initial: FormState;
  orgPrimaryColor: string | null;
  moduleActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  const effectiveBrandColor = useMemo(() => {
    if (state.chatbotBrandColor) return state.chatbotBrandColor;
    return orgPrimaryColor ?? "#111111";
  }, [state.chatbotBrandColor, orgPrimaryColor]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
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

  const kbLength = state.chatbotKnowledgeBase.length;
  const kbOver = kbLength > KB_MAX;
  const kbNear = kbLength > KB_MAX * 0.9 && !kbOver;

  return (
    <form onSubmit={submit}>
      <div className="flex gap-6 items-start">
        {/* Left column — all config sections */}
        <div className="flex-1 min-w-0 space-y-4">
      <input
        type="hidden"
        name="chatbotEnabled"
        value={String(initial.chatbotEnabled)}
      />

      {/* Persona */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Persona</h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-start">
          <Field
            label="Persona name"
            name="chatbotPersonaName"
            value={state.chatbotPersonaName}
            onChange={(v) => update("chatbotPersonaName", v)}
            placeholder="Leasing, Maya, etc."
            maxLength={100}
          />
          <AvatarPicker
            value={state.chatbotAvatarUrl}
            personaName={state.chatbotPersonaName}
            onChange={(v) => update("chatbotAvatarUrl", v)}
          />
        </div>
        {/* Persisted via the upload endpoint AND included in the form save
            so existing TenantSiteConfig rows that already store the URL
            stay in sync when the operator hits Save chatbot config. */}
        <input
          type="hidden"
          name="chatbotAvatarUrl"
          value={state.chatbotAvatarUrl}
        />
        <TextArea
          label="Greeting (message 1)"
          name="chatbotGreeting"
          rows={2}
          value={state.chatbotGreeting}
          onChange={(v) => update("chatbotGreeting", v)}
          hint="First message the bot sends (1-2 lines). Sent the moment the visitor opens the chat."
          maxLength={500}
        />
        <TextArea
          label="Follow-up message (message 2)"
          name="chatbotFollowUpMessage"
          rows={3}
          value={state.chatbotFollowUpMessage}
          onChange={(v) => update("chatbotFollowUpMessage", v)}
          hint={
            <>
              Optional second message sent right after the greeting on first
              open. Leave empty to send only the greeting. Supports
              placeholders that the widget interpolates against live
              inventory data:{" "}
              <code className="font-mono text-[10px]">{"{property_name}"}</code>
              ,{" "}
              <code className="font-mono text-[10px]">{"{starting_rent}"}</code>
              ,{" "}
              <code className="font-mono text-[10px]">{"{open_count}"}</code>,{" "}
              <code className="font-mono text-[10px]">{"{next_available}"}</code>
              .
            </>
          }
          maxLength={500}
        />
        <Field
          label="Teaser text"
          name="chatbotTeaserText"
          value={state.chatbotTeaserText}
          onChange={(v) => update("chatbotTeaserText", v)}
          placeholder="Questions? I'm here."
          maxLength={200}
          hint="Short proactive bubble — keep it under 80 characters."
        />
      </section>

      {/* Appearance */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Appearance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL_CLASS}>Brand color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={effectiveBrandColor}
                onChange={(e) => update("chatbotBrandColor", e.target.value)}
                className="h-9 w-12 rounded-md border border-border cursor-pointer bg-background"
                aria-label="Brand color picker"
              />
              <input
                type="text"
                name="chatbotBrandColor"
                value={state.chatbotBrandColor}
                onChange={(e) => update("chatbotBrandColor", e.target.value)}
                placeholder={orgPrimaryColor ?? "#111111"}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
            <span className="text-[11px] text-muted-foreground">
              Leave blank to inherit your brand primary color
              {orgPrimaryColor ? ` (${orgPrimaryColor}).` : "."}
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL_CLASS}>Idle trigger (seconds)</span>
            <input
              type="number"
              name="chatbotIdleTriggerSeconds"
              min={0}
              max={600}
              value={state.chatbotIdleTriggerSeconds}
              onChange={(e) =>
                update("chatbotIdleTriggerSeconds", parseInt(e.target.value, 10) || 0)
              }
              className={INPUT_CLASS}
            />
            <span className="text-[11px] text-muted-foreground">
              Seconds before the proactive teaser bubble pops up. 0 disables the teaser.
            </span>
          </label>
        </div>
      </section>

      {/* Lead capture */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Lead capture</h2>
        <p className="text-xs text-muted-foreground">
          Choose when the bot asks for a visitor&apos;s name and email.
        </p>
        <div className="space-y-2">
          {CAPTURE_OPTIONS.map((opt) => {
            const active = state.chatbotCaptureMode === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="chatbotCaptureMode"
                  value={opt.value}
                  checked={active}
                  onChange={() => update("chatbotCaptureMode", opt.value)}
                  className="mt-1"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{opt.label}</span>
                  <span className="text-[11px] text-muted-foreground">{opt.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Site analytics */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Site analytics
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            We inject GTM and GA4 on your tenant site so pageviews,{" "}
            <code className="font-mono text-[11px]">apply_clicked</code>,{" "}
            <code className="font-mono text-[11px]">tour_scheduled</code>,{" "}
            <code className="font-mono text-[11px]">chatbot_opened</code>, and{" "}
            <code className="font-mono text-[11px]">chatbot_lead_captured</code>{" "}
            land in the customer&apos;s real Google accounts. If GTM is set,
            GA4 routes through it. Otherwise GA4 loads directly via gtag.js.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="GTM container ID"
            name="gtmContainerId"
            value={state.gtmContainerId}
            onChange={(v) => update("gtmContainerId", v)}
            placeholder="GTM-XXXXXXX"
            hint="Found in tagmanager.google.com → Workspace top-bar."
          />
          <Field
            label="GA4 measurement ID"
            name="ga4MeasurementId"
            value={state.ga4MeasurementId}
            onChange={(v) => update("ga4MeasurementId", v)}
            placeholder="G-XXXXXXXXXX"
            hint="GA4 Admin → Data Streams → Web → Measurement ID."
          />
        </div>
      </section>

      {/* Knowledge base */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Knowledge base</h2>
        <p className="text-xs text-muted-foreground">
          Plain-text facts, amenities, and policies injected into the system prompt. Write like
          you&apos;re briefing a new front-desk hire.
        </p>
        <textarea
          name="chatbotKnowledgeBase"
          rows={12}
          value={state.chatbotKnowledgeBase}
          onChange={(e) => update("chatbotKnowledgeBase", e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder={
            "Rent includes utilities and WiFi.\nPet policy: cats OK, dogs under 40 lbs with $500 deposit.\nTours: Monday-Saturday 10am-6pm."
          }
        />
        <div className="flex items-center justify-between">
          <span
            className={`text-[11px] ${
              kbOver
                ? "text-destructive"
                : kbNear
                  ? "text-amber-700"
                  : "text-muted-foreground"
            }`}
          >
            {kbLength.toLocaleString()} / {KB_MAX.toLocaleString()} characters
            {kbOver ? " — trim to save" : kbNear ? " — nearing limit" : ""}
          </span>
        </div>
      </section>

        <div className="flex items-center gap-3 sticky bottom-0 bg-background py-3 border-t border-border">
          <button
            type="submit"
            disabled={pending || kbOver}
            className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-4 py-2 text-sm font-medium rounded-md disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save chatbot config"}
          </button>
          {saved ? (
            <span className="text-xs text-primary">Saved</span>
          ) : null}
          {error ? (
            <span className="text-xs text-destructive">{error}</span>
          ) : null}
          {!moduleActive ? (
            <span className="text-xs text-muted-foreground">
              Module off — saves stage content without publishing.
            </span>
          ) : null}
        </div>
        </div>{/* end left column */}

        {/* Right column — sticky preview */}
        <div className="w-96 shrink-0 hidden lg:block">
          <div className="sticky top-6 rounded-lg border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Preview</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Updates as you type. The full widget renders live once the master toggle is on.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-end gap-2">
                <div
                  aria-hidden
                  className="h-8 w-8 rounded-full flex-shrink-0"
                  style={{ backgroundColor: effectiveBrandColor }}
                />
                <div className="flex-1 rounded-xl rounded-bl-none border border-border bg-muted/30 px-3 py-2.5 text-sm">
                  <div className={`${LABEL_CLASS} mb-1`}>
                    {state.chatbotPersonaName || "Leasing"}
                  </div>
                  <p className="whitespace-pre-wrap text-foreground text-xs leading-relaxed">
                    {state.chatbotGreeting || "Hi! What can I help you with today?"}
                  </p>
                </div>
              </div>
              {state.chatbotFollowUpMessage && (
                <div className="flex items-end gap-2">
                  <div
                    aria-hidden
                    className="h-8 w-8 rounded-full flex-shrink-0 opacity-0"
                  />
                  <div className="flex-1 rounded-xl rounded-bl-none border border-border bg-muted/30 px-3 py-2.5 text-sm">
                    <p className="whitespace-pre-wrap text-foreground text-xs leading-relaxed">
                      {state.chatbotFollowUpMessage
                        .replace(/\{property_name\}/gi, "Telegraph Commons")
                        .replace(/\{starting_rent\}/gi, "850")
                        .replace(/\{open_count\}/gi, "5")
                        .replace(/\{next_available\}/gi, "Aug 15")}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1.5 italic">
                      Preview placeholders resolved against sample data.
                    </p>
                  </div>
                </div>
              )}
              {state.chatbotTeaserText && (
                <div className="flex items-center justify-end gap-2">
                  <div
                    className="rounded-full px-3 py-1.5 text-xs font-medium text-white shadow-sm"
                    style={{ backgroundColor: effectiveBrandColor }}
                  >
                    {state.chatbotTeaserText}
                  </div>
                  <div
                    className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: effectiveBrandColor }}
                    aria-hidden
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>{/* end flex row */}
    </form>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  maxLength,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={LABEL_CLASS}>{label}</span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={INPUT_CLASS}
      />
      {hint ? (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

function TextArea({
  label,
  name,
  value,
  onChange,
  rows = 3,
  maxLength,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  maxLength?: number;
  hint?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={LABEL_CLASS}>{label}</span>
      <textarea
        name={name}
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      {hint ? (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

// ---------------------------------------------------------------------------
// AvatarPicker
//
// Replaces the bare "paste a URL" input with a real upload UX:
//   - 64x64 preview circle (uploaded image, or persona initial fallback)
//   - "Upload image" button that opens a file picker
//   - "Remove" button when an avatar is set
//   - Disclosure for advanced "paste a URL instead" so the legacy path
//     stays available (some agencies host their own avatars on a CDN)
//   - Inline error message + loading spinner during upload
//
// The endpoint persists the URL on TenantSiteConfig.chatbotAvatarUrl
// immediately on successful upload, so the avatar goes live even before
// the operator clicks Save on the full config form. The form's hidden
// input still carries the value through to saveChatbotConfig so a
// subsequent Save isn't destructive.
// ---------------------------------------------------------------------------
function AvatarPicker({
  value,
  personaName,
  onChange,
}: {
  value: string;
  personaName: string;
  onChange: (v: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlField, setShowUrlField] = useState(false);

  const initial =
    (personaName?.trim()[0] ?? "L").toUpperCase();

  async function handleFile(file: File) {
    setError(null);
    // Client-side validation mirrors the server route so we fail fast
    // instead of paying for an upload that the server would reject.
    if (file.size > 2 * 1024 * 1024) {
      setError("Image too large. Max 2 MB.");
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
    ) {
      setError("Use a JPEG, PNG, WebP, or GIF.");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/portal/chatbot/avatar", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !json.ok || !json.url) {
        throw new Error(json.error ?? `Upload failed (${res.status})`);
      }
      onChange(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (uploading) return;
    setError(null);
    setUploading(true);
    try {
      const res = await fetch("/api/portal/chatbot/avatar", {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Remove failed");
      }
      onChange("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={LABEL_CLASS}>Avatar</span>
      <div className="flex items-start gap-3">
        {/* Preview */}
        <div
          className="relative h-16 w-16 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0"
          style={{
            border: "1px solid var(--border)",
          }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Chatbot avatar"
              className="h-full w-full object-cover"
              onError={() => setError("Image failed to load. Try re-uploading.")}
            />
          ) : (
            <span
              className="text-foreground/70 font-semibold"
              style={{ fontSize: 22 }}
              aria-hidden="true"
            >
              {initial}
            </span>
          )}
          {uploading ? (
            <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 min-w-[160px]">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              // Reset so re-selecting the same file re-fires onChange.
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 disabled:opacity-50 transition-colors"
          >
            <Upload className="h-3 w-3" />
            {value ? "Replace image" : "Upload image"}
          </button>
          {value ? (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-50 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowUrlField((v) => !v)}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 self-start"
          >
            {showUrlField ? "Hide URL field" : "Or paste a URL"}
          </button>
        </div>
      </div>

      {showUrlField ? (
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://cdn.example.com/avatar.png"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      ) : null}

      {error ? (
        <p className="inline-flex items-center gap-1 text-[11px] text-destructive">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      ) : (
        <p className="text-[10.5px] text-muted-foreground leading-snug">
          PNG, JPEG, WebP, or GIF. Max 2 MB. Square images look best.
        </p>
      )}
    </div>
  );
}
