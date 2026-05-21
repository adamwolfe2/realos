import { Clock, MousePointer2, ArrowDownToLine, MoveRight, Zap, MapPin, RotateCcw, Repeat } from "lucide-react";

interface Props {
  trigger: string;
  triggerThreshold: number | null;
  targetUrlPatterns: string[];
  frequency: string;
  position: string;
}

/**
 * Human-readable summary of "when will this popup actually fire?"
 *
 * Renders a compact 3-row card explaining the trigger condition, URL
 * filter, and frequency cap in plain English. Eliminates the
 * "what does TIME_ON_PAGE with threshold 8 actually mean?" tax that
 * forces operators to context-switch into docs (or this very
 * codebase) to verify their config.
 *
 * Pure server component — no client state, no fetches. Re-rendered
 * automatically when the operator saves changes to the campaign.
 */
export function TriggerInspector({
  trigger,
  triggerThreshold,
  targetUrlPatterns,
  frequency,
  position,
}: Props) {
  const triggerLine = describeTrigger(trigger, triggerThreshold);
  const urlLine = describeUrlPatterns(targetUrlPatterns);
  const frequencyLine = describeFrequency(frequency);

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 text-[12.5px]">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        When this popup fires
      </p>
      <ul className="space-y-1.5">
        <li className="flex items-start gap-2">
          <triggerLine.Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-foreground/70" />
          <span className="leading-snug">{triggerLine.text}</span>
        </li>
        <li className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-foreground/70" />
          <span className="leading-snug">{urlLine}</span>
        </li>
        <li className="flex items-start gap-2">
          <frequencyLine.Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-foreground/70" />
          <span className="leading-snug">{frequencyLine.text}</span>
        </li>
        <li className="flex items-start gap-2">
          <MoveRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-foreground/70" />
          <span className="leading-snug">Rendered in the {describePosition(position)} of the viewport.</span>
        </li>
      </ul>
    </div>
  );
}

function describeTrigger(trigger: string, threshold: number | null): { Icon: typeof Clock; text: string } {
  const sec = Math.max(0, Number(threshold) || 0);
  switch (trigger) {
    case "IMMEDIATE":
      return { Icon: Zap, text: "Visitor arrives on the page (no delay)." };
    case "TIME_ON_PAGE":
      return { Icon: Clock, text: `Visitor stays on a matching page for ${sec || 0}+ second${sec === 1 ? "" : "s"} without navigating away.` };
    case "IDLE_TIME":
      return { Icon: Clock, text: `Visitor goes idle (no mouse/keyboard/scroll) for ${sec || 30}+ second${sec === 1 ? "" : "s"}.` };
    case "SCROLL_DEPTH":
      return { Icon: ArrowDownToLine, text: `Visitor scrolls past ${Math.max(1, Math.min(100, sec || 50))}% of the page.` };
    case "EXIT_INTENT":
    default:
      return { Icon: MousePointer2, text: "Visitor's cursor leaves the viewport toward the browser chrome (exit intent)." };
  }
}

function describeUrlPatterns(patterns: string[]): string {
  if (!patterns || patterns.length === 0) {
    return "On any page of your site.";
  }
  if (patterns.length === 1) {
    return `On pages whose URL contains "${patterns[0]}".`;
  }
  return `On pages whose URL contains any of: ${patterns.map((p) => `"${p}"`).join(", ")}.`;
}

function describeFrequency(frequency: string): { Icon: typeof Repeat; text: string } {
  switch (frequency) {
    case "always":
      return { Icon: Repeat, text: "Every matching page load (no dedup — use sparingly)." };
    case "once_per_day":
      return { Icon: RotateCcw, text: "At most once per visitor per 24 hours." };
    case "session":
    default:
      return { Icon: RotateCcw, text: "At most once per visitor per browser session." };
  }
}

function describePosition(position: string): string {
  switch (position) {
    case "CENTER":
      return "center (overlay with backdrop)";
    case "BOTTOM_LEFT":
      return "bottom-left corner";
    case "TOP_BANNER":
      return "top of the page (banner)";
    case "BOTTOM_RIGHT":
    default:
      return "bottom-right corner";
  }
}
