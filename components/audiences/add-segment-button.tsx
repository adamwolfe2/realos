"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, Check } from "lucide-react";
import { addAudienceSegmentById } from "@/lib/actions/audiences";

export function AddSegmentButton({
  variant = "default",
}: {
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [alSegmentId, setAlSegmentId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Lock body scroll while the modal is open and close on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pending]);

  function reset() {
    setAlSegmentId("");
    setName("");
    setDescription("");
    setError(null);
    setSuccess(null);
  }

  function close() {
    if (pending) return;
    reset();
    setOpen(false);
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
        ? "Reachable. Computing insights from a 300-member sample."
        : "Reachable but AL returned 0 members on the first page.";
      setSuccess(`${verb}. ${tail}`);
      router.refresh();
      window.setTimeout(() => {
        reset();
        setOpen(false);
      }, 1400);
    });
  }

  return (
    <>
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

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby="add-segment-title"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div>
                <h2
                  id="add-segment-title"
                  className="text-base font-semibold tracking-tight"
                >
                  Add an AudienceLab segment
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Paste the segment ID from your AudienceLab dashboard. We
                  validate it on save and pull insights so the dashboard
                  populates immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 px-5 py-4">
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

              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}
              {success ? (
                <p className="text-xs text-emerald-700 inline-flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {success}
                </p>
              ) : null}
            </form>

            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={close}
                disabled={pending}
                className="rounded-md"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={(e) =>
                  handleSubmit(e as unknown as React.FormEvent)
                }
                disabled={pending}
                size="sm"
                className="rounded-md"
              >
                {pending ? "Validating with AudienceLab…" : "Save segment"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
