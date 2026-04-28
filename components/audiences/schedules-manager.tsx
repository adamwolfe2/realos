"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  Calendar,
  Pause,
  Play,
} from "lucide-react";
import {
  createAudienceSchedule,
  deleteAudienceSchedule,
  toggleAudienceSchedule,
} from "@/lib/actions/audiences";
import { describeSchedule } from "@/lib/audiences/schedule";
import type { AudienceScheduleFrequency } from "@prisma/client";

type SegmentOpt = { id: string; name: string };
type DestinationOpt = { id: string; name: string; type: string };

export type ScheduleRow = {
  id: string;
  segmentId: string;
  segmentName: string;
  destinationName: string;
  destinationType: string;
  frequency: AudienceScheduleFrequency;
  dayOfWeek: number | null;
  hourUtc: number;
  enabled: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  filterSummary: string | null;
};

const DAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: `${String(h).padStart(2, "0")}:00 UTC`,
}));

export function SchedulesManager({
  schedules,
  segments,
  destinations,
  initialSegmentId,
}: {
  schedules: ScheduleRow[];
  segments: SegmentOpt[];
  destinations: DestinationOpt[];
  initialSegmentId?: string;
}) {
  const [adding, setAdding] = useState<boolean>(!!initialSegmentId);

  const canCreate = segments.length > 0 && destinations.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          variant={adding ? "outline" : "default"}
          size="sm"
          onClick={() => setAdding((v) => !v)}
          disabled={!canCreate && !adding}
          className="rounded-md"
        >
          <Plus />
          {adding ? "Cancel" : "New schedule"}
        </Button>
      </div>

      {adding ? (
        <CreateScheduleForm
          segments={segments}
          destinations={destinations}
          initialSegmentId={initialSegmentId}
          canCreate={canCreate}
          onDone={() => setAdding(false)}
        />
      ) : null}

      {schedules.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-md">
          No schedules yet. Set one up to push this segment automatically.
        </div>
      ) : (
        <div className="-mx-5 -mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="text-left font-semibold py-2 px-5">Segment</th>
                <th className="text-left font-semibold py-2 px-3">Destination</th>
                <th className="text-left font-semibold py-2 px-3">Cadence</th>
                <th className="text-left font-semibold py-2 px-3">Next run</th>
                <th className="text-left font-semibold py-2 px-3">Last run</th>
                <th className="px-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {schedules.map((s) => (
                <ScheduleRowView key={s.id} row={s} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScheduleRowView({ row }: { row: ScheduleRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleAudienceSchedule(row.id, !row.enabled);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function handleDelete() {
    if (
      !confirm(
        `Delete schedule for "${row.segmentName}" → "${row.destinationName}"?`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteAudienceSchedule(row.id);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <tr className="hover:bg-muted/40 transition-colors">
      <td className="py-3 px-5 align-top">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md shrink-0 text-primary bg-primary/10">
            <Calendar className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="font-medium truncate">{row.segmentName}</div>
            {!row.enabled ? (
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                Paused
              </div>
            ) : row.filterSummary ? (
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                Filter: {row.filterSummary}
              </div>
            ) : null}
          </div>
        </div>
        {error ? (
          <p className="text-xs text-destructive mt-2">{error}</p>
        ) : null}
      </td>
      <td className="py-3 px-3 align-top">
        <div className="font-medium truncate">{row.destinationName}</div>
        <div className="text-[11px] text-muted-foreground">
          {prettyType(row.destinationType)}
        </div>
      </td>
      <td className="py-3 px-3 align-top text-muted-foreground">
        {describeSchedule(row.frequency, row.dayOfWeek, row.hourUtc)}
      </td>
      <td className="py-3 px-3 align-top text-xs text-muted-foreground tabular-nums">
        {row.enabled ? formatDateTime(row.nextRunAt) : "—"}
      </td>
      <td className="py-3 px-3 align-top text-xs text-muted-foreground tabular-nums">
        {row.lastRunAt ? formatDateTime(row.lastRunAt) : "—"}
      </td>
      <td className="py-3 px-5 align-top text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={handleToggle}
            disabled={pending}
            aria-label={row.enabled ? "Pause schedule" : "Resume schedule"}
            title={row.enabled ? "Pause schedule" : "Resume schedule"}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {row.enabled ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={handleDelete}
            disabled={pending}
            aria-label="Delete schedule"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-rose-50 hover:text-rose-700 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function CreateScheduleForm({
  segments,
  destinations,
  initialSegmentId,
  canCreate,
  onDone,
}: {
  segments: SegmentOpt[];
  destinations: DestinationOpt[];
  initialSegmentId?: string;
  canCreate: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [segmentId, setSegmentId] = useState<string>(
    initialSegmentId &&
      segments.some((s) => s.id === initialSegmentId)
      ? initialSegmentId
      : (segments[0]?.id ?? ""),
  );
  const [destinationId, setDestinationId] = useState<string>(
    destinations[0]?.id ?? "",
  );
  const [frequency, setFrequency] = useState<AudienceScheduleFrequency>("DAILY");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Monday by default
  const [hourUtc, setHourUtc] = useState<number>(13); // 13:00 UTC default
  const [zipCodes, setZipCodes] = useState("");
  const [states, setStates] = useState("");
  const [cities, setCities] = useState("");
  const [error, setError] = useState<string | null>(null);

  function buildFilter() {
    const zip = zipCodes
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const st = states
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const ct = cities
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!zip.length && !st.length && !ct.length) return undefined;
    return { zipCodes: zip, states: st, cities: ct };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!segmentId || !destinationId) {
      setError("Pick a segment and a destination.");
      return;
    }
    startTransition(async () => {
      const result = await createAudienceSchedule({
        segmentId,
        destinationId,
        frequency,
        dayOfWeek: frequency === "WEEKLY" ? dayOfWeek : null,
        hourUtc,
        geoFilter: buildFilter(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  if (!canCreate) {
    return (
      <div className="bg-muted/30 border border-border rounded-md p-4 text-sm text-muted-foreground">
        {segments.length === 0
          ? "Pull your AudienceLab segments first, then come back."
          : "Add a destination on the Destinations tab before scheduling a sync."}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-muted/30 border border-border rounded-md p-4 space-y-3"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="s-segment" className="text-xs">
            Segment
          </Label>
          <select
            id="s-segment"
            value={segmentId}
            onChange={(e) => setSegmentId(e.target.value)}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
            required
          >
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="s-dest" className="text-xs">
            Destination
          </Label>
          <select
            id="s-dest"
            value={destinationId}
            onChange={(e) => setDestinationId(e.target.value)}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
            required
          >
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({prettyType(d.type)})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Frequency</Label>
          <div className="mt-1.5 flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="frequency"
                value="DAILY"
                checked={frequency === "DAILY"}
                onChange={() => setFrequency("DAILY")}
                className="h-3.5 w-3.5"
              />
              Daily
            </label>
            <label className="inline-flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="frequency"
                value="WEEKLY"
                checked={frequency === "WEEKLY"}
                onChange={() => setFrequency("WEEKLY")}
                className="h-3.5 w-3.5"
              />
              Weekly
            </label>
          </div>
        </div>

        {frequency === "WEEKLY" ? (
          <div>
            <Label htmlFor="s-dow" className="text-xs">
              Day of week
            </Label>
            <select
              id="s-dow"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <Label htmlFor="s-hour" className="text-xs">
            Hour (UTC)
          </Label>
          <select
            id="s-hour"
            value={hourUtc}
            onChange={(e) => setHourUtc(Number(e.target.value))}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Optional geo filter</Label>
        <p className="text-[11px] text-muted-foreground mb-2 mt-0.5">
          Comma-separated. Leave blank to push the full segment.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="s-zips" className="text-xs">
              Zip codes
            </Label>
            <Input
              id="s-zips"
              value={zipCodes}
              onChange={(e) => setZipCodes(e.target.value)}
              placeholder="94704, 94705"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="s-states" className="text-xs">
              States
            </Label>
            <Input
              id="s-states"
              value={states}
              onChange={(e) => setStates(e.target.value)}
              placeholder="CA, NY"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="s-cities" className="text-xs">
              Cities
            </Label>
            <Input
              id="s-cities"
              value={cities}
              onChange={(e) => setCities(e.target.value)}
              placeholder="Berkeley; Oakland"
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2 pt-1">
        <Button
          type="submit"
          disabled={pending}
          size="sm"
          className="rounded-md"
        >
          {pending ? "Saving…" : "Save schedule"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDone}
          className="rounded-md"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function prettyType(t: string): string {
  return t.toLowerCase().replace(/_/g, " ");
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // Compact UTC representation, matches the rest of the schedule UI.
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(
    d.getUTCMinutes(),
  ).padStart(2, "0")} UTC`;
  return `${date}, ${time}`;
}
