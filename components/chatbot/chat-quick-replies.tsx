"use client";

// Contextual quick-reply chips. Regex-matches the last assistant message
// against keyword buckets and renders up to 3 suggestion chips. Click sends
// the chip label as a user message through the provided onSelect callback.
// Pure presentation, no network calls.

type Bucket = { test: RegExp; chips: string[] };

const BUCKETS: Bucket[] = [
  {
    test: /\b(tour|visit|walk[- ]?through|see the|show me)\b/i,
    chips: ["Request a tour", "Current availability", "Amenities"],
  },
  {
    test: /(rate|price|\$|rent|cost|how much)/i,
    chips: ["Current availability", "What's included?", "Request a tour"],
  },
  {
    test: /\b(apply|application|lease)\b/i,
    chips: ["Start application", "Request a tour", "Room types"],
  },
  {
    test: /\b(room|bed|bedroom|floor ?plan|studio)\b/i,
    chips: ["Shared rooms", "Private rooms", "Current availability"],
  },
  {
    test: /\b(location|campus|close|near|walk|neighborhood|transit|bus|bart)\b/i,
    chips: ["Nearby dining", "Public transit", "Current availability"],
  },
];

const DEFAULT_CHIPS = [
  "Tell me about amenities",
  "How close is campus?",
  "What's included?",
];

export function ChatQuickReplies({
  lastAssistantMessage,
  onSelect,
  disabled,
}: {
  lastAssistantMessage: string | null;
  onSelect: (text: string) => void;
  disabled?: boolean;
}) {
  if (!lastAssistantMessage) return null;
  const bucket = BUCKETS.find((b) => b.test.test(lastAssistantMessage));
  const chips = bucket?.chips ?? DEFAULT_CHIPS;

  return (
    <div className="flex flex-wrap gap-2 px-1 pt-1">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(chip)}
          className="text-xs px-3 py-1.5 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
