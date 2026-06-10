"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { savePropertyChatbotConfig } from "@/lib/actions/chatbot-config";

// Per-property chatbot override editor (slice S1). Every field is optional —
// leaving it blank inherits the workspace default (shown as the placeholder).
// chatbotEnabled is a tri-state select: Inherit / On / Off.

type PropertyChatbotConfigShape = {
  chatbotEnabled: boolean | null;
  chatbotPersonaName: string | null;
  chatbotGreeting: string | null;
  chatbotFollowUpMessage: string | null;
  chatbotTeaserText: string | null;
  chatbotBrandColor: string | null;
  chatbotCaptureMode: string | null;
  chatbotKnowledgeBase: string | null;
  phoneNumber: string | null;
  contactEmail: string | null;
  primaryCtaText: string | null;
  primaryCtaUrl: string | null;
};

type OrgDefaults = {
  chatbotEnabled: boolean;
  chatbotPersonaName: string | null;
  chatbotGreeting: string | null;
  chatbotCaptureMode: string;
  chatbotKnowledgeBase: string | null;
  phoneNumber: string | null;
  contactEmail: string | null;
  primaryCtaText: string | null;
  primaryCtaUrl: string | null;
};

const FIELD =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";
const LABEL = "block text-xs font-medium text-foreground mb-1";
const HINT = "mt-1 text-[11px] text-muted-foreground";

function inheritHint(v: string | null | undefined) {
  return v ? `Inherits: ${v}` : "Inherits workspace default";
}

export function PropertyChatbotConfigForm({
  propertyId,
  config,
  orgDefaults,
}: {
  propertyId: string;
  config: PropertyChatbotConfigShape | null;
  orgDefaults: OrgDefaults;
}) {
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await savePropertyChatbotConfig(formData);
      if (res.ok) toast.success("Property chatbot saved");
      else toast.error(res.error);
    });
  }

  const enabledValue =
    config?.chatbotEnabled == null ? "inherit" : config.chatbotEnabled ? "on" : "off";
  const captureValue = config?.chatbotCaptureMode ?? "";

  return (
    <form action={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
      <input type="hidden" name="propertyId" value={propertyId} />

      <div>
        <h3 className="text-sm font-semibold text-foreground">This property&apos;s chatbot</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Override the workspace bot for this property&apos;s own website. Leave a field blank to
          inherit the workspace default.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Status</label>
          <select name="chatbotEnabled" defaultValue={enabledValue} className={FIELD}>
            <option value="inherit">
              Inherit workspace ({orgDefaults.chatbotEnabled ? "On" : "Off"})
            </option>
            <option value="on">On for this property</option>
            <option value="off">Off for this property</option>
          </select>
        </div>

        <div>
          <label className={LABEL}>Capture mode</label>
          <select name="chatbotCaptureMode" defaultValue={captureValue} className={FIELD}>
            <option value="">Inherit ({orgDefaults.chatbotCaptureMode})</option>
            <option value="PRE_CHAT">Pre-chat</option>
            <option value="ON_INTENT">On intent</option>
            <option value="OFF">Off</option>
          </select>
        </div>

        <div>
          <label className={LABEL}>Persona name</label>
          <input
            name="chatbotPersonaName"
            defaultValue={config?.chatbotPersonaName ?? ""}
            placeholder={inheritHint(orgDefaults.chatbotPersonaName)}
            className={FIELD}
          />
        </div>

        <div>
          <label className={LABEL}>Brand color (hex)</label>
          <input
            name="chatbotBrandColor"
            defaultValue={config?.chatbotBrandColor ?? ""}
            placeholder="#1a1a2e"
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <label className={LABEL}>Greeting</label>
        <input
          name="chatbotGreeting"
          defaultValue={config?.chatbotGreeting ?? ""}
          placeholder={inheritHint(orgDefaults.chatbotGreeting)}
          className={FIELD}
        />
      </div>

      <div>
        <label className={LABEL}>Knowledge base (facts about this property)</label>
        <textarea
          name="chatbotKnowledgeBase"
          defaultValue={config?.chatbotKnowledgeBase ?? ""}
          rows={5}
          placeholder={
            orgDefaults.chatbotKnowledgeBase
              ? "Inherits the workspace knowledge base — add property-specific facts here (units, pricing, amenities, neighborhood)."
              : "Add facts specific to this property: floor plans, pricing, amenities, neighborhood, leasing terms."
          }
          className={FIELD}
        />
        <p className={HINT}>
          The bot on this property&apos;s site answers from these facts. Keep it specific to this
          building.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Teaser text</label>
          <input
            name="chatbotTeaserText"
            defaultValue={config?.chatbotTeaserText ?? ""}
            placeholder="Questions? I'm here."
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL}>Follow-up message</label>
          <input
            name="chatbotFollowUpMessage"
            defaultValue={config?.chatbotFollowUpMessage ?? ""}
            placeholder="Optional second message"
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL}>Contact phone</label>
          <input
            name="phoneNumber"
            defaultValue={config?.phoneNumber ?? ""}
            placeholder={inheritHint(orgDefaults.phoneNumber)}
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL}>Contact email</label>
          <input
            name="contactEmail"
            defaultValue={config?.contactEmail ?? ""}
            placeholder={inheritHint(orgDefaults.contactEmail)}
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL}>Primary CTA text</label>
          <input
            name="primaryCtaText"
            defaultValue={config?.primaryCtaText ?? ""}
            placeholder={inheritHint(orgDefaults.primaryCtaText)}
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL}>Primary CTA URL</label>
          <input
            name="primaryCtaUrl"
            defaultValue={config?.primaryCtaUrl ?? ""}
            placeholder={inheritHint(orgDefaults.primaryCtaUrl)}
            className={FIELD}
          />
        </div>
      </div>

      <div className="flex">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 w-full sm:w-auto sm:ml-auto"
        >
          {pending ? "Saving…" : "Save chatbot"}
        </button>
      </div>
    </form>
  );
}
