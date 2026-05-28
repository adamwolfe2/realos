"use client";

import * as React from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PlacesAutocomplete — debounced combobox over our /api/places/autocomplete
// proxy. The Google API key never reaches the browser; this component fires
// short search strings at the server, renders predictions, and emits a
// fully-resolved address (street/city/state/zip + lat/lng + placeId) on
// select.
//
// Degrades gracefully when GOOGLE_PLACES_API_KEY is missing: the route
// returns { disabled: true } and we render a plain text input so the
// operator can still type a freeform address.
// ---------------------------------------------------------------------------

export type ResolvedPlace = {
  placeId: string;
  formattedAddress: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

type Prediction = {
  placeId: string;
  primary: string;
  secondary: string;
};

const DEBOUNCE_MS = 220;

export function PlacesAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing an address…",
  id,
  className,
  disabled = false,
}: {
  /** Free-text value shown in the input (street + maybe city). */
  value: string;
  /** Free-text change handler so the form can fall back to manual entry. */
  onChange: (v: string) => void;
  /** Fires when the user clicks a prediction and the details fetch resolves. */
  onSelect: (place: ResolvedPlace) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [predictions, setPredictions] = React.useState<Prediction[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [serviceDisabled, setServiceDisabled] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<number | null>(null);
  const lastSelectedRef = React.useRef<string | null>(null);

  // Debounced fetch on input change. Skips fetch when the input matches the
  // last selected prediction (prevents an extra round-trip immediately after
  // a successful select).
  React.useEffect(() => {
    if (serviceDisabled) return;
    if (disabled) return;
    if (value === lastSelectedRef.current) return;
    if (value.trim().length < 3) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      void runSearch(value);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
    // runSearch is stable per-render; eslint disable not needed since it's
    // declared inline below and captures setters that React guarantees stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, serviceDisabled, disabled]);

  async function runSearch(q: string) {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/places/autocomplete?q=${encodeURIComponent(q)}`,
        { method: "GET", cache: "no-store" },
      );
      if (r.status === 503) {
        // Server says key is not configured. Stop polling permanently.
        setServiceDisabled(true);
        setPredictions([]);
        setOpen(false);
        return;
      }
      if (!r.ok) {
        setPredictions([]);
        return;
      }
      const json = (await r.json()) as { predictions?: Prediction[] };
      const list = json.predictions ?? [];
      setPredictions(list);
      setOpen(list.length > 0);
      setActiveIndex(list.length > 0 ? 0 : -1);
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }

  async function selectPrediction(p: Prediction) {
    // Synthesize a sensible display value immediately so the input doesn't
    // flicker while the details fetch resolves.
    const display = [p.primary, p.secondary].filter(Boolean).join(", ");
    onChange(display);
    lastSelectedRef.current = display;
    setOpen(false);
    setPredictions([]);
    try {
      const r = await fetch(
        `/api/places/autocomplete?placeId=${encodeURIComponent(p.placeId)}`,
        { method: "GET", cache: "no-store" },
      );
      if (!r.ok) return;
      const json = (await r.json()) as { details?: ResolvedPlace };
      if (json.details) {
        // Update display with the canonical address line returned by
        // Google so the input matches the persisted value.
        if (json.details.addressLine1) {
          onChange(json.details.addressLine1);
          lastSelectedRef.current = json.details.addressLine1;
        }
        onSelect(json.details);
      }
    } catch {
      // Best-effort — the display already shows the prediction.
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % predictions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        i <= 0 ? predictions.length - 1 : i - 1,
      );
    } else if (e.key === "Enter") {
      const idx = activeIndex < 0 ? 0 : activeIndex;
      const p = predictions[idx];
      if (p) {
        e.preventDefault();
        void selectPrediction(p);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && predictions.length > 0;

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-foreground">
          <MapPin className="h-4 w-4" aria-hidden="true" />
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (predictions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            // Delay so a click on a prediction registers before we close.
            window.setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          role="combobox"
          className={cn(
            "w-full pl-9 pr-9 py-2 text-sm rounded-md border bg-background",
            "border-input focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          )}
        />
        {loading ? (
          <span className="absolute inset-y-0 right-2.5 flex items-center text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      {showDropdown ? (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-72 overflow-auto rounded-md border border-border bg-popover shadow-md"
        >
          {predictions.map((p, i) => {
            const active = i === activeIndex;
            return (
              <li
                key={p.placeId}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  // mousedown (not click) so we fire before the input's
                  // blur handler closes the menu.
                  e.preventDefault();
                  void selectPrediction(p);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "px-3 py-2 cursor-pointer text-sm",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/60",
                )}
              >
                <div className="font-medium truncate">{p.primary}</div>
                {p.secondary ? (
                  <div className="text-xs text-muted-foreground truncate">
                    {p.secondary}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {serviceDisabled ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Address suggestions are unavailable. Enter the address manually.
        </p>
      ) : null}
    </div>
  );
}
