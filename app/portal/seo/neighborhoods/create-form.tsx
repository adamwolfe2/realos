"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createNeighborhoodPage } from "@/lib/actions/neighborhood-pages";

type Property = { id: string; name: string };

export function CreateNeighborhoodForm({
  properties,
}: {
  properties: Property[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [quality, setQuality] = useState<"default" | "high">("default");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createNeighborhoodPage({
        city: city.trim(),
        state: state.trim() || null,
        neighborhood: neighborhood.trim(),
        propertyId: propertyId || null,
        quality,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Draft generated");
      if (res.data) {
        router.push(`/portal/seo/neighborhoods/${res.data.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <div>
        <Label htmlFor="neighborhood">Neighborhood</Label>
        <Input
          id="neighborhood"
          required
          minLength={2}
          maxLength={120}
          placeholder="Capitol Hill"
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="city">City</Label>
        <Input
          id="city"
          required
          minLength={2}
          maxLength={100}
          placeholder="Washington"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="state">State (optional)</Label>
        <Input
          id="state"
          maxLength={80}
          placeholder="DC"
          value={state}
          onChange={(e) => setState(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="propertyId">Anchor property (optional)</Label>
        <select
          id="propertyId"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
        >
          <option value="">None</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2 flex items-center justify-between gap-3">
        <div className="text-[12px] text-muted-foreground">
          Quality:{" "}
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as "default" | "high")}
            className="ml-1 rounded border px-1.5 py-0.5"
          >
            <option value="default">Standard (Haiku, fast)</option>
            <option value="high">High (Sonnet, slower)</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Generating…" : "Generate draft"}
        </Button>
      </div>
    </form>
  );
}
