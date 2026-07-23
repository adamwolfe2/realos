import React from "react";
import {
  Gauge,
  LayoutDashboard,
  Users,
  Eye,
  MessageSquare,
  Megaphone,
  Search,
  Building2,
  Settings,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Walkthrough shell + primitives — static marketing replicas of the REAL
// LeaseStack portal chrome (round-2 redirect). Source of truth: the live
// portal (app/portal/layout.tsx sidebar via components/portal/portal-nav.tsx,
// PageHeader chrome, KpiTile, Carbon tokens: white cards, #e0e0e0 hairlines,
// 2px radius, #0f62fe primary, mono eyebrows). Seeded demo data only, no
// fetching. Portal files are read-only reference.
// ---------------------------------------------------------------------------

export const INK = "#161616";
export const MUTED = "#6f6f6f";
export const FAINT = "#8d8d8d";
export const BORDER = "#e0e0e0";
export const BRAND = "#0f62fe";
export const APP_BG = "#f7f8fa";
export const UP = "#24a148";
export const DOWN = "#da1e28";

type NavItem = { label: string; icon: LucideIcon; badge?: number };

// Matches the curated portal sidebar in Adam's briefing screenshot.
export const SIDEBAR: NavItem[] = [
  { label: "Briefing", icon: Gauge },
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Leads", icon: Users, badge: 42 },
  { label: "Visitors", icon: Eye, badge: 312 },
  { label: "Chatbot", icon: MessageSquare, badge: 6 },
  { label: "Campaigns", icon: Megaphone },
  { label: "SEO", icon: Search },
  { label: "Properties", icon: Building2, badge: 4 },
  { label: "Settings", icon: Settings },
];

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: FAINT,
      }}
    >
      {children}
    </p>
  );
}

export function WCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: "#FFFFFF",
        border: `1px solid ${BORDER}`,
        borderRadius: 2,
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Delta({ value, dir }: { value: string; dir: "up" | "down" }) {
  const c = dir === "up" ? UP : DOWN;
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 600,
        color: c,
        backgroundColor: dir === "up" ? "rgba(36,161,72,0.10)" : "rgba(218,30,40,0.10)",
        borderRadius: 999,
        padding: "1px 7px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {dir === "up" ? "▲" : "▼"} {value}
    </span>
  );
}

export function ScoreChip({ score }: { score: number }) {
  const hot = score >= 80;
  const warm = score >= 60 && score < 80;
  const c = hot ? BRAND : warm ? "#0043ce" : FAINT;
  const bg = hot ? "rgba(15,98,254,0.10)" : warm ? "rgba(0,67,206,0.08)" : "rgba(141,141,141,0.10)";
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 600,
        color: c,
        backgroundColor: bg,
        borderRadius: 2,
        padding: "1px 6px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {score}
    </span>
  );
}

// The portal shell: full-height sidebar + a topbar over the content pane.
export function WalkthroughShell({
  active,
  children,
}: {
  active: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", height: 560, backgroundColor: APP_BG }}>
      {/* Sidebar */}
      <aside
        className="hidden sm:flex"
        style={{
          width: 200,
          flexShrink: 0,
          backgroundColor: "#FFFFFF",
          borderRight: `1px solid ${BORDER}`,
          flexDirection: "column",
          padding: "12px 10px",
        }}
      >
        <div className="flex items-center gap-2 px-2 pb-3 mb-1" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <img src="/logos/leasestack-wordmark.png" alt="LeaseStack" style={{ height: 18, width: "auto" }} />
        </div>
        <nav className="flex flex-col gap-0.5 mt-2">
          {SIDEBAR.map((item, i) => {
            const on = i === active;
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="relative flex items-center gap-2.5"
                style={{
                  padding: "7px 10px",
                  borderRadius: 2,
                  backgroundColor: on ? "rgba(15,98,254,0.08)" : "transparent",
                  transition: "background-color 300ms ease",
                }}
              >
                {on ? (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 6,
                      bottom: 6,
                      width: 2,
                      borderRadius: 2,
                      backgroundColor: BRAND,
                    }}
                  />
                ) : null}
                <Icon
                  className="w-4 h-4"
                  strokeWidth={1.8}
                  style={{ color: on ? BRAND : "#8d8d8d", flexShrink: 0 }}
                  aria-hidden
                />
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    fontWeight: on ? 600 : 500,
                    color: on ? INK : "#525252",
                    flex: 1,
                    transition: "color 300ms ease",
                  }}
                >
                  {item.label}
                </span>
                {item.badge ? (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      fontWeight: 600,
                      color: on ? BRAND : "#8d8d8d",
                      backgroundColor: on ? "rgba(15,98,254,0.12)" : "#f0f1f4",
                      borderRadius: 999,
                      padding: "0px 6px",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main: topbar + content */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div
          className="flex items-center gap-3"
          style={{
            height: 46,
            flexShrink: 0,
            padding: "0 16px",
            backgroundColor: "#FFFFFF",
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 600,
              color: INK,
            }}
          >
            Sample Portfolio
          </span>
          <span style={{ width: 1, height: 16, backgroundColor: BORDER }} />
          <div
            className="hidden md:flex items-center gap-2 flex-1"
            style={{
              maxWidth: 300,
              height: 28,
              padding: "0 10px",
              backgroundColor: APP_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: 2,
            }}
          >
            <Search className="w-3.5 h-3.5" style={{ color: "#8d8d8d" }} aria-hidden />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#8d8d8d" }}>
              Search leads, properties, transcripts
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            {/* Truth rule: demo numbers are always labeled as sample. */}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#8d8d8d",
                border: `1px solid ${BORDER}`,
                borderRadius: 2,
                padding: "2px 6px",
                whiteSpace: "nowrap",
              }}
            >
              Sample data
            </span>
            <span
              className="inline-flex items-center justify-center"
              style={{ width: 26, height: 26, borderRadius: 999, backgroundColor: "#eef1f8", color: BRAND, fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600 }}
            >
              SP
            </span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}
