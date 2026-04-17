"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Globe,
  Loader2,
  CheckCircle2,
  Palette,
  Image,
  Building2,
  ExternalLink,
  ShoppingBag,
  Layers,
  Package,
  Users,
  MessageSquare,
} from "lucide-react";

type ScrapeResult = {
  companyName: string;
  companyDescription: string;
  industry: string;
  tagline: string;
  valuePropositions: string[];
  yearFounded: string;
  location: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  domain: string;
  phone: string;
  email: string;
  address: string;
  socialLinks: { instagram: string; facebook: string; linkedin: string; twitter: string };
  products: Array<{
    name: string;
    description: string;
    price: string;
    category: string;
    imageUrl: string;
    unit: string;
    featured: boolean;
  }>;
  businessType: string;
  hasWholesale: boolean;
  deliveryInfo: string;
  paymentInfo: string;
  minimumOrder: string;
  testimonials: Array<{ quote: string; author: string; company: string }>;
  clientLogos: string[];
  certifications: string[];
  heroHeadline: string;
  heroSubheadline: string;
  ctaText: string;
  aboutSnippet: string;
};

type Phase = "input" | "scanning" | "result";

const SCAN_STEPS = [
  { label: "Crawling your website", icon: Globe },
  { label: "Extracting brand identity", icon: Palette },
  { label: "Finding your logo & assets", icon: Image },
  { label: "Discovering your products", icon: ShoppingBag },
  { label: "Analyzing business signals", icon: Building2 },
  { label: "Building your custom portal", icon: Layers },
];

// Slow interval = one step every 4s. Fast interval (after API returns) = 400ms
const SLOW_INTERVAL = 4000;
const FAST_INTERVAL = 400;

const WAITING_MESSAGES = [
  "Go grab a coffee",
  "Take a stretch break",
  "Go grab some fresh air",
  "Email your co-worker back!",
  "Go grab a quick snack",
  "Quality takes time...",
  "Almost there...",
];

