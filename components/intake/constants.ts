import type { IntakeModules, Step1Data, Step2Data, Step3Data, Step4Data } from "./types";

export const DRAFT_KEY = "leasestack.intake.v1";

export const STEPS = ["Company", "Portfolio", "Services", "Consultation"];

export const PROPERTY_TYPES = [
  { key: "RESIDENTIAL", label: "Residential" },
  { key: "COMMERCIAL", label: "Commercial" },
  { key: "MIXED", label: "Both" },
] as const;

export const RESIDENTIAL_SUBTYPES = [
  { key: "STUDENT_HOUSING", label: "Student Housing" },
  { key: "MULTIFAMILY", label: "Multifamily" },
  { key: "SENIOR_LIVING", label: "Senior Living" },
  { key: "SINGLE_FAMILY_RENTAL", label: "Single-Family Rentals" },
  { key: "CO_LIVING", label: "Co-Living" },
  { key: "SHORT_TERM_RENTAL", label: "Short-Term Rentals" },
] as const;

export const COMMERCIAL_SUBTYPES = [
  { key: "OFFICE", label: "Office" },
  { key: "RETAIL", label: "Retail" },
  { key: "INDUSTRIAL", label: "Industrial" },
  { key: "MIXED_USE", label: "Mixed Use" },
  { key: "FLEX_SPACE", label: "Flex Space" },
  { key: "MEDICAL_OFFICE", label: "Medical Office" },
] as const;

export const PAIN_POINTS = [
  "Current agency underperforms",
  "Site doesn't rank on Google",
  "Chatbot is useless",
  "Leads don't convert to tours",
  "Don't know which visitors are real prospects",
  "Ad spend feels wasted",
  "Too much manual follow-up",
  "No unified dashboard",
  "Other",
] as const;

export const MODULE_CATALOG: Array<{
  key: keyof IntakeModules;
  label: string;
  desc: string;
  priceHint: string;
  recommendedFor?: Array<"STUDENT_HOUSING" | "MULTIFAMILY" | "SENIOR_LIVING">;
}> = [
  {
    key: "website",
    label: "Marketing Website + Hosting",
    desc: "Custom-built site with live listings, served on your domain.",
    priceHint: "Core",
  },
  {
    key: "leadCapture",
    label: "Lead Capture & Forms",
    desc: "Exit-intent popups, inline forms, automated follow-up.",
    priceHint: "Core",
  },
  {
    key: "chatbot",
    label: "Proactive AI Chatbot",
    desc: "Fires within 5 seconds, captures leads 24/7, routes hot leads.",
    priceHint: "Add-on",
  },
  {
    key: "googleAds",
    label: "Google Ads Management",
    desc: "Geo-fenced campaigns, retargeting, creative included.",
    priceHint: "Managed",
  },
  {
    key: "metaAds",
    label: "Meta + Instagram Ads",
    desc: "Story and feed campaigns, retargeting, competitive tracking.",
    priceHint: "Managed",
  },
  {
    key: "seo",
    label: "SEO & AEO",
    desc: "Rank in Google, ChatGPT, Perplexity. Local + campus landing pages.",
    priceHint: "Add-on",
  },
  {
    key: "email",
    label: "Email Nurture Sequences",
    desc: "Automated drips per lead source: day 1, week 1, month 1, year 1.",
    priceHint: "Add-on",
  },
  {
    key: "outboundEmail",
    label: "Outbound Cold Email",
    desc: "Inbox purchase, warming, campaign management to external lists.",
    priceHint: "Add-on",
  },
  {
    key: "referrals",
    label: "Resident Referral Program",
    desc: "Track referrals + automate payouts for tenants who refer new leases.",
    priceHint: "Add-on",
  },
  {
    key: "creativeStudio",
    label: "Ad Creative Studio",
    desc: "On-demand creative requests for ads, stories, emails. Unlimited revisions.",
    priceHint: "Add-on",
  },
];

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const STEP1_DEFAULT: Step1Data = {
  companyName: "",
  shortName: "",
  websiteUrl: "",
  propertyType: "",
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactPhone: "",
  primaryContactRole: "",
  hqCity: "",
  hqState: "",
};

export const STEP2_DEFAULT: Step2Data = {
  numberOfProperties: null,
  currentBackendPlatform: "",
  backendPlanTier: "",
  currentVendor: "",
  currentMonthlySpend: null,
  biggestPainPoint: "",
};

export const STEP3_DEFAULT: Step3Data = {
  modules: {
    website: true,
    chatbot: false,
    googleAds: false,
    metaAds: false,
    seo: false,
    email: false,
    outboundEmail: false,
    referrals: false,
    creativeStudio: false,
    leadCapture: true,
  },
};

export const STEP4_DEFAULT: Step4Data = {
  goLiveTarget: "",
  tosAccepted: false,
};

// ---------------------------------------------------------------------------
// Draft persistence helpers (localStorage).
// ---------------------------------------------------------------------------

export type IntakeDraft = {
  step: number;
  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;
  savedAt: number;
};

export function loadDraft(): IntakeDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntakeDraft;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(draft: IntakeDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // quota or ssr, ignore
  }
}
