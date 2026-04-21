"use client";

import { CheckCircle2 } from "lucide-react";
import { OptionButton } from "./option-button";
import { CalEmbed } from "./cal-embed";
import { GO_LIVE_TARGETS, MODULE_CATALOG } from "./constants";
import type {
  GoLiveTarget,
  Step1Data,
  Step2Data,
  Step3Data,
  Step4Data,
} from "./types";

// ---------------------------------------------------------------------------
// Step 4 validation: ToS must be accepted before submission.
// ---------------------------------------------------------------------------

export function validateStep4(data: Step4Data): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.tosAccepted) {
    errors.tosAccepted = "You must agree to the terms to continue";
  }
  return errors;
}

export function StepBooking({
  step1,
  step2,
  step3,
  step4,
  onChange,
  submitted,
  attempted,
}: {
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
  onChange: (patch: Partial<Step4Data>) => void;
  submitted: boolean;
  attempted: boolean;
}) {
  const selectedLabels = MODULE_CATALOG.filter((m) => step3.modules[m.key]).map(
    (m) => m.label
  );
  const errors = attempted ? validateStep4(step4) : {};

  return (
    <div className="space-y-8">
      <div className="border rounded-md p-6">
        <p className="text-xs tracking-widest uppercase opacity-60 mb-4">
          Your account at a glance
        </p>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <Item label="Company" value={step1.companyName || "—"} />
          <Item label="Property type" value={step1.propertyType || "—"} />
          <Item
            label="Portfolio"
            value={
              step2.numberOfProperties != null
                ? `${step2.numberOfProperties} properties`
                : "—"
            }
          />
          <Item
            label="Backend"
            value={step2.currentBackendPlatform || "—"}
          />
          <Item
            label="Current vendor"
            value={step2.currentVendor || "—"}
          />
          <Item
            label="Services"
            value={
              selectedLabels.length ? `${selectedLabels.length} selected` : "—"
            }
          />
        </dl>
        {selectedLabels.length > 0 && (
          <div className="mt-4 pt-4 border-t flex flex-wrap gap-1.5">
            {selectedLabels.map((label) => (
              <span
                key={label}
                className="text-[11px] px-2 py-1 rounded bg-foreground text-background"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs tracking-widest uppercase opacity-60 mb-2">
          When do you want to go live?
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {GO_LIVE_TARGETS.map((t) => (
            <OptionButton
              key={t.key}
              size="sm"
              selected={step4.goLiveTarget === t.key}
              onClick={() => onChange({ goLiveTarget: t.key as GoLiveTarget })}
            >
              {t.label}
            </OptionButton>
          ))}
        </div>
      </div>

      <div className="border rounded-md p-6">
        <p className="text-xs tracking-widest uppercase opacity-60 mb-4">
          What happens on your call
        </p>
        <div className="space-y-3">
          {[
            "Walk through your portfolio and current marketing stack.",
            "Identify the highest-leverage modules for your property type.",
            "Confirm domain, brand assets, and launch timeline.",
            "Share a proposal with retainer and setup pricing within 24 hours.",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <CheckCircle2
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ToS checkbox */}
      <div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={step4.tosAccepted}
            onChange={(e) => onChange({ tosAccepted: e.target.checked })}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border border-input accent-foreground"
            aria-invalid={!!errors.tosAccepted}
          />
          <span className="text-xs leading-relaxed opacity-80">
            I agree to the{" "}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Privacy Policy
            </a>
            .
          </span>
        </label>
        {errors.tosAccepted ? (
          <p className="text-[11px] text-destructive mt-1.5 ml-7">{errors.tosAccepted}</p>
        ) : null}
      </div>

      <div>
        <p className="text-xs tracking-widest uppercase opacity-60 mb-4">
          {submitted ? "Pick a time, your intake is saved" : "Pick a time"}
        </p>
        <div className="border rounded-md overflow-hidden bg-white">
          <CalEmbed
            name={step1.primaryContactName}
            email={step1.primaryContactEmail}
          />
        </div>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] tracking-widest uppercase opacity-60 mb-0.5">
        {label}
      </dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
