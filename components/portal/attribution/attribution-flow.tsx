import type { CSSProperties } from "react";
import type { AttributionFlowSummary } from "@/lib/attribution/proof-model";

type SourceNode = {
  label: string;
  count: number;
  y: number;
  delay: string;
};

export function AttributionFlow({ flow }: { flow: AttributionFlowSummary }) {
  const sources: SourceNode[] = [
    { label: "Chatbot", count: flow.chatbot, y: 36, delay: "0ms" },
    { label: "Popups and forms", count: flow.forms, y: 112, delay: "90ms" },
    { label: "Visitor pixel", count: flow.visitorPixel, y: 188, delay: "180ms" },
    { label: "Other LeaseStack", count: flow.other, y: 264, delay: "270ms" },
  ];

  return (
    <section className="overflow-hidden border border-blue-200 bg-blue-50/35">
      <div className="border-b border-blue-200 bg-blue-50/70 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          LeaseStack attribution flow
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          LeaseStack-captured leads matched to verified AppFolio outcomes.
        </p>
      </div>

      <div className="hidden overflow-x-auto p-4 lg:block">
        <svg
          role="img"
          aria-labelledby="attribution-flow-title attribution-flow-description"
          viewBox="0 0 1200 360"
          className="h-auto min-w-[900px] w-full"
        >
          <title id="attribution-flow-title">LeaseStack lead attribution flow</title>
          <desc id="attribution-flow-description">
            {flow.captured} LeaseStack leads, including {flow.chatbot} chatbot,
            {` ${flow.forms}`} popup and form, and {flow.visitorPixel} visitor
            pixel leads, produced {flow.applied} AppFolio applications and
            {` ${flow.signed}`} verified signed leases.
          </desc>
          <defs>
            <linearGradient id="flow-blue" x1="0" x2="1">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
          </defs>

          {sources.map((source) => (
            <g key={source.label}>
              <path
                pathLength="1"
                d={`M 248 ${source.y + 29} C 330 ${source.y + 29}, 330 180, 420 180`}
                fill="none"
                stroke="url(#flow-blue)"
                strokeWidth={flowStrokeWidth(source.count, flow.captured)}
                strokeLinecap="round"
                className="attribution-flow-path"
                style={{ "--flow-delay": source.delay } as CSSProperties}
              />
              <rect
                x="24"
                y={source.y}
                width="224"
                height="58"
                rx="2"
                fill="#ffffff"
                stroke="#bfdbfe"
              />
              <text
                x="42"
                y={source.y + 24}
                className="fill-slate-600 text-[13px] font-medium"
              >
                {source.label}
              </text>
              <text
                x="42"
                y={source.y + 46}
                className="fill-slate-950 text-[20px] font-semibold"
              >
                {source.count.toLocaleString()}
              </text>
            </g>
          ))}

          <FlowPath d="M 596 180 C 642 180, 660 180, 706 180" delay="360ms" />
          <FlowPath d="M 882 180 C 928 180, 944 180, 990 180" delay="520ms" />

          <OutcomeNode
            x={420}
            label="Captured"
            count={flow.captured}
            detail="LeaseStack leads"
          />
          <OutcomeNode
            x={706}
            label="Applied in AppFolio"
            count={flow.applied}
            detail={conversionLabel(flow.applied, flow.captured)}
          />
          <OutcomeNode
            x={990}
            label="Signed in AppFolio"
            count={flow.signed}
            detail="Verified matches only"
            strong
          />
        </svg>
      </div>

      <div
        className="space-y-3 p-4 lg:hidden"
        aria-label="LeaseStack lead attribution flow"
      >
        <div className="grid grid-cols-2 gap-2">
          {sources.map((source) => (
            <div key={source.label} className="border border-blue-200 bg-white p-3">
              <div className="text-xs font-medium text-muted-foreground">
                {source.label}
              </div>
              <div className="mt-1 font-mono text-xl font-semibold tabular-nums">
                {source.count.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        <MobileOutcome label="Captured" count={flow.captured} />
        <MobileOutcome label="Applied in AppFolio" count={flow.applied} />
        <MobileOutcome label="Signed in AppFolio" count={flow.signed} />
      </div>
    </section>
  );
}

function FlowPath({ d, delay }: { d: string; delay: string }) {
  return (
    <path
      pathLength="1"
      d={d}
      fill="none"
      stroke="url(#flow-blue)"
      strokeWidth="8"
      strokeLinecap="round"
      className="attribution-flow-path"
      style={{ "--flow-delay": delay } as CSSProperties}
    />
  );
}

function OutcomeNode({
  x,
  label,
  count,
  detail,
  strong = false,
}: {
  x: number;
  label: string;
  count: number;
  detail: string;
  strong?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y="125"
        width="176"
        height="110"
        rx="2"
        fill={strong ? "#dbeafe" : "#eff6ff"}
        stroke={strong ? "#60a5fa" : "#93c5fd"}
      />
      <text
        x={x + 18}
        y="154"
        className="fill-blue-700 text-[12px] font-semibold uppercase tracking-wider"
      >
        {label}
      </text>
      <text
        x={x + 18}
        y="194"
        className="fill-slate-950 text-[30px] font-semibold"
      >
        {count.toLocaleString()}
      </text>
      <text x={x + 18} y="218" className="fill-slate-500 text-[11px]">
        {detail}
      </text>
    </g>
  );
}

function MobileOutcome({ label, count }: { label: string; count: number }) {
  return (
    <div className="relative border-l-4 border-blue-500 bg-blue-50 px-4 py-3">
      <div className="text-xs font-semibold text-blue-700">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
        {count.toLocaleString()}
      </div>
    </div>
  );
}

function flowStrokeWidth(count: number, total: number): number {
  if (count === 0 || total === 0) return 2;
  return Math.max(3, Math.min(12, 3 + (count / total) * 10));
}

function conversionLabel(count: number, total: number): string {
  if (total === 0) return "0% of captured leads";
  return `${((count / total) * 100).toFixed(1)}% of captured leads`;
}
