// ---------------------------------------------------------------------------
// Mock data for the interactive product tour. All names, properties, cities,
// and numbers are GENERIC placeholders chosen to read believably without
// referencing any real customer, competitor, or location.
// ---------------------------------------------------------------------------

export type LeadStage = "new" | "contacted" | "tour" | "applied" | "signed";
export type LeadSource = "Form" | "Chat" | "Pixel" | "Referral" | "Paid";
export type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  unit: string;
  property: string;
  source: LeadSource;
  score: number;
  stage: LeadStage;
  createdAt: string;
  timeline: Array<{ kind: string; text: string; at: string }>;
};

export const LEADS: LeadRow[] = [
  {
    id: "L001",
    name: "Maya R.",
    email: "maya@example.com",
    phone: "(555) 201-4881",
    unit: "Studio",
    property: "Oak Grove Residences",
    source: "Chat",
    score: 92,
    stage: "tour",
    createdAt: "2h ago",
    timeline: [
      { kind: "visit",  text: "Landed on /floor-plans from paid social", at: "2h ago" },
      { kind: "chat",   text: "Asked about September availability",       at: "1h 58m ago" },
      { kind: "email",  text: "Captured email in conversation",           at: "1h 55m ago" },
      { kind: "tour",   text: "Tour booked for Saturday 10:30 AM",        at: "1h 50m ago" },
    ],
  },
  {
    id: "L002",
    name: "Daniel L.",
    email: "daniel@example.com",
    phone: "(555) 312-0091",
    unit: "1 Bedroom",
    property: "Oak Grove Residences",
    source: "Paid",
    score: 88,
    stage: "tour",
    createdAt: "4h ago",
    timeline: [
      { kind: "visit",  text: "Landed from Meta ad: Fall 2026 concept B",  at: "4h ago" },
      { kind: "form",   text: "Submitted contact form",                    at: "3h 55m ago" },
      { kind: "tour",   text: "Tour booked for Friday 3 PM",               at: "3h 50m ago" },
    ],
  },
  {
    id: "L003",
    name: "Sophie K.",
    email: "sophie@example.com",
    phone: "(555) 118-2203",
    unit: "2 Bedroom",
    property: "Harbor Point",
    source: "Referral",
    score: 94,
    stage: "applied",
    createdAt: "Yesterday",
    timeline: [
      { kind: "visit",   text: "Referred by current resident",              at: "Yesterday" },
      { kind: "form",    text: "Submitted application",                     at: "Yesterday" },
      { kind: "applied", text: "Documents uploaded, under review",          at: "Today" },
    ],
  },
  {
    id: "L004",
    name: "Jin H.",
    email: "jin@example.com",
    phone: "(555) 442-1167",
    unit: "Studio",
    property: "Oak Grove Residences",
    source: "Pixel",
    score: 74,
    stage: "new",
    createdAt: "30m ago",
    timeline: [
      { kind: "visit",  text: "Pixel resolved anonymous visitor",           at: "30m ago" },
      { kind: "nurture",text: "Welcome email queued",                       at: "29m ago" },
    ],
  },
  {
    id: "L005",
    name: "Arjun P.",
    email: "arjun@example.com",
    phone: "(555) 998-3320",
    unit: "2 Bedroom",
    property: "Harbor Point",
    source: "Chat",
    score: 81,
    stage: "contacted",
    createdAt: "6h ago",
    timeline: [
      { kind: "visit",  text: "Returning visitor, 3rd session this week",   at: "6h ago" },
      { kind: "chat",   text: "Asked about pet policy",                     at: "6h ago" },
      { kind: "email",  text: "Follow-up email sent",                       at: "5h ago" },
    ],
  },
  {
    id: "L006",
    name: "Noelle D.",
    email: "noelle@example.com",
    phone: "(555) 775-0124",
    unit: "1 Bedroom",
    property: "The Meridian",
    source: "Form",
    score: 77,
    stage: "new",
    createdAt: "45m ago",
    timeline: [
      { kind: "visit",  text: "Direct visit to /floor-plans",               at: "45m ago" },
      { kind: "form",   text: "Submitted tour request",                     at: "44m ago" },
    ],
  },
  {
    id: "L007",
    name: "Marcus T.",
    email: "marcus@example.com",
    phone: "(555) 402-9812",
    unit: "Studio",
    property: "Riverside Apartments",
    source: "Paid",
    score: 68,
    stage: "contacted",
    createdAt: "Yesterday",
    timeline: [
      { kind: "visit",  text: "Google ad, keyword: 'studio near campus'",   at: "Yesterday" },
      { kind: "form",   text: "Submitted contact form",                     at: "Yesterday" },
      { kind: "email",  text: "Auto-nurture day 1 sent",                    at: "Today" },
    ],
  },
  {
    id: "L008",
    name: "Priya V.",
    email: "priya@example.com",
    phone: "(555) 881-3344",
    unit: "2 Bedroom",
    property: "Oak Grove Residences",
    source: "Chat",
    score: 85,
    stage: "signed",
    createdAt: "3 days ago",
    timeline: [
      { kind: "chat",    text: "Captured via chatbot on /amenities",        at: "3 days ago" },
      { kind: "tour",    text: "Toured Saturday 11 AM",                     at: "2 days ago" },
      { kind: "applied", text: "Submitted application",                     at: "Yesterday" },
      { kind: "signed",  text: "Lease signed",                              at: "Today" },
    ],
  },
  {
    id: "L009",
    name: "Luis R.",
    email: "luis@example.com",
    phone: "(555) 212-7781",
    unit: "1 Bedroom",
    property: "The Meridian",
    source: "Pixel",
    score: 62,
    stage: "new",
    createdAt: "1h ago",
    timeline: [
      { kind: "visit",  text: "Pixel resolved from Oakland IP",             at: "1h ago" },
    ],
  },
  {
    id: "L010",
    name: "Ella C.",
    email: "ella@example.com",
    phone: "(555) 606-2001",
    unit: "Studio",
    property: "Riverside Apartments",
    source: "Referral",
    score: 89,
    stage: "applied",
    createdAt: "Yesterday",
    timeline: [
      { kind: "form",    text: "Referral form submitted by resident",       at: "Yesterday" },
      { kind: "applied", text: "Applied immediately",                        at: "Yesterday" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export type Conversation = {
  id: string;
  visitor: string;
  preview: string;
  property: string;
  capturedEmail: boolean;
  unread: boolean;
  updatedAt: string;
  messages: Array<{ from: "user" | "bot"; text: string }>;
};

export const CONVERSATIONS: Conversation[] = [
  {
    id: "C001",
    visitor: "Maya R.",
    preview: "Picked 10:30 AM Saturday. What's the best email to send...",
    property: "Oak Grove Residences",
    capturedEmail: true,
    unread: false,
    updatedAt: "2m",
    messages: [
      { from: "user", text: "Do you have a studio for September?" },
      { from: "bot",  text: "Yes, three studios open September 1 at $1,995, fully furnished. Want to tour?" },
      { from: "user", text: "Saturday morning?" },
      { from: "bot",  text: "Picked 10:30 AM Saturday. What's the best email to send the confirmation to?" },
      { from: "user", text: "maya@example.com" },
      { from: "bot",  text: "Perfect. Confirmation on the way. See you Saturday." },
    ],
  },
  {
    id: "C002",
    visitor: "Anonymous, New Jersey",
    preview: "How close is the nearest grocery store?",
    property: "Harbor Point",
    capturedEmail: false,
    unread: true,
    updatedAt: "14m",
    messages: [
      { from: "user", text: "How close is the nearest grocery store?" },
      { from: "bot",  text: "A full grocery is 4 minutes walking. Smaller markets are across the street. Want me to show the neighborhood map?" },
    ],
  },
  {
    id: "C003",
    visitor: "Arjun P.",
    preview: "Yeah two pets, both cats, both under 15lbs.",
    property: "Harbor Point",
    capturedEmail: true,
    unread: false,
    updatedAt: "1h",
    messages: [
      { from: "user", text: "Do you allow pets?" },
      { from: "bot",  text: "Yes, up to two pets under 40lbs combined, no restricted breeds. $50/mo per pet." },
      { from: "user", text: "Yeah two pets, both cats, both under 15lbs." },
      { from: "bot",  text: "You're all set. Want to apply now or book a tour first?" },
    ],
  },
  {
    id: "C004",
    visitor: "Jordan F.",
    preview: "What's the earliest I can move in?",
    property: "Oak Grove Residences",
    capturedEmail: true,
    unread: true,
    updatedAt: "3h",
    messages: [
      { from: "user", text: "What's the earliest I can move in?" },
      { from: "bot",  text: "Earliest move-in for a 1-bedroom is August 20. For a studio, July 12. Which works?" },
    ],
  },
  {
    id: "C005",
    visitor: "Anonymous, Austin",
    preview: "Is there parking?",
    property: "Riverside Apartments",
    capturedEmail: false,
    unread: false,
    updatedAt: "5h",
    messages: [
      { from: "user", text: "Is there parking?" },
      { from: "bot",  text: "Yes, covered garage parking is $75/mo. Street parking is free after 6 PM." },
    ],
  },
  {
    id: "C006",
    visitor: "Sophie K.",
    preview: "Can I lock in the unit before touring?",
    property: "Harbor Point",
    capturedEmail: true,
    unread: false,
    updatedAt: "Yesterday",
    messages: [
      { from: "user", text: "Can I lock in the unit before touring?" },
      { from: "bot",  text: "You can submit a holding deposit to reserve. It's refundable within 48 hours. Want the link?" },
      { from: "user", text: "Yes please" },
      { from: "bot",  text: "Sent to sophie@example.com. Our team will follow up today." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

export type Property = {
  id: string;
  name: string;
  location: string;
  units: number;
  occupancyPct: number;
  leadsThisWeek: number;
  revenue: string;
  status: "Live" | "Onboarding" | "Paused";
};

export const PROPERTIES: Property[] = [
  {
    id: "P001",
    name: "Oak Grove Residences",
    location: "Sample City, Region",
    units: 86,
    occupancyPct: 94,
    leadsThisWeek: 38,
    revenue: "$182k",
    status: "Live",
  },
  {
    id: "P002",
    name: "Harbor Point",
    location: "Sample City, Region",
    units: 144,
    occupancyPct: 91,
    leadsThisWeek: 52,
    revenue: "$244k",
    status: "Live",
  },
  {
    id: "P003",
    name: "The Meridian",
    location: "Sample City, Region",
    units: 62,
    occupancyPct: 88,
    leadsThisWeek: 24,
    revenue: "$108k",
    status: "Live",
  },
  {
    id: "P004",
    name: "Riverside Apartments",
    location: "Sample City, Region",
    units: 120,
    occupancyPct: 0,
    leadsThisWeek: 0,
    revenue: "—",
    status: "Onboarding",
  },
];

// ---------------------------------------------------------------------------
// Creative requests
// ---------------------------------------------------------------------------

export type CreativeStatus = "Draft" | "In review" | "Filming" | "Shipped";
export type CreativeRequest = {
  id: string;
  title: string;
  type: string;
  status: CreativeStatus;
  assignee: string;
  eta: string;
  updatedAt: string;
};

export const CREATIVE_REQUESTS: CreativeRequest[] = [
  { id: "CR1", title: "Fall 2026 Meta ad set, 3x concepts",  type: "Meta ad set",   status: "In review", assignee: "Alex",  eta: "Today",     updatedAt: "2h ago" },
  { id: "CR2", title: "New hero photo + CTA swap",           type: "Landing block", status: "Shipped",   assignee: "Dani",  eta: "Yesterday", updatedAt: "Yesterday" },
  { id: "CR3", title: "Room tour, 15s TikTok cut",           type: "TikTok spark",  status: "Filming",   assignee: "Rei",   eta: "Thursday",  updatedAt: "6h ago" },
  { id: "CR4", title: "Auto-triggered welcome email",        type: "Email",         status: "Shipped",   assignee: "Sam",   eta: "Monday",    updatedAt: "3d ago" },
  { id: "CR5", title: "SMS nurture, day 3 check-in",         type: "SMS",           status: "Draft",     assignee: "Alex",  eta: "Next week", updatedAt: "Today" },
  { id: "CR6", title: "Google Performance Max refresh",      type: "Google ad set", status: "In review", assignee: "Dani",  eta: "Friday",    updatedAt: "1d ago" },
  { id: "CR7", title: "Parents-of-applicants email flow",    type: "Email",         status: "Draft",     assignee: "Sam",   eta: "Next week", updatedAt: "Today" },
];

// ---------------------------------------------------------------------------
// Ad campaigns (per-channel)
// ---------------------------------------------------------------------------

export type AdChannel = {
  id: string;
  name: string;
  sub: string;
  status: "Live" | "Ramping" | "Paused";
  budget: number;
  spent: number;
  impressions: string;
  clicks: number;
  ctr: string;
  leads: number;
  cpa: string;
};

export const AD_CHANNELS: AdChannel[] = [
  {
    id: "meta",
    name: "Meta",
    sub: "Instagram + Facebook",
    status: "Live",
    budget: 1800,
    spent: 742,
    impressions: "48.2k",
    clicks: 612,
    ctr: "1.27%",
    leads: 38,
    cpa: "$19.52",
  },
  {
    id: "google",
    name: "Google",
    sub: "Search + Performance Max",
    status: "Live",
    budget: 1400,
    spent: 812,
    impressions: "6.3k",
    clicks: 204,
    ctr: "3.24%",
    leads: 22,
    cpa: "$36.91",
  },
  {
    id: "tiktok",
    name: "TikTok",
    sub: "Spark + In-feed",
    status: "Ramping",
    budget: 600,
    spent: 110,
    impressions: "22.8k",
    clicks: 188,
    ctr: "0.82%",
    leads: 6,
    cpa: "$18.33",
  },
];

// ---------------------------------------------------------------------------
// Weekly report bar chart
// ---------------------------------------------------------------------------

export const WEEK_BARS = [
  { d: "Mon", meta: 18, google: 12, tiktok: 6 },
  { d: "Tue", meta: 22, google: 15, tiktok: 8 },
  { d: "Wed", meta: 28, google: 18, tiktok: 10 },
  { d: "Thu", meta: 34, google: 20, tiktok: 14 },
  { d: "Fri", meta: 30, google: 24, tiktok: 12 },
  { d: "Sat", meta: 26, google: 14, tiktok: 18 },
  { d: "Sun", meta: 20, google: 10, tiktok: 16 },
];

// ---------------------------------------------------------------------------
// Activity feed (dashboard)
// ---------------------------------------------------------------------------

export type ActivityItem = {
  kind: "lead" | "chat" | "creative" | "ad" | "tour" | "signed";
  text: string;
  at: string;
};

export const ACTIVITY: ActivityItem[] = [
  { kind: "signed",   text: "Priya V. signed a lease at Oak Grove, 2BR", at: "12m ago" },
  { kind: "tour",     text: "Maya R. booked a tour at Oak Grove, 10:30 AM Sat", at: "1h ago" },
  { kind: "lead",     text: "Daniel L. from Meta ad, score 88", at: "2h ago" },
  { kind: "creative", text: "Landing block 'new hero photo' shipped", at: "3h ago" },
  { kind: "chat",     text: "Chatbot captured a lead on /amenities", at: "4h ago" },
  { kind: "ad",       text: "Google Performance Max spent $812 this week", at: "6h ago" },
];
