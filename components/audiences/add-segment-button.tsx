"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, Check } from "lucide-react";
import { addAudienceSegmentById } from "@/lib/actions/audiences";

export function AddSegmentButton({
  variant = "default",
  initialOpen = false,
}: {
  variant?: "default" | "outline";
  initialOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [pending, startTransition] = useTransition();
  const [alSegmentId, setAlSegmentId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function reset() {
    setAlSegmentId("");
    setName("");
    setDescription("");
    setError(null);
    setSuccess(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await addAudienceSegmentById({
        alSegmentId,
        name,
        description: description || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const verb = result.alreadyExisted ? "Updated" : "Added";
      const tail = result.hasMembers
        ? "Segment is reachable and has members."
        : "Reachable, but AL returned 0 members on the first page.";
      setSuccess(`${verb}. ${tail}`);
      router.refresh();
      window.setTimeout(() => {
        reset();
        setOpen(false);
      }, 1400);
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant={variant}
        size="sm"
        onClick={() => setOpen(true)}
        className="rounded-md"
      >
        <Plus />
        Add segment
      </Button>
    );
  }

  return (
    <div className="w-full max-w-xl rounded-md border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Add an AudienceLab segment</h3>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Paste the segment ID from your AudienceLab dashboard. We validate it
        against AL on save, and cache it here so you can push it to your
        destinations.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="seg-id" className="text-xs">
            AudienceLab segment ID
          </Label>
          <Input
            id="seg-id"
            value={alSegmentId}
            onChange={(e) => setAlSegmentId(e.target.value)}
            placeholder="seg_abc123 or the ID from AL"
            className="mt-1 font-mono"
            autoFocus
            required
          />
        </div>
        <div>
          <Label htmlFor="seg-name" className="text-xs">
            Display name
          </Label>
          <Input
            id="seg-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Active Home Buyers, Bay Area"
            className="mt-1"
            required
          />
        </div>
        <div>
          <Label htmlFor="seg-desc" className="text-xs">
            Description (optional)
          </Label>
          <Input
            id="seg-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="High-intent buyers searching SF, Oakland, San Jose."
            className="mt-1"
          />
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {success ? (
          <p className="text-xs text-emerald-700 inline-flex items-center gap-1">
            <Check className="h-3 w-3" />
            {success}
          </p>
        ) : null}

        <div className="flex items-center gap-2 pt-1">
          <Button
            type="submit"
            disabled={pending}
            size="sm"
            className="rounded-md"
          >
            {pending ? "Validating with AudienceLab…" : "Save segment"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="rounded-md"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
