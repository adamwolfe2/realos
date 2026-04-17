"use client";

import { IntakeField } from "./field";
import { OptionButton } from "./option-button";
import { BACKEND_PLATFORMS, PAIN_POINTS } from "./constants";
import type { BackendPlatformKey, Step2Data } from "./types";

export function StepPortfolio({
  data,
  onChange,
}: {
  data: Step2Data;
  onChange: (patch: Partial<Step2Data>) => void;
}) {
  return (
    <div className="space-y-6">
      <IntakeField
        label="Number of properties in your portfolio"
        type="number"
        inputMode="numeric"
        value={data.numberOfProperties?.toString() ?? ""}
        onChange={(v) =>
          onChange({ numberOfProperties: v ? parseInt(v, 10) : null })
        }
        placeholder="e.g. 3"
      />

      <div>
        <p className="text-xs tracking-widest uppercase opacity-70 mb-2">
          Current backend platform
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {BACKEND_PLATFORMS.map((b) => (
            <OptionButton
              key={b.key}
              size="sm"
              selected={data.currentBackendPlatform === b.key}
              onClick={() =>
                onChange({
                  currentBackendPlatform: b.key as BackendPlatformKey,
                })
              }
            >
              {b.label}
            </OptionButton>
          ))}
        </div>
      </div>

      {data.currentBackendPlatform === "APPFOLIO" && (
        <IntakeField
          label="AppFolio plan"
          value={data.backendPlanTier}
          onChange={(v) => onChange({ backendPlanTier: v })}
          placeholder="Core / Plus / Max"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <IntakeField
          label="Current marketing vendor"
          value={data.currentVendor}
          onChange={(v) => onChange({ currentVendor: v })}
          placeholder="e.g. Conversion Logix"
        />
        <IntakeField
          label="Current monthly marketing spend ($)"
          type="number"
          inputMode="decimal"
          value={data.currentMonthlySpend?.toString() ?? ""}
          onChange={(v) =>
            onChange({ currentMonthlySpend: v ? parseFloat(v) : null })
          }
          placeholder="e.g. 2500"
        />
      </div>

      <div>
        <p className="text-xs tracking-widest uppercase opacity-70 mb-2">
          Biggest pain point right now
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PAIN_POINTS.map((p) => (
            <OptionButton
              key={p}
              size="sm"
              selected={data.biggestPainPoint === p}
              onClick={() => onChange({ biggestPainPoint: p })}
            >
              {p}
            </OptionButton>
          ))}
        </div>
      </div>
    </div>
  );
}
