"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search as SearchIcon,
  Users,
  Eye,
  Building2,
  MessageSquare,
  Loader2,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Cmd+K global search modal. Lives in the portal layout so any page can
// trigger it. Search across leads, visitors, properties, conversations.
//
// Keyboard:
//   - Cmd/Ctrl + K, /, or click the trigger button to open
//   - Up/Down arrow to move highlight, Enter to navigate, Esc to close
//
// The trigger button is rendered at the top of the portal layout so it's
// visible on every page including the dashboard.
// ---------------------------------------------------------------------------

type LeadResult = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  source: string;
  lastActivityAt: string;
};
type VisitorResult = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  status: string;
  intentScore: number;
  lastSeenAt: string;
};
type PropertyResult = {
  id: string;
  name: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  availableCount: number | null;
  totalUnits: number | null;
};
type ConversationResult = {
  id: string;
  capturedName: string | null;
  capturedEmail: string | null;
  status: string;
  messageCount: number;
  lastMessageAt: string;
};

type SearchPayload = {
  q: string;
  results: {
    leads: LeadResult[];
    visitors: VisitorResult[];
    properties: PropertyResult[];
    conversations: ConversationResult[];
  } | [];
};

type FlatItem = {
  group: "leads" | "visitors" | "properties" | "conversations";
  href: string;
  primary: string;
  secondary: string;
};

export function CmdKSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [data, setData] = React.useState<SearchPayload | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open via Cmd/Ctrl+K and "/"
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus input on open
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQ("");
      setData(null);
      setHighlight(0);
    }
  }, [open]);

  // Debounced fetch
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open || q.trim().length < 2) {
      setData(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/tenant/search?q=${encodeURIComponent(q.trim())}`
        );
        if (r.ok) {
          const json = (await r.json()) as SearchPayload;
          setData(json);
          setHighlight(0);
        }
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, open]);

  const flat: FlatItem[] = React.useMemo(() => {
    if (!data || Array.isArray(data.results)) return [];
    const out: FlatItem[] = [];
    for (const l of data.results.leads) {
      const name =
        [l.firstName, l.lastName].filter(Boolean).join(" ") ||
        l.email ||
        "Anonymous";
      out.push({
        group: "leads",
        href: `/portal/leads/${l.id}`,
        primary: name,
        secondary: `${humanize(l.status)} · ${humanize(l.source)}${l.email ? ` · ${l.email}` : ""}`,
      });
    }
    for (const v of data.results.visitors) {
      const name =
        [v.firstName, v.lastName].filter(Boolean).join(" ") ||
        v.email ||
        "Anonymous";
      out.push({
        group: "visitors",
        href: `/portal/visitors/${v.id}`,
        primary: name,
        secondary: `${humanize(v.status)}${v.intentScore ? ` · intent ${v.intentScore}` : ""}${v.email ? ` · ${v.email}` : ""}`,
      });
    }
    for (const p of data.results.properties) {
      const addr = [p.addressLine1, p.city, p.state]
        .filter(Boolean)
        .join(", ");
      out.push({
        group: "properties",
        href: `/portal/properties/${p.id}`,
        primary: p.name,
        secondary: addr || "No address",
      });
    }
    for (const c of data.results.conversations) {
      const name = c.capturedName || c.capturedEmail || "Conversation";
      out.push({
        group: "conversations",
        href: `/portal/conversations/${c.id}`,
        primary: name,
        secondary: `${c.messageCount} messages · ${humanize(c.status)}`,
      });
    }
    return out;
  }, [data]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      const item = flat[highlight];
      if (item) {
        setOpen(false);
        router.push(item.href);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        aria-label="Search (⌘K)"
      >
        <SearchIcon className="h-3.5 w-3.5" />
        <span>Search…</span>
        <kbd className="ml-2 inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <SearchIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search leads, visitors, properties, conversations…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {loading ? (
                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {q.trim().length < 2 ? (
                <p className="text-xs text-muted-foreground py-6 px-3 text-center">
                  Type at least two characters to search.
                </p>
              ) : flat.length === 0 && !loading ? (
                <p className="text-xs text-muted-foreground py-6 px-3 text-center">
                  No matches for &ldquo;{q}&rdquo;.
                </p>
              ) : (
                <ResultsList items={flat} highlight={highlight} setHighlight={setHighlight} onSelect={() => setOpen(false)} />
              )}
            </div>

            <div className="border-t border-border px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                <kbd className="font-mono">↑↓</kbd> navigate ·{" "}
                <kbd className="font-mono">↵</kbd> open
              </span>
              <span>
                <kbd className="font-mono">Esc</kbd> close
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ResultsList({
  items,
  highlight,
  setHighlight,
  onSelect,
}: {
  items: FlatItem[];
  highlight: number;
  setHighlight: (n: number) => void;
  onSelect: () => void;
}) {
  // Group consecutively by group label
  const groups: Array<{ label: string; icon: React.ReactNode; start: number; end: number }> = [];
  let cursor = 0;
  while (cursor < items.length) {
    const g = items[cursor].group;
    let end = cursor;
    while (end + 1 < items.length && items[end + 1].group === g) end++;
    groups.push({
      label: GROUP_LABEL[g],
      icon: GROUP_ICON[g],
      start: cursor,
      end,
    });
    cursor = end + 1;
  }

  return (
    <ul className="py-1">
      {groups.map((grp) => (
        <li key={grp.start}>
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            {grp.icon}
            <span>{grp.label}</span>
          </div>
          <ul>
            {items.slice(grp.start, grp.end + 1).map((item, idx) => {
              const flatIdx = grp.start + idx;
              const isActive = flatIdx === highlight;
              return (
                <li key={`${grp.start}-${flatIdx}`}>
                  <Link
                    href={item.href}
                    onClick={onSelect}
                    onMouseEnter={() => setHighlight(flatIdx)}
                    className={`flex items-center justify-between gap-3 px-3 py-2 ${isActive ? "bg-primary/10" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-foreground"}`}
                      >
                        {item.primary}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {item.secondary}
                      </p>
                    </div>
                    {isActive ? (
                      <span className="text-[10px] font-mono text-primary shrink-0">
                        ↵
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

const GROUP_LABEL = {
  leads: "Leads",
  visitors: "Visitors",
  properties: "Properties",
  conversations: "Conversations",
} as const;

const GROUP_ICON: Record<FlatItem["group"], React.ReactNode> = {
  leads: <Users className="h-3 w-3" />,
  visitors: <Eye className="h-3 w-3" />,
  properties: <Building2 className="h-3 w-3" />,
  conversations: <MessageSquare className="h-3 w-3" />,
};

function humanize(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
