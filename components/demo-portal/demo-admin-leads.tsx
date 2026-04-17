"use client";

import {
  Users,
  Phone,
  Mail,
  Trophy,
  Clock,
  Globe,
  UserPlus,
  Star,
  TrendingUp,
  CalendarDays,
  MessageSquare,
  FileText,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import type { ViewProps } from "./types";

// ── Types ────────────────────────────────────────────────────────────────

type LeadSource = "Website" | "Referral" | "Trade Show" | "Cold Outreach";

type Lead = {
  company: string;
  contact: string;
  title: string;
  source: LeadSource;
  monthlyValue: number;
  daysInStage: number;
  rep: string;
};

type Stage = {
  id: string;
  title: string;
  leads: Lead[];
};

type Activity = {
  icon: typeof Phone;
  text: string;
  timestamp: string;
};

// ── Static Data ─────────────────────────────────────────────────────────

const STAGES: Stage[] = [
  {
    id: "new",
    title: "New",
    leads: [
      { company: "Harbor Bistro", contact: "Elena Vasquez", title: "Owner", source: "Website", monthlyValue: 2400, daysInStage: 3, rep: "Sarah K." },
      { company: "Oakwood Provisions", contact: "Derek Tan", title: "Procurement Lead", source: "Trade Show", monthlyValue: 5100, daysInStage: 1, rep: "James M." },
      { company: "Lakeside Catering Co", contact: "Priya Sharma", title: "Director of Ops", source: "Cold Outreach", monthlyValue: 3200, daysInStage: 5, rep: "Sarah K." },
    ],
  },
  {
    id: "contacted",
    title: "Contacted",
    leads: [
      { company: "Mountain View Catering", contact: "Rachel Kim", title: "Head Chef", source: "Referral", monthlyValue: 4800, daysInStage: 7, rep: "James M." },
      { company: "Northside Deli", contact: "Marcus Johnson", title: "GM", source: "Website", monthlyValue: 1900, daysInStage: 4, rep: "Sarah K." },
    ],
  },
  {
    id: "qualified",
    title: "Qualified",
    leads: [
      { company: "Coastline Restaurants", contact: "Julia Park", title: "VP Purchasing", source: "Trade Show", monthlyValue: 8200, daysInStage: 12, rep: "James M." },
      { company: "Golden Plate Group", contact: "Tom Sullivan", title: "Owner", source: "Referral", monthlyValue: 6400, daysInStage: 9, rep: "Sarah K." },
    ],
  },
  {
    id: "won",
    title: "Won",
    leads: [
      { company: "Downtown Deli Co", contact: "Angela Torres", title: "Founder", source: "Referral", monthlyValue: 3600, daysInStage: 0, rep: "James M." },
    ],
  },
];

const ACTIVITIES: Activity[] = [
  { icon: Phone, text: "Called Harbor Bistro — scheduled tasting for Thursday", timestamp: "2h ago" },
  { icon: FileText, text: "Sent pricing proposal to Mountain View Catering", timestamp: "4h ago" },
  { icon: CheckCircle2, text: "Downtown Deli Co signed — first order placed", timestamp: "Yesterday" },
  { icon: Mail, text: "Follow-up email sent to Coastline Restaurants", timestamp: "Yesterday" },
  { icon: MessageSquare, text: "Oakwood Provisions requested product samples", timestamp: "2 days ago" },
  { icon: CalendarDays, text: "Demo scheduled with Golden Plate Group for next week", timestamp: "3 days ago" },
];

// ── Source Icon ──────────────────────────────────────────────────────────

function sourceIcon(source: LeadSource) {
  switch (source) {
    case "Website": return Globe;
    case "Referral": return Users;
    case "Trade Show": return Star;
    case "Cold Outreach": return Phone;
  }
}

// ── Stat Card ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  brandColor,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  brandColor: string;
}) {
  return (
    <div className="border border-shell bg-cream p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 flex items-center justify-center"
          style={{ backgroundColor: `${brandColor}12` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: brandColor }} />
        </div>
        <span className="text-[10px] uppercase tracking-wider font-mono text-sand">{label}</span>
      </div>
      <span className="font-serif text-xl font-bold text-ink">{value}</span>
    </div>
  );
}

// ── Lead Card ────────────────────────────────────────────────────────────

