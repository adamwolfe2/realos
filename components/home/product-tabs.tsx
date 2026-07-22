"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useInView,
  useReducedMotion,
} from "framer-motion";
import {
  BarChart3,
  MessageSquare,
  Star,
  Fingerprint,
  CheckCircle2,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react";
import { AttributionBreakdown } from "@/components/platform/artifacts/attribution-breakdown";
import { VisitorStream } from "@/components/platform/artifacts/visitor-stream";
import { ChatDemo } from "@/components/platform/artifacts/chat-demo";
import { ReputationFeed } from "@/components/platform/artifacts/reputation-feed";
import { LabelChip } from "./section-shell";
import { VignetteCard } from "./vignette-card";

// ---------------------------------------------------------------------------
// ProductTabs — the tabbed product switcher (juicebox layer J2). Replaces the
// three stacked pillar rows with a mono tab strip over a saturated brand
// panel that swaps per tab. Keeps the pillar content, vignette compositions,
// and motion-pass mini-scenes (which replay on tab activation + first view).
//
// A11y: real tablist semantics (roles, aria-selected/controls, arrow-key +
// Home/End navigation). Tabs deep-link to #attribution / #ai-leasing /
// #reputation. Mobile: tab strip scroll-snaps; the colour panel stacks above
// the text column. Reduced-motion: no slide/typewriter, content static.
// ---------------------------------------------------------------------------

type Vignette = {
  icon: LucideIcon;
  title: string;
  meta: string;
  typed?: string;
};

type Tab = {
  id: string;
  tab: string;
  icon: LucideIcon;
  artifact: React.ComponentType;
  vignette: Vignette;
  chip: string;
  headline: string;
  body: string;
  linkLabel: string;
  href: string;
};

const TABS: Tab[] = [
  {
    id: "attribution",
    tab: "Attribution",
    icon: BarChart3,
    artifact: AttributionBreakdown,
    vignette: {
      icon: CheckCircle2,
      title: "Lead signed",
      meta: "Priya V. · Google Ads, $68 CPL",
    },
    chip: "Capture to lease",
    headline: "Every dollar of ad spend, tracked to a signed lease.",
    body: "Google and Meta spend mapped to leases, not impressions. Blended cost per lease and campaign ROI, continuously.",
    linkLabel: "See it live",
    href: "/features/ads",
  },
  {
    id: "visitor-pixel",
    tab: "Visitor pixel",
    icon: Fingerprint,
    artifact: VisitorStream,
    vignette: {
      icon: Fingerprint,
      title: "Visitor identified",
      meta: "Anonymous, now Priya V.",
    },
    chip: "No form needed",
    headline: "Names on the traffic that never fills a form.",
    body: "A meaningful share of your anonymous visitors, resolved to a name and email in real time, routed to your CRM and audiences.",
    linkLabel: "See the pixel firing",
    href: "/features/pixel",
  },
  {
    id: "ai-leasing",
    tab: "AI leasing",
    icon: MessageSquare,
    artifact: ChatDemo,
    vignette: {
      icon: CalendarCheck,
      title: "Tour confirmed",
      meta: "Sat 11:00 AM · Unit 402",
      typed: "Booked. Confirmation sent.",
    },
    chip: "After hours",
    headline: "An AI assistant that books tours at 2am.",
    body: "Trained on your property, brand, and units. Books tours, sends floor plans, captures contacts. Hot leads reach your team by morning.",
    linkLabel: "Try a conversation",
    href: "/features/chatbot",
  },
  {
    id: "reputation",
    tab: "Reputation & SEO",
    icon: Star,
    artifact: ReputationFeed,
    vignette: {
      icon: MessageSquare,
      title: "Reply posted",
      meta: "Google review · 5 stars",
    },
    chip: "Every site",
    headline: "Your reputation and AI-search visibility, watched.",
    body: "Google, Reddit, Yelp, and the open web in one feed, sentiment-classified. Plus the property pages AI search actually cites.",
    linkLabel: "See a live audit",
    href: "/audit",
  },
];

const HATCH =
  "repeating-linear-gradient(45deg, #eef1f8 0, #eef1f8 1px, transparent 1px, transparent 7px)";
const PANEL_TEXTURE =
  "repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0, rgba(255,255,255,0.14) 1px, transparent 1px, transparent 9px)";

function Typewriter({ text, play }: { text: string; play: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);

  useEffect(() => {
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;
    if (reduce || isMobile) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [text, play, reduce]);

  return (
    <span
      className="mt-1 inline-block"
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        color: "#0f62fe",
        fontWeight: 500,
      }}
    >
      {text.slice(0, n)}
    </span>
  );
}