export function DemoLauncher() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [scanStep, setScanStep] = useState(0);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState("");
  const [waitingMsg, setWaitingMsg] = useState(0);
  const apiDone = useRef(false);
  const resultRef = useRef<ScrapeResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Advance scan steps — slow until API returns, then fast
  useEffect(() => {
    if (phase !== "scanning") return;

    const advance = () => {
      setScanStep((prev) => {
        const next = prev + 1;
        if (next > SCAN_STEPS.length) {
          // All steps done — if API is also done, show result
          if (apiDone.current && resultRef.current) {
            setTimeout(() => setPhase("result"), 600);
            if (timerRef.current) clearInterval(timerRef.current);
            return prev;
          }
          return prev; // Stay at max, waiting messages will show
        }
        return next;
      });
    };

    // Start with slow interval
    timerRef.current = setInterval(advance, SLOW_INTERVAL);
    // Advance the first step immediately
    advance();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // When API finishes, speed up remaining steps
  const onApiComplete = useCallback((data: ScrapeResult) => {
    apiDone.current = true;
    resultRef.current = data;
    setResult(data);

    // Clear slow timer, use fast timer for remaining steps
    if (timerRef.current) clearInterval(timerRef.current);

    setScanStep((current) => {
      if (current >= SCAN_STEPS.length) {
        // Steps already done, go to result
        setTimeout(() => setPhase("result"), 600);
        return current;
      }

      // Speed through remaining steps
      let stepCount = current;
      const fastTimer = setInterval(() => {
        stepCount++;
        setScanStep(stepCount);
        if (stepCount >= SCAN_STEPS.length) {
          clearInterval(fastTimer);
          setTimeout(() => setPhase("result"), 600);
        }
      }, FAST_INTERVAL);
      timerRef.current = fastTimer;

      return current;
    });
  }, []);

  // Rotate waiting messages when all steps are done but API isn't
  useEffect(() => {
    if (phase !== "scanning" || scanStep < SCAN_STEPS.length || apiDone.current) return;
    const msgTimer = setInterval(() => {
      setWaitingMsg((prev) => (prev + 1) % WAITING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(msgTimer);
  }, [phase, scanStep]);

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setPhase("scanning");
    setScanStep(0);
    setError("");
    setWaitingMsg(0);
    apiDone.current = false;
    resultRef.current = null;

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) throw new Error("Scrape failed");

      const data: ScrapeResult = await res.json();
      onApiComplete(data);
    } catch {
      if (timerRef.current) clearInterval(timerRef.current);
      setError("Could not analyze that website. Please check the URL and try again.");
      setPhase("input");
    }
  };

  const launchDemo = () => {
    if (!result) return;
    sessionStorage.setItem("portal-demo-data", JSON.stringify(result));
    const params = new URLSearchParams({
      company: result.companyName,
      logo: result.logoUrl,
      color: (result.primaryColor || "#1A1A1A").replace("#", ""),
      domain: result.domain,
    });
    window.open(`/demo?${params.toString()}`, "_blank");
  };

  const reset = () => {
    setPhase("input");
    setResult(null);
    setScanStep(0);
    setUrl("");
    apiDone.current = false;
    resultRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const allStepsDone = scanStep >= SCAN_STEPS.length;
  const showWaiting = allStepsDone && !apiDone.current;

  return (
    <div
      className="relative border bg-white"
      style={{ borderColor: "var(--border-strong)", borderRadius: "8px", overflow: "hidden" }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {/* ── Input Phase ────────────────────────────────────────── */}
        {phase === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-8"
          >
            <div
              className="font-mono text-[9px] uppercase tracking-widest mb-3"
              style={{ color: "var(--text-muted)" }}
            >
              Try it with your brand
            </div>
            <h3 className="font-serif text-2xl font-normal mb-2" style={{ color: "var(--text-headline)" }}>
              Enter your website. See your portal in 30 seconds.
            </h3>
            <p className="font-mono text-xs mb-6" style={{ color: "var(--text-body)" }}>
              We&apos;ll scrape your site, extract your logo and brand colors,
              and spin up a personalized demo portal with sample data — so you
              can experience exactly what your clients will see.
            </p>

            {error && (
              <div className="font-mono text-xs text-red-600 mb-4 px-3 py-2 border border-red-200 bg-red-50" style={{ borderRadius: "6px" }}>
                {error}
              </div>
            )}

            <div className="flex gap-0">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="yourcompany.com"
                  className="w-full border pl-10 pr-4 py-4 font-mono text-sm bg-white focus:outline-none"
                  style={{
                    borderColor: "var(--border-strong)",
                    borderRight: "none",
                    borderRadius: "6px 0 0 6px",
                    color: "var(--text-headline)",
                  }}
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={!url.trim()}
                className="text-white px-6 py-4 font-mono text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 flex-shrink-0"
                style={{
                  backgroundColor: "var(--blue)",
                  borderRadius: "0 6px 6px 0",
                }}
              >
                Launch Demo <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="font-mono text-[9px] mt-2" style={{ color: "var(--text-muted)" }}>
              No signup required. Your data is not stored.
            </div>
          </motion.div>
        )}

        {/* ── Scanning Phase ─────────────────────────────────────── */}
        {phase === "scanning" && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--blue)" }} />
              <div>
                <div className="font-mono text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--text-headline)" }}>
                  Analyzing {url}
                </div>
                <div className="font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>
                  Extracting your brand DNA — this takes a moment
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {SCAN_STEPS.map((step, i) => {
                const done = i < scanStep;
                const active = i === scanStep - 1 && !done && scanStep <= SCAN_STEPS.length;
                const pending = i >= scanStep;
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.label}
                    animate={{ opacity: done ? 1 : active ? 0.7 : pending ? 0.25 : 0.25 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-center justify-between px-4 py-3 border bg-white"
                    style={{ borderColor: done ? "var(--blue-light, #E8EDFA)" : "var(--border)", borderRadius: "4px" }}
                  >
                    <div className="flex items-center gap-3">
                      {done ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 340,
                            damping: 20,
                          }}
                        >
                          <CheckCircle2 className="w-4 h-4" style={{ color: "var(--blue)" }} />
                        </motion.div>
                      ) : i === scanStep ? (
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-muted)" }} />
                      ) : (
                        <Icon className="w-4 h-4" style={{ color: "var(--border-strong)" }} />
                      )}
                      <span className="font-mono text-xs" style={{ color: done ? "var(--text-headline)" : "var(--text-muted)" }}>{step.label}</span>
                    </div>
                    {done && (
                      <motion.span
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="font-mono text-[9px] font-semibold"
                        style={{ color: "var(--blue)" }}
                      >
                        Done
                      </motion.span>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-[3px]" style={{ backgroundColor: "var(--border)" }}>
              <div
                className="h-full transition-all duration-700 ease-out"
                style={{
                  backgroundColor: "var(--blue)",
                  width: `${Math.min((scanStep / SCAN_STEPS.length) * 100, 100)}%`,
                }}
              />
            </div>

            {/* Waiting message — shows when all steps done but API still running */}
            <AnimatePresence mode="wait">
              {showWaiting && (
                <motion.div
                  key={waitingMsg}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className="mt-5 text-center"
                >
                  <p className="font-mono text-xs" style={{ color: "var(--text-body)" }}>
                    {WAITING_MESSAGES[waitingMsg]}
                  </p>
                  <p className="font-mono text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>
                    We&apos;re scanning multiple pages to get the best results
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Result Phase ───────────────────────────────────────── */}
        {phase === "result" && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-8"
          >
            <div className="flex items-center gap-2 mb-6">
              <CheckCircle2 className="w-5 h-5" style={{ color: "var(--blue)" }} />
              <span className="font-mono text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--text-headline)" }}>
                Your demo portal is ready
              </span>
            </div>

            {/* Brand preview */}
            <div
              className="border p-6 mb-6"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", borderRadius: "6px" }}
            >
              <div className="font-mono text-[9px] uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
                Extracted Brand Profile
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                    Company
                  </div>
                  <div className="font-mono text-sm font-semibold" style={{ color: "var(--text-headline)" }}>
                    {result.companyName}
                  </div>
                  {result.industry && (
                    <div className="font-mono text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {result.industry}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                    Logo
                  </div>
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.logoUrl}
                      alt={result.companyName}
                      className="w-8 h-8 object-contain border"
                      style={{ borderColor: "var(--border)" }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <span className="font-mono text-[9px]" style={{ color: "var(--text-muted)" }}>
                      Extracted
                    </span>
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                    Brand Colors
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-7 h-7 border"
                      style={{ borderColor: "var(--border-strong)", backgroundColor: result.primaryColor || "#1A1A1A" }}
                    />
                    {result.secondaryColor && (
                      <div
                        className="w-7 h-7 border"
                        style={{ borderColor: "var(--border)", backgroundColor: result.secondaryColor }}
                      />
                    )}
                    {result.accentColor && (
                      <div
                        className="w-7 h-7 border"
                        style={{ borderColor: "var(--border)", backgroundColor: result.accentColor }}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                    Products Found
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" style={{ color: "var(--blue)" }} />
                    <span className="font-mono text-sm font-semibold" style={{ color: "var(--text-headline)" }}>
                      {result.products?.length || 0}
                    </span>
                  </div>
                </div>
              </div>
              {result.companyDescription && (
                <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="font-mono text-[10px] line-clamp-2" style={{ color: "var(--text-body)" }}>
                    {result.companyDescription}
                  </div>
                </div>
              )}
            </div>

            {/* What the demo includes */}
            <div
              className="border p-4 mb-6"
              style={{ borderColor: "var(--border)", borderRadius: "6px" }}
            >
              <div className="font-mono text-[9px] uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                Your custom portal includes
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { icon: Package, label: `${result.products?.length || 0} products loaded` },
                  { icon: Users, label: "Client portal + dashboard" },
                  { icon: ShoppingBag, label: "Order management" },
                  { icon: Layers, label: "Full admin panel + CRM" },
                  { icon: MessageSquare, label: "SMS/iMessage ordering" },
                  { icon: Building2, label: "Invoicing & analytics" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <item.icon className="w-3 h-3 flex-shrink-0" style={{ color: "var(--blue)" }} />
                    <span className="font-mono text-[10px]" style={{ color: "var(--text-body)" }}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch + Reset buttons */}
            <div className="flex gap-3">
              <button
                onClick={launchDemo}
                className="flex-1 flex items-center justify-center gap-2 text-white px-6 py-4 font-mono text-[13px] font-semibold transition-colors"
                style={{ backgroundColor: "var(--blue)", borderRadius: "6px" }}
              >
                Open Your Demo Portal{" "}
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={reset}
                className="px-4 py-4 font-mono text-xs uppercase tracking-wide border transition-colors"
                style={{
                  color: "var(--text-body)",
                  borderColor: "var(--border)",
                  borderRadius: "6px",
                }}
              >
                Try Another
              </button>
            </div>
            <div className="font-mono text-[9px] mt-2" style={{ color: "var(--text-muted)" }}>
              Demo opens in a new tab with your branding applied to real
              platform features
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
