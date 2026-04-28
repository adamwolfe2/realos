"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChatbotCaptureMode } from "@prisma/client";
import { saveChatbotConfig } from "@/lib/actions/chatbot-config";

type FormState = {
  chatbotEnabled: boolean;
  chatbotAvatarUrl: string;
  chatbotPersonaName: string;
  chatbotGreeting: string;
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Persona name"
            name="chatbotPersonaName"
            value={state.chatbotPersonaName}
            onChange={(v) => update("chatbotPersonaName", v)}
            placeholder="Leasing, Maya, etc."
            maxLength={100}
          />
          <Field
            label="Avatar URL"
            name="chatbotAvatarUrl"
            type="url"
            value={state.chatbotAvatarUrl}
            onChange={(v) => update("chatbotAvatarUrl", v)}
            placeholder="https://..."
          />
        </div>
        <TextArea
          label="Greeting"
          name="chatbotGreeting"
          rows={2}
          value={state.chatbotGreeting}
          onChange={(v) => update("chatbotGreeting", v)}
          hint="First message the bot sends (1-2 lines)."
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
            <span className="text-xs text-emerald-700">Saved</span>
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
  hint?: string;
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
