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
    <form onSubmit={submit} className="space-y-6">
      {/* Mirror the live master-toggle value so the save action doesn't flip
          it off when the form submits. */}
      <input
        type="hidden"
        name="chatbotEnabled"
        value={String(initial.chatbotEnabled)}
      />

      <section className="border rounded-md p-5 space-y-4">
        <h2 className="font-serif text-lg font-bold">Persona</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

      <section className="border rounded-md p-5 space-y-4">
        <h2 className="font-serif text-lg font-bold">Appearance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs tracking-widest uppercase opacity-70">
              Brand color
            </span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={effectiveBrandColor}
                onChange={(e) => update("chatbotBrandColor", e.target.value)}
                className="h-9 w-12 border rounded cursor-pointer bg-background"
                aria-label="Brand color picker"
              />
              <input
                type="text"
                name="chatbotBrandColor"
                value={state.chatbotBrandColor}
                onChange={(e) =>
                  update("chatbotBrandColor", e.target.value)
                }
                placeholder={orgPrimaryColor ?? "#111111"}
                className="flex-1 border rounded px-3 py-2 text-sm bg-background font-mono"
              />
            </div>
            <span className="text-[11px] opacity-60">
              Leave blank to inherit your brand primary color
              {orgPrimaryColor ? ` (${orgPrimaryColor}).` : "."}
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs tracking-widest uppercase opacity-70">
              Idle trigger (seconds)
            </span>
            <input
              type="number"
              name="chatbotIdleTriggerSeconds"
              min={0}
              max={600}
              value={state.chatbotIdleTriggerSeconds}
              onChange={(e) =>
                update(
                  "chatbotIdleTriggerSeconds",
                  parseInt(e.target.value, 10) || 0
                )
              }
              className="border rounded px-3 py-2 text-sm bg-background"
            />
            <span className="text-[11px] opacity-60">
              Seconds before the proactive teaser bubble pops up. 0 disables
              the teaser.
            </span>
          </label>
        </div>
      </section>

      <section className="border rounded-md p-5 space-y-3">
        <h2 className="font-serif text-lg font-bold">Lead capture</h2>
        <p className="text-xs opacity-60">
          Choose when the bot asks for a visitor&apos;s name and email.
        </p>
        <div className="space-y-2">
          {CAPTURE_OPTIONS.map((opt) => {
            const active = state.chatbotCaptureMode === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-3 border rounded-md px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                  active ? "border-foreground" : "hover:bg-muted/40"
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
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-[11px] opacity-70">{opt.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="border rounded-md p-5 space-y-3">
        <h2 className="font-serif text-lg font-bold">Knowledge base</h2>
        <p className="text-xs opacity-60">
          Plain-text facts, amenities, and policies injected into the
          system prompt. Write like you&apos;re briefing a new front-desk
          hire.
        </p>
        <textarea
          name="chatbotKnowledgeBase"
          rows={12}
          value={state.chatbotKnowledgeBase}
          onChange={(e) => update("chatbotKnowledgeBase", e.target.value)}
          className="w-full border rounded px-3 py-2 text-xs font-mono bg-background"
          placeholder={"Rent includes utilities and WiFi.\nPet policy: cats OK, dogs under 40 lbs with $500 deposit.\nTours: Monday-Saturday 10am-6pm."}
        />
        <div className="flex items-center justify-between">
          <span
            className={`text-[11px] ${
              kbOver
                ? "text-destructive"
                : kbNear
                  ? "text-amber-700"
                  : "opacity-60"
            }`}
          >
            {kbLength.toLocaleString()} / {KB_MAX.toLocaleString()} characters
            {kbOver ? " — trim to save" : kbNear ? " — nearing limit" : ""}
          </span>
        </div>
      </section>

      <Preview
        personaName={state.chatbotPersonaName || "Leasing"}
        greeting={
          state.chatbotGreeting ||
          "Hi! What can I help you with today?"
        }
        brandColor={effectiveBrandColor}
      />

      <div className="flex items-center gap-3 sticky bottom-0 bg-background py-3 border-t">
        <button
          type="submit"
          disabled={pending || kbOver}
          className="bg-foreground text-background px-4 py-2 text-xs font-semibold rounded disabled:opacity-40"
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
          <span className="text-xs opacity-60">
            Module off — saves stage content without publishing.
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Preview({
  personaName,
  greeting,
  brandColor,
}: {
  personaName: string;
  greeting: string;
  brandColor: string;
}) {
  return (
    <section className="border rounded-md p-5 space-y-3">
      <h2 className="font-serif text-lg font-bold">Preview</h2>
      <p className="text-xs opacity-60">
        Quick sanity-check of the persona + brand color. The full widget
        renders live once the master toggle is on.
      </p>
      <div className="flex items-start gap-3 max-w-md">
        <div
          aria-hidden
          className="h-10 w-10 rounded-full flex-shrink-0"
          style={{ backgroundColor: brandColor }}
        />
        <div className="flex-1 border rounded-lg rounded-tl-none px-4 py-3 text-sm bg-muted/30">
          <div className="text-[11px] uppercase tracking-widest opacity-60 mb-1">
            {personaName}
          </div>
          <p className="whitespace-pre-wrap">{greeting}</p>
        </div>
      </div>
    </section>
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
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs tracking-widest uppercase opacity-70">
        {label}
      </span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="border rounded px-3 py-2 text-sm bg-background"
      />
      {hint ? (
        <span className="text-[11px] opacity-60">{hint}</span>
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
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs tracking-widest uppercase opacity-70">
        {label}
      </span>
      <textarea
        name={name}
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded px-3 py-2 text-sm bg-background"
      />
      {hint ? (
        <span className="text-[11px] opacity-60">{hint}</span>
      ) : null}
    </label>
  );
}
