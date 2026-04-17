"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  ArrowRight,
  Database,
  Lock,
  Globe,
  ShoppingCart,
  LayoutDashboard,
  MessageSquare,
  CreditCard,
  Truck,
} from "lucide-react";

/* ─── Phase config ──────────────────────────────────────────────────────── */
const PHASES = [
  { id: 0, label: "Configure" },
  { id: 1, label: "Build" },
  { id: 2, label: "Integrate" },
  { id: 3, label: "Launch" },
];
const PHASE_MS = [5200, 7200, 6000, 5800];

/* ─── Timer progress bar ─────────────────────────────────────────────────── */
function PhaseBar({
  phase,
  duration,
  onComplete,
}: {
  phase: number;
  duration: number;
  onComplete: () => void;
}) {
  const [pct, setPct] = useState(0);
  const start = useRef(Date.now());
  const raf = useRef<number | null>(null);
  useEffect(() => {
    start.current = Date.now();
    setPct(0);
    const tick = () => {
      const p = Math.min((Date.now() - start.current) / duration, 1);
      setPct(p * 100);
      if (p >= 1) onComplete();
      else raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, duration]);
  return (
    <div className="h-[3px] w-full" style={{ backgroundColor: "var(--border)" }}>
      <div className="h-full" style={{ backgroundColor: "var(--blue)", width: `${pct}%` }} />
    </div>
  );
}

/* ─── Phase 0: Configure ─────────────────────────────────────────────────── */
const CONFIG_FIELDS = [
  { label: "Company", value: "Pacific Seafood Co.", field: "company.name" },
  { label: "Domain", value: "pacificseafood.com", field: "company.domain" },
  { label: "Primary Color", value: "#1B4F72", field: "branding.primary" },
  { label: "Categories", value: "4 product categories", field: "catalog.categories" },
  { label: "Tax Rate", value: "8.75%", field: "pricing.defaultTaxRate" },
  { label: "Net Terms", value: "Net 30 / Net 60", field: "pricing.netTermOptions" },
  { label: "Tier Thresholds", value: "$5K → REPEAT, $50K → VIP", field: "tiers.*" },
  { label: "Features", value: "SMS, Loyalty, Referrals", field: "integrations.*" },
];

function ConfigurePhase() {
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    const timers = CONFIG_FIELDS.map((_, i) =>
      setTimeout(() => setRevealed(i + 1), (i + 1) * 520)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-muted)" }}>
            Step 01 · Configure
          </div>
          <div className="font-serif text-lg" style={{ color: "var(--text-headline)" }}>Setting up portal.config.ts</div>
        </div>
        <div className="text-right flex-shrink-0">
          <motion.div
            key={revealed}
            initial={{ scale: 1.18 }}
            animate={{ scale: 1 }}
            className="font-mono text-2xl font-bold leading-none"
            style={{ color: "var(--text-headline)" }}
          >
            {revealed}/{CONFIG_FIELDS.length}
          </motion.div>
          <div className="font-mono text-[9px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            fields set
          </div>
        </div>
      </div>

      <div className="space-y-1.5 flex-1">
        {CONFIG_FIELDS.map((cfg, i) => {
          const done = i < revealed;
          const active = i === revealed;
          return (
            <motion.div
              key={cfg.label}
              animate={{ opacity: done ? 1 : active ? 0.5 : 0.2 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-between px-3 py-2 border bg-white"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                {done ? (
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: "var(--blue)" }} />
                ) : active ? (
                  <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                ) : (
                  <div className="w-3 h-3 border flex-shrink-0" style={{ borderColor: "var(--border)" }} />
                )}
                <span className="font-mono text-[10px]" style={{ color: "var(--text-headline)" }}>{cfg.label}</span>
              </div>
              <AnimatePresence>
                {done && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2"
                  >
                    <span className="font-mono text-[9px] truncate max-w-[120px]" style={{ color: "var(--text-body)" }}>
                      {cfg.value}
                    </span>
                    <span className="font-mono text-[8px]" style={{ color: "var(--text-muted)" }}>
                      {cfg.field}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {revealed >= CONFIG_FIELDS.length && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-3 flex items-center gap-2 px-3 py-2.5 text-white font-mono text-[10px]"
            style={{ backgroundColor: "var(--blue)" }}
          >
            <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
            <span>
              Config complete — {CONFIG_FIELDS.length} fields populated from
              intake form
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Phase 1: Build ──────────────────────────────────────────────────── */
const BUILD_PHASES = [
  { name: "Database Schema", desc: "39 models, 10 enums", icon: Database },
  { name: "Auth & Roles", desc: "Clerk, 5 role types", icon: Lock },
  { name: "Marketing Site", desc: "17 pages, SEO", icon: Globe },
  { name: "Checkout Flow", desc: "Cart → Stripe → order", icon: ShoppingCart },
  { name: "Client Portal", desc: "14 pages, dashboard", icon: LayoutDashboard },
  { name: "Admin Panel", desc: "25+ pages, CRM", icon: LayoutDashboard },
  { name: "SMS Ordering", desc: "AI parse → draft → confirm", icon: MessageSquare },
  { name: "Billing Engine", desc: "Invoices, Net-30/60/90", icon: CreditCard },
  { name: "Shipping", desc: "Tracking, cold chain", icon: Truck },
];

function BuildPhase() {
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    const timers = BUILD_PHASES.map((_, i) =>
      setTimeout(() => setRevealed(i + 1), (i + 1) * 620)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-muted)" }}>
            Step 02 · Build
          </div>
          <div className="font-serif text-lg" style={{ color: "var(--text-headline)" }}>Assembling your portal</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-mono text-[9px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>
            progress
          </div>
          <motion.div
            key={revealed}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className="font-mono text-xl font-bold leading-none"
            style={{ color: "var(--text-headline)" }}
          >
            {Math.round((revealed / BUILD_PHASES.length) * 100)}%
          </motion.div>
        </div>
      </div>

      <div className="h-[3px] mb-4" style={{ backgroundColor: "var(--border)" }}>
        <motion.div
          className="h-full"
          style={{ backgroundColor: "var(--blue)" }}
          animate={{ width: `${(revealed / BUILD_PHASES.length) * 100}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      </div>

      <div className="space-y-1.5 flex-1">
        {BUILD_PHASES.map((phase, i) => {
          const done = i < revealed;
          const active = i === revealed;
          const Icon = phase.icon;
          return (
            <motion.div
              key={phase.name}
              animate={{ opacity: done ? 1 : active ? 0.6 : 0.2 }}
              className="flex items-center justify-between px-3 py-2 border bg-white"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                {done ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 340, damping: 20 }}
                  >
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: "var(--blue)" }} />
                  </motion.div>
                ) : active ? (
                  <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                ) : (
                  <Icon className="w-3 h-3 flex-shrink-0" style={{ color: "var(--border-strong)" }} />
                )}
                <span className="font-mono text-[10px] font-semibold" style={{ color: "var(--text-headline)" }}>
                  {phase.name}
                </span>
              </div>
              {done && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-mono text-[9px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {phase.desc}
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {revealed >= BUILD_PHASES.length && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-3 px-3 py-2.5 text-white font-mono text-[10px] flex items-center gap-2"
            style={{ backgroundColor: "var(--blue)" }}
          >
            <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
            <span>
              Portal build complete — 200+ API routes, 60+ pages deployed
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Phase 2: Integrate ──────────────────────────────────────────────── */
const INTEGRATIONS = [
  {
    name: "Stripe",
    domain: "stripe.com",
    status: "Connected",
    detail: "Checkout, invoices, Net-30 billing",
  },
  {
    name: "Clerk",
    domain: "clerk.com",
    status: "Connected",
    detail: "Auth, role-based access, webhooks",
  },
  {
    name: "Resend",
    domain: "resend.com",
    status: "Connected",
    detail: "20+ email templates branded",
  },
  {
    name: "Bloo.io",
    domain: "bloo.io",
    status: "Connected",
    detail: "SMS ordering, iMessage confirmations",
  },
  {
    name: "Neon",
    domain: "neon.tech",
    status: "Connected",
    detail: "Serverless Postgres, 39 tables",
  },
  {
    name: "Vercel",
    domain: "vercel.com",
    status: "Connected",
    detail: "Edge deployment, cron jobs, analytics",
  },
];

function IntegratePhase() {
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    const timers = INTEGRATIONS.map((_, i) =>
      setTimeout(() => setRevealed(i + 1), (i + 1) * 780)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-muted)" }}>
            Step 03 · Integrate
          </div>
          <div className="font-serif text-lg" style={{ color: "var(--text-headline)" }}>Connecting your services</div>
        </div>
        {revealed < INTEGRATIONS.length ? (
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5"
                style={{ backgroundColor: "var(--blue)" }}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.22,
                }}
              />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--blue)" }} />
            <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--text-headline)" }}>
              All live
            </span>
          </motion.div>
        )}
      </div>

      <div className="space-y-2 flex-1">
        {INTEGRATIONS.map((integration, i) => {
          const done = i < revealed;
          const active = i === revealed;
          return (
            <motion.div
              key={integration.name}
              animate={{ opacity: done ? 1 : active ? 0.5 : 0.2 }}
              className="border bg-white"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://www.google.com/s2/favicons?domain=${integration.domain}&sz=32`}
                  alt=""
                  width={14}
                  height={14}
                  className="w-3.5 h-3.5 flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <span className="font-mono text-[11px] font-semibold" style={{ color: "var(--text-headline)" }}>
                  {integration.name}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {done ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1.5"
                    >
                      <span className="font-mono text-[9px]" style={{ color: "var(--text-body)" }}>
                        {integration.detail}
                      </span>
                      <span
                        className="font-mono text-[9px] font-bold px-1.5 py-0.5"
                        style={{ backgroundColor: "var(--blue-light)", color: "var(--blue)" }}
                      >
                        {integration.status}
                      </span>
                    </motion.div>
                  ) : active ? (
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: "var(--text-muted)" }} />
                  ) : null}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {revealed >= INTEGRATIONS.length && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-3 px-3 py-2.5 text-white font-mono text-[10px] flex items-center gap-2"
            style={{ backgroundColor: "var(--blue)" }}
          >
            <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
            <span>
              {INTEGRATIONS.length} integrations live — webhooks configured,
              keys verified
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Phase 3: Launch ───────────────────────────────────────────────────── */
const LAUNCH_STEPS = [
  {
    period: "Day 1",
    label: "Go Live",
    tasks: [
      "Custom domain configured and SSL provisioned",
      "Production database seeded with full product catalog",
      "All webhooks verified (Clerk, Stripe, Bloo.io)",
    ],
  },
  {
    period: "Day 2–3",
    label: "Onboard",
    tasks: [
      "Admin team trained on portal management",
      "First 10 wholesale clients invited via email",
      "SMS ordering activated for top accounts",
    ],
  },
  {
    period: "Week 2+",
    label: "Scale",
    tasks: [
      "Automated billing reminders reducing AR days",
      "Client health scoring identifies at-risk accounts",
      "Standing orders generating recurring revenue",
    ],
  },
];

function LaunchPhase() {
  const total = LAUNCH_STEPS.reduce((s, b) => s + b.tasks.length, 0);
  const [taskRevealed, setTaskRevealed] = useState(0);
  useEffect(() => {
    const timers = Array.from({ length: total }, (_, i) =>
      setTimeout(() => setTaskRevealed(i + 1), (i + 1) * 500)
    );
    return () => timers.forEach(clearTimeout);
  }, [total]);

  return (
    <div className="h-full flex flex-col p-5">
      <div className="mb-3">
        <div className="font-mono text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-muted)" }}>
          Step 04 · Launch
        </div>
        <div className="font-serif text-lg" style={{ color: "var(--text-headline)" }}>Your portal goes live</div>
      </div>

      <div className="space-y-2 flex-1">
        {LAUNCH_STEPS.map((block, bi) => {
          const tasksBefore = LAUNCH_STEPS.slice(0, bi).reduce(
            (s, b) => s + b.tasks.length,
            0
          );
          const blockShown = Math.max(
            0,
            Math.min(taskRevealed - tasksBefore, block.tasks.length)
          );
          const blockActive = bi === 0 || taskRevealed > tasksBefore;
          return (
            <motion.div
              key={block.period}
              animate={{ opacity: blockActive ? 1 : 0.25 }}
              className="border overflow-hidden"
              style={{ borderColor: "var(--border-strong)" }}
            >
              <div
                className="flex items-center gap-3 px-3 py-1.5 border-b"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-white)" }}
              >
                <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  {block.period}
                </span>
                <span className="font-mono text-[11px] font-bold" style={{ color: "var(--text-headline)" }}>
                  {block.label}
                </span>
                {blockShown >= block.tasks.length && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="ml-auto"
                  >
                    <CheckCircle2 className="w-3 h-3" style={{ color: "var(--blue)" }} />
                  </motion.div>
                )}
              </div>
              <div className="px-3 py-2 bg-white space-y-1.5">
                {block.tasks.map((task, ti) => {
                  const shown = ti < blockShown;
                  return (
                    <motion.div
                      key={task}
                      animate={{ opacity: shown ? 1 : 0.15 }}
                      className="flex items-center gap-2"
                    >
                      {shown ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 340,
                            damping: 20,
                          }}
                        >
                          <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: "var(--blue)" }} />
                        </motion.div>
                      ) : (
                        <div className="w-3 h-3 border flex-shrink-0" style={{ borderColor: "var(--border)" }} />
                      )}
                      <span className="font-mono text-[10px] leading-snug" style={{ color: "var(--text-body)" }}>
                        {task}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {taskRevealed >= total && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 px-3 py-2.5 border bg-white flex items-center justify-between"
            style={{ borderColor: "var(--border-strong)" }}
          >
            <div>
              <div className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Result
              </div>
              <div className="font-serif text-base" style={{ color: "var(--text-headline)" }}>
                Fully operational B2B portal · your brand
              </div>
            </div>
            <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--blue)" }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main export ────────────────────────────────────────────────────────── */
export function BuildDemo() {
  const [phase, setPhase] = useState(0);
  const phaseRef = useRef(0);

  const advance = useCallback(() => {
    const next = (phaseRef.current + 1) % PHASES.length;
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const jumpTo = (p: number) => {
    phaseRef.current = p;
    setPhase(p);
  };

  return (
    <div className="relative w-full">
      {/* Phase tabs */}
      <div className="flex overflow-hidden" style={{ border: "1px solid var(--border-strong)", borderBottom: "none" }}>
        {PHASES.map((p, i) => (
          <button
            key={p.id}
            onClick={() => jumpTo(i)}
            className="flex-1 px-2 py-2.5 font-mono text-[10px] uppercase tracking-wide transition-colors"
            style={{
              borderRight: i < PHASES.length - 1 ? "1px solid var(--border-strong)" : "none",
              backgroundColor: phase === i ? "var(--blue)" : "var(--bg-white)",
              color: phase === i ? "white" : "var(--text-muted)",
            }}
          >
            <span className="block font-mono text-[8px] mb-0.5 tracking-widest" style={{ opacity: 0.4 }}>
              0{i + 1}
            </span>
            {p.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div
        className="relative h-[480px] overflow-hidden"
        style={{
          border: "1px solid var(--border-strong)",
          borderTop: "none",
          backgroundColor: "var(--bg-white)",
          boxShadow: "0 4px 24px rgba(15, 21, 35, 0.08)",
          borderRadius: "0",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0"
          >
            {phase === 0 && <ConfigurePhase />}
            {phase === 1 && <BuildPhase />}
            {phase === 2 && <IntegratePhase />}
            {phase === 3 && <LaunchPhase />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <PhaseBar
        key={phase}
        phase={phase}
        duration={PHASE_MS[phase]}
        onComplete={advance}
      />

      {/* Live indicator */}
      <div className="mt-2 flex items-center gap-1.5">
        <motion.div
          className="w-1.5 h-1.5 flex-shrink-0"
          style={{ backgroundColor: "var(--blue)" }}
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
        <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Live demo — auto-advances · click any tab to jump
        </span>
      </div>
    </div>
  );
}
