import type { LucideIcon } from "lucide-react";
import { MapPin, Sparkles, Users } from "lucide-react";

type Prop = {
  icon: LucideIcon;
  title: string;
  body: string;
};

export function ValueProps({ items }: { items?: Prop[] }) {
  const rows = items ?? DEFAULTS;
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-6 py-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {rows.map((p) => (
          <div key={p.title} className="flex flex-col gap-3">
            <p.icon
              className="w-6 h-6"
              aria-hidden="true"
              style={{ color: "var(--tenant-primary)" }}
            />
            <h3 className="font-serif text-lg font-bold">{p.title}</h3>
            <p className="text-sm opacity-70 leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const DEFAULTS: Prop[] = [
  {
    icon: MapPin,
    title: "Walking distance to everything",
    body: "A short walk to campus, coffee, groceries, and transit. Park the car.",
  },
  {
    icon: Sparkles,
    title: "Fully furnished, all-inclusive",
    body: "WiFi, utilities, cable, and weekly tidy-up included in your rent.",
  },
  {
    icon: Users,
    title: "Community and concierge",
    body: "Onsite managers, study lounges, and resident events built for student life.",
  },
];
