import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  severity: string;
  size?: "sm" | "md";
};

export function SeverityPill({ severity, size = "md" }: Props) {
  // Outlined high-contrast pills — white interior, saturated border + text
  // so the eye lands on CRITICAL the moment the page paints. The previous
  // muted-tone variant (bg-destructive/10) read as beige next to the rest
  // of the dashboard chrome and lost its alarming character entirely.
  const config = {
    critical: {
      label: "Critical",
      icon: AlertCircle,
      cls: "bg-white text-red-700 border-red-400 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700",
    },
    high: {
      label: "High",
      icon: AlertCircle,
      cls: "bg-white text-amber-700 border-amber-400 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
    },
    warning: {
      label: "Warning",
      icon: AlertTriangle,
      cls: "bg-white text-amber-700 border-amber-400 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
    },
    info: {
      label: "Info",
      icon: Info,
      cls: "bg-white text-foreground border-border",
    },
  }[severity] ?? {
    label: severity,
    icon: Info,
    cls: "bg-white text-muted-foreground border-border",
  };

  const Icon = config.icon;
  const gap =
    size === "sm"
      ? "gap-0.5 px-1.5 py-0.5 text-[10px]"
      : "gap-1 px-2 py-0.5 text-[10px]";
  const iconSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-bold uppercase tracking-wider border",
        gap,
        config.cls,
      )}
    >
      <Icon className={iconSize} strokeWidth={2.5} aria-hidden="true" />
      {config.label}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {category}
    </span>
  );
}
