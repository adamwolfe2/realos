"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function IntakeField({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  inputMode,
  className,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: React.HTMLInputTypeAttribute;
  required?: boolean;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  className?: string;
  error?: string;
}) {
  const id = React.useId();
  const errId = `${id}-err`;
  return (
    <div className={className ?? "flex flex-col gap-1.5"}>
      <Label htmlFor={id} className="text-xs tracking-widest uppercase opacity-70">
        {label}
        {required ? <span aria-hidden="true" className="ml-0.5">*</span> : null}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        inputMode={inputMode}
        aria-invalid={!!error}
        aria-describedby={error ? errId : undefined}
        className={error ? "border-destructive focus-visible:ring-destructive" : undefined}
      />
      {error ? (
        <p id={errId} className="text-[11px] text-destructive leading-tight">
          {error}
        </p>
      ) : null}
    </div>
  );
}
