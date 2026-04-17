"use client";

import { PipelineCard, type PipelineItem } from "./pipeline-card";

export type PipelineColumn = {
  id: string;
  label: string;
  items: PipelineItem[];
};

export function PipelineBoard({ columns }: { columns: PipelineColumn[] }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(160px, 1fr))` }}
    >
      {columns.map((col) => (
        <div key={col.id} className="min-w-0">
          {/* Column header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink/60">
              {col.label}
            </h3>
            <span className="font-mono text-[9px] bg-shell text-ink/60 px-1.5 py-0.5 min-w-[20px] text-center">
              {col.items.length}
            </span>
          </div>

          {/* Column border */}
          <div className="border-t border-shell mb-3" />

          {/* Cards */}
          <div className="space-y-2">
            {col.items.length === 0 ? (
              <div className="border border-dashed border-shell p-4 text-center">
                <p className="font-mono text-[9px] text-ink/30 uppercase tracking-wide">
                  Empty
                </p>
              </div>
            ) : (
              col.items.map((item) => <PipelineCard key={item.id} item={item} />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
