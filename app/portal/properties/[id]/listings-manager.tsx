"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createListing,
  deleteListing,
  toggleListingAvailable,
} from "@/lib/actions/listings";

const INPUT =
  "rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30";
const LABEL =
  "text-[10px] tracking-widest uppercase font-semibold text-muted-foreground";

export function AddListingForm({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("propertyId", propertyId);
    const form = e.currentTarget;
    startTransition(async () => {
      const result = await createListing(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      form.reset();
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-primary hover:underline"
      >
        + Add listing
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-md border border-border bg-muted/20 p-3 space-y-3"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Unit type</span>
          <input
            name="unitType"
            type="text"
            placeholder="e.g. Triple Shared"
            maxLength={80}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Unit #</span>
          <input
            name="unitNumber"
            type="text"
            placeholder="e.g. 304"
            maxLength={40}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Beds</span>
          <input
            name="bedrooms"
            type="number"
            min={0}
            step="0.5"
            placeholder="1"
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Baths</span>
          <input
            name="bathrooms"
            type="number"
            min={0}
            step="0.5"
            placeholder="1"
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Price ($/mo)</span>
          <input
            name="priceDollars"
            type="number"
            min={0}
            step="1"
            placeholder="765"
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Available from</span>
          <input name="availableFrom" type="date" className={INPUT} />
        </label>
        <label className="flex items-end gap-2 col-span-2 sm:col-span-2">
          <input
            id={`avail-${propertyId}`}
            name="isAvailable"
            type="checkbox"
            defaultChecked
            className="h-4 w-4"
          />
          <span className="text-xs text-foreground">
            Mark as available now
          </span>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-3 py-1.5 text-xs font-medium rounded-md disabled:opacity-40"
        >
          {pending ? "Adding…" : "Add listing"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : null}
      </div>
    </form>
  );
}

export function ListingRowActions({
  listingId,
  isAvailable,
}: {
  listingId: string;
  isAvailable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleListingAvailable(listingId, !isAvailable);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("Delete this listing?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteListing(listingId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        {isAvailable ? "Mark leased" : "Mark available"}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="text-[11px] text-destructive/80 hover:text-destructive disabled:opacity-40"
      >
        Delete
      </button>
      {error ? (
        <span className="text-[10px] text-destructive">{error}</span>
      ) : null}
    </div>
  );
}