export function ProductTabs() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const seen = useInView(sectionRef, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [nonce, setNonce] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Deep-link: read hash on mount, keep it in sync on select.
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    const idx = TABS.findIndex((t) => t.id === h);
    if (idx >= 0) setActive(idx);
  }, []);

  const select = useCallback((idx: number, focus = false) => {
    setActive(idx);
    setNonce((n) => n + 1);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${TABS[idx].id}`);
    }
    if (focus) tabRefs.current[idx]?.focus();
  }, []);

  // Replay the mini-scene when the section first enters view.
  useEffect(() => {
    if (seen) setNonce((n) => n + 1);
  }, [seen]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next = active;
    if (e.key === "ArrowRight") next = (active + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (active - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    select(next, true);
  };

  const t = TABS[active];
  const Artifact = t.artifact;
  const slide = reduce ? 0 : 8;

  return (
    <div ref={sectionRef}>
      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Product capabilities"
        onKeyDown={onKeyDown}
        className="flex overflow-x-auto md:overflow-visible"
        style={{
          backgroundImage: HATCH,
          border: "1px solid #e0e0e0",
          borderRadius: 2,
          scrollSnapType: "x mandatory",
        }}
      >
        {TABS.map((tb, i) => {
          const on = i === active;
          const Icon = tb.icon;
          return (
            <button
              key={tb.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`tab-${tb.id}`}
              aria-selected={on}
              aria-controls={`panel-${tb.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => select(i)}
              className="relative flex items-center gap-2 flex-shrink-0"
              style={{
                scrollSnapAlign: "start",
                padding: "14px 20px",
                backgroundColor: on ? "#FFFFFF" : "transparent",
                cursor: "pointer",
                borderRight: i < TABS.length - 1 ? "1px solid #e0e0e0" : "none",
              }}
            >
              {on ? (
                <span
                  aria-hidden
                  className="absolute left-0 right-0 top-0"
                  style={{ height: 2, backgroundColor: "#0f62fe" }}
                />
              ) : null}
              <Icon
                className="w-4 h-4"
                strokeWidth={1.8}
                aria-hidden
                style={{ color: on ? "#0f62fe" : "#8d8d8d" }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: on ? "#161616" : "#6f7a94",
                  fontWeight: on ? 600 : 500,
                }}
              >
                {tb.tab}
              </span>
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="mt-6 md:mt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={t.id}
            id={`panel-${t.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${t.id}`}
            initial={reduce ? false : { opacity: 0, x: slide }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -slide }}
            transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
            className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-8 lg:gap-12 items-center"
          >
            {/* Left: saturated brand panel with floating vignette composition */}
            <div
              className="relative overflow-hidden"
              style={{
                backgroundColor: "#0f62fe",
                backgroundImage: PANEL_TEXTURE,
                borderRadius: 4,
                minHeight: 380,
                padding: "28px",
              }}
            >
              <motion.div
                key={`art-${nonce}`}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
                className="relative"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 6,
                  maxHeight: 340,
                  overflow: "hidden",
                  boxShadow:
                    "0 1px 2px rgba(22,22,22,0.08), 0 24px 48px -20px rgba(10,30,80,0.45)",
                }}
              >
                <Artifact />
              </motion.div>

              <VignetteCard
                icon={t.vignette.icon}
                title={t.vignette.title}
                meta={t.vignette.meta}
                play={nonce}
                className="absolute right-4 bottom-4 w-[248px] max-w-[74%]"
              >
                {t.vignette.typed ? (
                  <Typewriter text={t.vignette.typed} play={nonce} />
                ) : null}
              </VignetteCard>
            </div>

            {/* Right: label chip, headline, body, link */}
            <div>
              <LabelChip>{t.chip}</LabelChip>
              <h3
                className="mt-4"
                style={{
                  color: "#161616",
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(26px, 2.8vw, 32px)",
                  fontWeight: 500,
                  lineHeight: 1.15,
                  letterSpacing: "-0.02em",
                }}
              >
                {t.headline}
              </h3>
              <p
                className="mt-4"
                style={{
                  color: "#6f6f6f",
                  fontFamily: "var(--font-sans)",
                  fontSize: 17,
                  lineHeight: 1.6,
                  maxWidth: 460,
                }}
              >
                {t.body}
              </p>
              <Link
                href={t.href}
                className="mt-5 inline-flex items-center gap-1.5 group"
                style={{
                  color: "#0f62fe",
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                  fontWeight: 500,
                }}
              >
                {t.linkLabel}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="transition-transform group-hover:translate-x-1"
                  aria-hidden
                >
                  <path
                    d="M3 7h7m0 0L7 4m3 3L7 10"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
