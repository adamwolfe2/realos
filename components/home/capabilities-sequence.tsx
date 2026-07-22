"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
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
// CapabilitiesSequence — the four capabilities as STACKED sequential scroll
// parts (round-2 QA item 6), replacing the tabbed switcher. Every capability
// is visible; each part alternates the saturated blue panel / text sides and
// animates in on scroll, its vignette mini-scene playing on first view. Deep-
// link anchors (#attribution etc.) point at each part. Reduced-motion renders
// everything static.
// ---------------------------------------------------------------------------

type Vignette = { icon: LucideIcon; title: string; meta: string; typed?: string };

type Cap = {
  id: string;
  icon: LucideIcon;
  artifact: React.ComponentType;
  vignette: Vignette;
  chip: string;
  headline: string;
  body: string;
  linkLabel: string;
  href: string;
};

const CAPS: Cap[] = [
  {
    id: "attribution",
    icon: BarChart3,
    artifact: AttributionBreakdown,
    vignette: { icon: CheckCircle2, title: "New lease signed", meta: "Google Ads · $68 CPL" },
    chip: "Capture to lease",
    headline: "Every dollar of ad spend, tracked to a signed lease.",
    body: "Google and Meta spend mapped to leases, not impressions. Blended cost per lease and campaign ROI, continuously.",
    linkLabel: "See it live",
    href: "/features/ads",
  },
  {
    id: "visitor-pixel",
    icon: Fingerprint,
    artifact: VisitorStream,
    vignette: { icon: Fingerprint, title: "Visitor identified", meta: "Anonymous, now identified" },
    chip: "No form needed",
    headline: "Names on the traffic that never fills a form.",
    body: "A meaningful share of your anonymous visitors, resolved to a name and email in real time, routed to your CRM and audiences.",
    linkLabel: "See the pixel firing",
    href: "/features/pixel",
  },
  {
    id: "ai-leasing",
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
    icon: Star,
    artifact: ReputationFeed,
    vignette: { icon: MessageSquare, title: "Reply posted", meta: "Google review · 5 stars" },
    chip: "Every site",
    headline: "Your reputation and AI-search visibility, watched.",
    body: "Google, Reddit, Yelp, and the open web in one feed, sentiment-classified. Plus the property pages AI search actually cites.",
    linkLabel: "See a live audit",
    href: "/audit",
  },
];

const PANEL_TEXTURE =
  "repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0, rgba(255,255,255,0.14) 1px, transparent 1px, transparent 9px)";

function Typewriter({ text, play }: { text: string; play: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    const isMobile =
      typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
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
      style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#0f62fe", fontWeight: 500 }}
    >
      {text.slice(0, n)}
    </span>
  );
}

function CapabilityPart({ cap, index }: { cap: Cap; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  const reduce = useReducedMotion();
  const [play, setPlay] = useState(0);
  useEffect(() => {
    if (inView) setPlay((p) => p + 1);
  }, [inView]);

  const Artifact = cap.artifact;
  const panelLeft = index % 2 === 0;

  return (
    <div
      id={cap.id}
      ref={ref}
      style={{ scrollMarginTop: 96 }}
      className="py-14 md:py-20 grid grid-cols-1 lg:grid-cols-[55%_45%] gap-8 lg:gap-12 items-center"
    >
      {/* Saturated brand panel with floating vignette composition */}
      <motion.div
        className={panelLeft ? "lg:order-1" : "lg:order-2"}
        initial={reduce ? false : { opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px 0px -15% 0px" }}
        transition={reduce ? { duration: 0 } : { duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <div
          className="relative overflow-hidden"
          style={{
            backgroundColor: "#0f62fe",
            backgroundImage: PANEL_TEXTURE,
            borderRadius: 4,
            minHeight: 360,
            padding: 28,
          }}
        >
          <div
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
          </div>

          <VignetteCard
            icon={cap.vignette.icon}
            title={cap.vignette.title}
            meta={cap.vignette.meta}
            play={play}
            className="absolute right-4 bottom-4 w-[248px] max-w-[74%]"
          >
            {cap.vignette.typed ? <Typewriter text={cap.vignette.typed} play={play} /> : null}
          </VignetteCard>
        </div>
      </motion.div>

      {/* Text column */}
      <motion.div
        className={panelLeft ? "lg:order-2" : "lg:order-1"}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px 0px -15% 0px" }}
        transition={
          reduce ? { duration: 0 } : { duration: 0.5, delay: 0.1, ease: [0.2, 0.7, 0.2, 1] }
        }
      >
        <LabelChip>{cap.chip}</LabelChip>
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
          {cap.headline}
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
          {cap.body}
        </p>
        <Link
          href={cap.href}
          className="mt-5 inline-flex items-center gap-1.5 group"
          style={{ color: "#0f62fe", fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500 }}
        >
          {cap.linkLabel}
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
      </motion.div>
    </div>
  );
}

export function CapabilitiesSequence() {
  return (
    <div className="mt-8 md:mt-10 divide-y divide-[#eef1f8]">
      {CAPS.map((cap, i) => (
        <CapabilityPart key={cap.id} cap={cap} index={i} />
      ))}
    </div>
  );
}
