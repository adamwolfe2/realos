import React from "react";
import Link from "next/link";
import {
  BarChart3,
  Users,
  FileText,
  Search,
  Star,
  type LucideIcon,
} from "lucide-react";
import {
  AppFolioMark,
  GoogleMark,
  MetaMark,
  GA4Mark,
  SlackMark,
  CalcomMark,
  ChatGPTMark,
  PerplexityMark,
  ClaudeMark,
  GeminiMark,
} from "@/components/platform/artifacts/brand-logos";
import { SectionShell, LabelChip } from "./section-shell";

// ---------------------------------------------------------------------------
// SurfacesStrip — [04] Every surface, one login. Answers "how much product is
// actually here?" without bloating the page: one compact row of the real
// pages as mini frame cards (linking to /features), then a single static
// integration logo row (real repo brand marks, no fake screenshots, no deps)
// answering "will it work with the stack I already run?".
// ---------------------------------------------------------------------------

type Surface = { label: string; url: string; icon: LucideIcon };

const SURFACES: Surface[] = [
  { label: "Dashboard", url: "app.leasestack.co/portal", icon: BarChart3 },
  { label: "Leads", url: "app.leasestack.co/leads", icon: Users },
  { label: "Reports", url: "app.leasestack.co/reports", icon: FileText },
  { label: "SEO", url: "app.leasestack.co/seo", icon: Search },
  { label: "Reputation", url: "app.leasestack.co/reputation", icon: Star },
];

const INTEGRATIONS: Array<{ name: string; mark: React.ReactNode }> = [
  { name: "AppFolio", mark: <AppFolioMark size={38} /> },
  { name: "Google", mark: <GoogleMark size={38} /> },
  { name: "Meta", mark: <MetaMark size={38} /> },
  { name: "GA4", mark: <GA4Mark size={38} /> },
  { name: "Slack", mark: <SlackMark size={38} /> },
  { name: "Cal.com", mark: <CalcomMark size={38} /> },
  { name: "ChatGPT", mark: <ChatGPTMark size={38} /> },
  { name: "Perplexity", mark: <PerplexityMark size={38} /> },
  { name: "Claude", mark: <ClaudeMark size={38} /> },
  { name: "Gemini", mark: <GeminiMark size={38} /> },
];

function MiniSurface({ surface }: { surface: Surface }) {
  const Icon = surface.icon;
  return (
    <div
      className="group h-full transition-transform duration-200 group-hover:-translate-y-0.5"
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: 2,
        overflow: "hidden",
        backgroundColor: "#FFFFFF",
        boxShadow:
          "0 1px 2px rgba(22,22,22,0.05), 0 8px 16px -10px rgba(22,22,22,0.14)",
      }}
    >
      {/* chrome bar */}
      <div
        className="flex items-center gap-2 px-3"
        style={{
          height: 26,
          backgroundImage: "linear-gradient(180deg, #fafafa 0%, #f1f1f1 100%)",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <span className="flex items-center gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: "#e0e0e0" }}
            />
          ))}
        </span>
        <span
          className="truncate"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "#5a647d",
            letterSpacing: "0.02em",
          }}
        >
          {surface.label}
        </span>
      </div>
      {/* abstract face */}
      <div style={{ padding: 14, backgroundColor: "#fbfcfe", height: 96 }}>
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            backgroundColor: "rgba(15,98,254,0.10)",
            color: "#0f62fe",
          }}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden />
        </span>
        <div className="mt-3 space-y-1.5" aria-hidden>
          <div style={{ height: 5, width: "80%", borderRadius: 2, backgroundColor: "#e6ebf5" }} />
          <div style={{ height: 5, width: "55%", borderRadius: 2, backgroundColor: "#eef1f8" }} />
        </div>
        <div className="mt-3 flex items-end gap-1" aria-hidden style={{ height: 20 }}>
          {[10, 16, 8, 18, 12].map((h, i) => (
            <div
              key={i}
              style={{
                width: 6,
                height: h,
                borderRadius: 1,
                backgroundColor: i % 2 === 0 ? "#0f62fe" : "#a6c8ff",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SurfacesStrip() {
  return (
    <SectionShell bg="#FFFFFF">
      <div className="py-24 md:py-28">
        <div className="max-w-[720px]">
          <LabelChip>The product</LabelChip>
          <h2
            className="mt-4"
            style={{
              color: "#161616",
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(30px, 3.8vw, 46px)",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
            }}
          >
            Every surface. One login.
          </h2>
          <p
            className="mt-5"
            style={{
              color: "#6f6f6f",
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
              maxWidth: "560px",
            }}
          >
            Not six vendors and six dashboards. The whole operation lives on one
            platform your team logs into once.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 md:grid-cols-5 gap-4">
          {SURFACES.map((s) => (
            <Link key={s.label} href="/features" className="group block">
              <MiniSurface surface={s} />
            </Link>
          ))}
        </div>

        {/* Integration row (one static, centered row of real brand marks). */}
        <div
          className="mt-16 pt-12 text-center"
          style={{ borderTop: "1px solid #e0e0e0" }}
        >
          <p
            style={{
              color: "#161616",
              fontFamily: "var(--font-sans)",
              fontSize: "19px",
              fontWeight: 500,
              letterSpacing: "-0.015em",
            }}
          >
            Works with the PMS, ads, and reviews you already have.
          </p>
          <p
            className="mt-2"
            style={{
              color: "#6f6f6f",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              lineHeight: 1.6,
            }}
          >
            AppFolio, Google, Meta, and your reviews, synced continuously.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 md:gap-3.5">
            {INTEGRATIONS.map((it) => (
              <span
                key={it.name}
                className="inline-flex items-center justify-center"
                title={it.name}
                style={{
                  width: 76,
                  height: 76,
                  border: "1px solid #e0e0e0",
                  borderRadius: 2,
                  backgroundColor: "#FFFFFF",
                }}
              >
                {it.mark}
              </span>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
