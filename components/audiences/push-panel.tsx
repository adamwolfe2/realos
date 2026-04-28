"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pushSegmentToDestination } from "@/lib/actions/audiences";
import { Send, Filter, Download } from "lucide-react";

type Destination = {
  id: string;
  name: string;
  type: string;
};

export function PushPanel({
  segmentId,
  memberCount,
  destinations,
}: {
  segmentId: string;
  memberCount: number;
  destinations: Destination[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [destinationId, setDestinationId] = useState(
    destinations[0]?.id ?? "",
  );
  const [zipCodes, setZipCodes] = useState("");
  const [states, setStates] = useState("");
  const [cities, setCities] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  function handlePush() {
    setError(null);
    setSuccess(null);
    if (!destinationId) {
      setError("Pick a destination first.");
      return;
    }
    startTransition(async () => {
      const result = await pushSegmentToDestination({
        segmentId,
        destinationId,
        geoFilter: buildFilter(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.csvBase64 && result.filename) {
        triggerCsvDownload(result.csvBase64, result.filename);
      }
      setSuccess(
        `Pushed ${result.memberCount.toLocaleString()} members successfully.`,
      );
      router.refresh();
    });
  }

  if (destinations.length === 0) {
    return (
      <div className="flex items-start gap-3 py-2">
        <Send className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium">No destinations connected yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add a webhook URL or pick a connected ad account to start pushing.
          </p>
          <Button asChild size="sm" className="mt-3 rounded-md">
            <Link href="/portal/audiences/destinations">
              Add a destination
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          ~{memberCount.toLocaleString()} members in source. Filter narrows the
          push.
        </p>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <Filter className="h-3.5 w-3.5" />
          {showFilters ? "Hide filters" : "Add filters"}
        </button>
      </div>

      <div>
        <Label
          htmlFor="dest"
          className="text-xs uppercase tracking-widest text-muted-foreground"
        >
          Destination
        </Label>
        <select
          id="dest"
          value={destinationId}
          onChange={(e) => setDestinationId(e.target.value)}
          className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({prettyType(d.type)})
            </option>
          ))}
        </select>
      </div>

      {showFilters ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="zips" className="text-xs">
              Zip codes
            </Label>
            <Input
              id="zips"
              value={zipCodes}
              onChange={(e) => setZipCodes(e.target.value)}
              placeholder="94704, 94705"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="states" className="text-xs">
              States
            </Label>
            <Input
              id="states"
              value={states}
              onChange={(e) => setStates(e.target.value)}
              placeholder="CA, NY"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="cities" className="text-xs">
              Cities
            </Label>
            <Input
              id="cities"
              value={cities}
              onChange={(e) => setCities(e.target.value)}
              placeholder="Berkeley; Oakland"
              className="mt-1"
            />
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={handlePush}
          disabled={pending}
          size="sm"
          className="rounded-md"
        >
          {currentTypeIs(destinationId, destinations, "CSV_DOWNLOAD") ? (
            <Download />
          ) : (
            <Send />
          )}
          {pending ? "Pushing…" : "Push now"}
        </Button>
        {success ? (
          <span className="text-xs text-emerald-700">{success}</span>
        ) : null}
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : null}
      </div>
    </div>
  );
}

function prettyType(t: string): string {
  return t.toLowerCase().replace(/_/g, " ");
}

function currentTypeIs(
  id: string,
  destinations: Destination[],
  type: string,
): boolean {
  return destinations.find((d) => d.id === id)?.type === type;
}

function triggerCsvDownload(base64: string, filename: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
