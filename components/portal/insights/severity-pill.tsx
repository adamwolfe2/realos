import { AlertTriangle, AlertOctagon, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  severity: string;
  size?: "sm" | "md";
};

export function SeverityPill({ severity, size = "md" }: Props) {
  // Brand-aligned severity tones — single primary accent expressed at
  // different intensities (filled vs tinted vs neutral) instead of a
  // green / amber / red rainbow. Critical is the destructive token —
  // reserved for genuinely actionable problems, not category colour.
  const config = {
    critical: {
      label: "Critical",
      icon: AlertOctagon,
      cls: "bg-destructive/10 text-destructive ring-destructive/30",
    },
    warning: {
      label: "Warning",
      icon: AlertTriangle,
      cls: "bg-primary/10 text-primary ring-primary/30",
    },
    info: {
      label: "Info",
      icon: Info,
      cls: "bg-muted text-foreground ring-border",
    },
  }[severity] ?? {
    label: severity,
    icon: Info,
    cls: "bg-muted text-muted-foreground ring-border",
  };

  const Icon = config.icon;
  const gap = size === "sm" ? "gap-0.5 px-1.5 py-0.5 text-[9px]" : "gap-1 px-2 py-0.5 text-[10px]";
  const iconSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-semibold uppercase tracking-widest ring-1 ring-inset",
        gap,
        config.cls,
      )}
    >
      <Icon className={iconSize} aria-hidden="true" />
      {config.label}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
      {category}
    </span>
  );
}
