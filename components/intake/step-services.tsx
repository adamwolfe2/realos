"use client";

import { Switch } from "@/components/ui/switch";
import { MODULE_CATALOG } from "./constants";
import type { IntakeModules, Step3Data } from "./types";

// ---------------------------------------------------------------------------
// Step 3 validation: at least one module must be selected.
// ---------------------------------------------------------------------------

export function validateStep3(data: Step3Data): Record<string, string> {
  const errors: Record<string, string> = {};
  const hasAny = Object.values(data.modules).some(Boolean);
  if (!hasAny) {
    errors.modules = "Select at least one service to continue";
  }
  return errors;
}

export function StepServices({
  data,
  onChange,
  attempted,
}: {
  data: Step3Data;
  onChange: (patch: Partial<Step3Data>) => void;
  attempted: boolean;
}) {
  const toggle = (key: keyof IntakeModules) =>
    onChange({
      modules: { ...data.modules, [key]: !data.modules[key] },
    });

  const selectedCount = Object.values(data.modules).filter(Boolean).length;
  const errors = attempted ? validateStep3(data) : {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs opacity-70">
          {selectedCount} of {MODULE_CATALOG.length} services selected
        </p>
        <p className="text-xs opacity-70">Pricing finalized on the call.</p>
      </div>

      {errors.modules ? (
        <p className="text-[11px] text-destructive">{errors.modules}</p>
      ) : null}

      <div className="space-y-3">
        {MODULE_CATALOG.map((m) => {
          const checked = !!data.modules[m.key];
          return (
            <label
              key={m.key}
              className="flex items-start justify-between gap-4 p-4 border rounded-md cursor-pointer hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="font-medium text-sm">{m.label}</h3>
                  <span className="text-xs opacity-60">{m.priceHint}</span>
                </div>
                <p className="text-xs opacity-70 mt-1">{m.desc}</p>
              </div>
              <Switch checked={checked} onCheckedChange={() => toggle(m.key)} />
            </label>
          );
        })}
      </div>
    </div>
  );
}