function LeadCard({ lead, brandColor }: { lead: Lead; brandColor: string }) {
  const SourceIcon = sourceIcon(lead.source);

  return (
    <div className="border border-shell bg-cream p-3 mb-2">
      {/* Company */}
      <p className="font-serif font-bold text-sm text-ink mb-1 truncate">{lead.company}</p>

      {/* Contact */}
      <p className="text-xs text-ink/70 mb-2 truncate">
        {lead.contact} <span className="text-sand">{lead.title}</span>
      </p>

      {/* Source + Value row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <SourceIcon className="w-3 h-3 text-sand" />
          <span className="font-mono text-[10px] text-sand">{lead.source}</span>
        </div>
        <span className="font-mono text-xs font-bold" style={{ color: brandColor }}>
          ${lead.monthlyValue.toLocaleString()}/mo
        </span>
      </div>

      {/* Footer: days + rep */}
      <div className="flex items-center justify-between text-[10px] font-mono text-sand pt-2 border-t border-shell">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{lead.daysInStage === 0 ? "Today" : `${lead.daysInStage}d`}</span>
        </div>
        <span>{lead.rep}</span>
      </div>
    </div>
  );
}

// ── Column Header ────────────────────────────────────────────────────────

function StageHeader({
  title,
  count,
  brandColor,
}: {
  title: string;
  count: number;
  brandColor: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-shell">
      <span className="font-serif font-bold text-sm text-ink">{title}</span>
      <span
        className="ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 min-w-[20px] text-center"
        style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
      >
        {count}
      </span>
    </div>
  );
}

// ── Activity Item ────────────────────────────────────────────────────────

function ActivityItem({
  activity,
  brandColor,
}: {
  activity: Activity;
  brandColor: string;
}) {
  const Icon = activity.icon;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-shell last:border-b-0">
      <div
        className="w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: `${brandColor}10` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: brandColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink leading-snug">{activity.text}</p>
        <span className="font-mono text-[10px] text-sand mt-0.5 block">{activity.timestamp}</span>
      </div>
    </div>
  );
}

// ── Main View ────────────────────────────────────────────────────────────

export function AdminLeadsView({ brand }: ViewProps) {
  const allLeads = STAGES.flatMap((s) => s.leads);
  const totalPipeline = allLeads.reduce((sum, l) => sum + l.monthlyValue, 0);
  const wonLeads = STAGES.find((s) => s.id === "won")?.leads ?? [];
  const conversionRate = allLeads.length > 0
    ? Math.round((wonLeads.length / allLeads.length) * 100)
    : 0;
  const avgDaysToClose = Math.round(
    allLeads.reduce((sum, l) => sum + l.daysInStage, 0) / allLeads.length
  );
  const newThisMonth = STAGES.find((s) => s.id === "new")?.leads.length ?? 0;

  return (
    <div className="p-4 sm:p-6 bg-cream">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase text-sand font-mono mb-1">
            Sales Pipeline
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-ink">
            Leads &amp; CRM
          </h2>
        </div>
        <button
          className="flex items-center gap-1.5 px-3 py-2 font-mono text-[10px] uppercase tracking-wide border transition-colors hover:opacity-80"
          style={{ borderColor: brand.color, color: brand.color, backgroundColor: `${brand.color}08` }}
        >
          <UserPlus className="w-3 h-3" />
          Add Lead
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={TrendingUp}
          label="Pipeline Value"
          value={`$${totalPipeline.toLocaleString()}/mo`}
          brandColor={brand.color}
        />
        <StatCard
          icon={Trophy}
          label="Conversion Rate"
          value={`${conversionRate}%`}
          brandColor={brand.color}
        />
        <StatCard
          icon={Clock}
          label="Avg Days to Close"
          value={`${avgDaysToClose}`}
          brandColor={brand.color}
        />
        <StatCard
          icon={UserPlus}
          label="New This Month"
          value={`${newThisMonth}`}
          brandColor={brand.color}
        />
      </div>

      {/* Pipeline Kanban */}
      <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-w-[640px]">
          {STAGES.map((stage) => (
            <div key={stage.id} className="border border-shell bg-cream p-3 min-h-[200px]">
              <StageHeader
                title={stage.title}
                count={stage.leads.length}
                brandColor={brand.color}
              />
              <div>
                {stage.leads.map((lead) => (
                  <LeadCard key={lead.company} lead={lead} brandColor={brand.color} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="border border-shell bg-cream p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-shell">
          <h3 className="font-serif text-lg font-bold text-ink">Recent Activity</h3>
          <button
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide transition-colors hover:opacity-80"
            style={{ color: brand.color }}
          >
            View All <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div>
          {ACTIVITIES.map((activity, i) => (
            <ActivityItem key={i} activity={activity} brandColor={brand.color} />
          ))}
        </div>
      </div>
    </div>
  );
}
