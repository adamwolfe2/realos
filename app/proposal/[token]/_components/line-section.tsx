import { cadenceLabel, formatCents } from "../_lib/format";

// ---------------------------------------------------------------------------
// Visual components for the proposal share page body: the grouped line-item
// list (recurring / one-time) and the summary card row helpers. Server
// components — pure presentation, no client state.
// ---------------------------------------------------------------------------

export function LineSection({
  title,
  lines,
  currency,
  cadence,
}: {
  title: string;
  lines: ReadonlyArray<{
    id: string;
    label: string;
    description: string | null;
    unitPriceCents: number;
    quantity: number;
  }>;
  currency: string;
  cadence: "MONTHLY" | "ANNUAL" | null;
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
        {title}
      </h2>
      <ul className="mt-3 divide-y divide-[#EAECEF] border-y border-[#EAECEF]">
        {lines.map((line) => {
          const total =
            Math.max(0, Math.floor(line.unitPriceCents)) *
            Math.max(1, Math.floor(line.quantity));
          return (
            <li
              key={line.id}
              className="flex items-start justify-between gap-4 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-[#0F172A]">
                  {line.label}
                  {line.quantity > 1 ? (
                    <span className="ml-1 text-xs font-normal text-[#6B7280]">
                      × {line.quantity}
                    </span>
                  ) : null}
                </p>
                {line.description ? (
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#6B7280]">
                    {line.description}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[15px] font-medium tabular-nums text-[#0F172A]">
                  {formatCents(total, currency)}
                  {cadence ? (
                    <span className="text-xs font-normal text-[#6B7280]">
                      {cadenceLabel(cadence)}
                    </span>
                  ) : null}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SummaryRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={muted ? "text-[#6B7280]" : "text-[#374151]"}>{label}</dt>
      <dd
        className={`tabular-nums ${
          muted ? "text-[#6B7280]" : "font-medium text-[#0F172A]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
