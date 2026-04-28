"use client";

import React, { useEffect, useState } from "react";

type SyncEvent = {
  id: number;
  segment: string;
  reach: string;
  destination: string;
  destinationKind: "meta" | "google" | "webhook" | "csv";
  ago: string;
};

const POOL: Omit<SyncEvent, "id" | "ago">[] = [
  { segment: "Active Home Buyers, Bay Area",       reach: "1.8M", destination: "Meta Ads",            destinationKind: "meta"    },
  { segment: "Refinance Intent, California",       reach: "612K", destination: "Webhook to HubSpot",  destinationKind: "webhook" },
  { segment: "First Time Buyers, Texas",           reach: "942K", destination: "CSV download",        destinationKind: "csv"     },
  { segment: "Investment Property Searchers",      reach: "284K", destination: "Google Customer Match", destinationKind: "google"},
  { segment: "Remote Worker Relocators, Sun Belt", reach: "421K", destination: "Meta Ads",            destinationKind: "meta"    },
  { segment: "Luxury Buyers, $3M plus",            reach: "84K",  destination: "Webhook to Salesforce",destinationKind: "webhook"},
  { segment: "Commercial Office Lease Intent",     reach: "156K", destination: "Google Customer Match", destinationKind: "google"},
  { segment: "Senior Living Decision Makers",      reach: "198K", destination: "CSV download",        destinationKind: "csv"     },
];

const ACCENT = "#2563EB";
const INK = "#141413";
const MUTED = "#87867f";
const BORDER = "#f0eee6";
const PARCHMENT = "#faf9f5";

export function AudienceSyncStream() {
  const [rows, setRows] = useState<SyncEvent[]>(() =>
    POOL.slice(0, 5).map((p, i) => ({
      ...p,
      id: i,
      ago: `${(i + 1) * 3}m`,
    })),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRows((prev) => {
        const nextIdx = (prev[0].id + 1) % POOL.length;
        const source = POOL[nextIdx];
        const fresh: SyncEvent = {
          ...source,
          id: prev[0].id + 1,
          ago: "just now",
        };
        const aged = prev.map((r, i) => ({
          ...r,
          ago:
            i === 0 ? "2m" : i === 1 ? "5m" : i === 2 ? "9m" : i === 3 ? "14m" : "21m",
        }));
        return [fresh, ...aged].slice(0, 5);
      });
    }, 4200);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        backgroundColor: PARCHMENT,
        borderRadius: "12px",
        boxShadow: "0 0 0 1px " + BORDER + ", 0 24px 60px -30px rgba(20,20,19,0.18)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid " + BORDER,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: ACCENT,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "999px",
                backgroundColor: "#10b981",
                boxShadow: "0 0 0 4px rgba(16,185,129,0.18)",
              }}
            />
            Live syncs
          </span>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: MUTED,
          }}
        >
          last 24h
        </span>
      </header>

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {rows.map((r, i) => (
          <li
            key={r.id}
            style={{
              padding: "14px 18px",
              borderBottom: i === rows.length - 1 ? "none" : "1px solid " + BORDER,
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              backgroundColor: i === 0 ? "rgba(37,99,235,0.04)" : "transparent",
              transition: "background-color 600ms ease",
            }}
          >
            <DestinationIcon kind={r.destinationKind} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    color: INK,
                    fontFamily: "var(--font-sans)",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  {r.segment}
                </span>
                <span
                  style={{
                    color: ACCENT,
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  {r.reach}
                </span>
              </div>
              <div
                style={{
                  marginTop: "3px",
                  color: MUTED,
                  fontFamily: "var(--font-sans)",
                  fontSize: "12.5px",
                }}
              >
                Pushed to {r.destination}
              </div>
            </div>
            <span
              style={{
                color: MUTED,
                fontFamily: "var(--font-mono)",
                fontSize: "10.5px",
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
                paddingTop: "2px",
              }}
            >
              {r.ago}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DestinationIcon({ kind }: { kind: SyncEvent["destinationKind"] }) {
  const bg =
    kind === "meta"
      ? "rgba(37,99,235,0.10)"
      : kind === "google"
        ? "rgba(37,99,235,0.10)"
        : kind === "webhook"
          ? "rgba(37,99,235,0.10)"
          : "rgba(37,99,235,0.10)";
  const stroke = ACCENT;
  return (
    <span
      aria-hidden
      style={{
        width: "30px",
        height: "30px",
        borderRadius: "8px",
        backgroundColor: bg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: "2px",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {kind === "meta" || kind === "google" ? (
          <>
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </>
        ) : kind === "webhook" ? (
          <>
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="12" cy="6" r="3" />
            <line x1="9" y1="11" x2="7" y2="16" />
            <line x1="15" y1="11" x2="17" y2="16" />
          </>
        ) : (
          <>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </>
        )}
      </svg>
    </span>
  );
}
