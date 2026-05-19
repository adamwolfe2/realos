"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/admin/page-header";
import { saveWhiteLabelSettings } from "@/lib/actions/white-label";

// ---------------------------------------------------------------------------
// White-label settings — client form.
//
// Three fields: brand name (text), logo (file → /api/portal/white-label/logo,
// which writes Vercel Blob + persists the URL), primary color (hex picker).
//
// Logo upload happens out-of-band the moment a file is selected so the
// operator gets immediate feedback (preview swaps; the brand persists
// even if they navigate away before clicking Save). The form-level
// "Save changes" submit handles the text/color fields via the server
// action in lib/actions/white-label.ts.
// ---------------------------------------------------------------------------

const ALLOWED_LOGO_MIME = "image/png,image/jpeg,image/svg+xml";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function WhiteLabelFormClient({
  initial,
  orgName,
}: {
  initial: {
    brandName: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
  };
  orgName: string;
}) {
  const [brandName, setBrandName] = useState(initial.brandName ?? "");
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(
    initial.primaryColor ?? "#0A0A0A",
  );
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);

  async function handleLogoUpload(file: File) {
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Logo too large — files must be 2MB or smaller.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
      toast.error("Use PNG, JPEG, or SVG.");
      return;
    }
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/portal/white-label/logo", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !json.ok || !json.url) {
        toast.error(json.error ?? "Upload failed");
        return;
      }
      setLogoUrl(json.url);
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleLogoRemove() {
    setIsUploading(true);
    try {
      const res = await fetch("/api/portal/white-label/logo", {
        method: "DELETE",
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Failed to remove logo");
        return;
      }
      setLogoUrl(null);
      toast.success("Logo removed");
    } finally {
      setIsUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveWhiteLabelSettings(fd);
      if (result.ok) {
        toast.success("Branding saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <SectionCard
        label="Brand identity"
        description="Shown in the portal sidebar, the public marketing site, and the From display name on every outbound email."
      >
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="whiteLabelBrandName">Brand name</Label>
            <Input
              id="whiteLabelBrandName"
              name="whiteLabelBrandName"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder={orgName}
              maxLength={80}
            />
            <p className="text-[11.5px] text-muted-foreground">
              Falls back to LeaseStack when blank. Max 80 characters.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="whiteLabelPrimaryColor">Primary color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer"
                aria-label="Pick primary color"
              />
              <Input
                id="whiteLabelPrimaryColor"
                name="whiteLabelPrimaryColor"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#0A0A0A"
                className="font-mono"
                maxLength={7}
              />
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              Used for the email header background and CTA buttons. Hex
              format like <span className="font-mono">#1a1a2e</span>.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        label="Logo"
        description="PNG, JPEG, or SVG. 2MB max. Recommended height 32px at @2x."
      >
        <div className="space-y-4">
          {logoUrl ? (
            <div className="flex items-center gap-4 p-3 rounded border border-border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Current logo"
                className="h-10 w-auto max-w-[200px] object-contain"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-muted-foreground truncate">
                  {logoUrl}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleLogoRemove}
                disabled={isUploading}
                aria-label="Remove logo"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ) : null}

          <label className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium rounded border border-border cursor-pointer hover:bg-muted transition">
            <UploadCloud className="size-4" />
            <span>{isUploading ? "Uploading…" : "Upload logo"}</span>
            <input
              type="file"
              accept={ALLOWED_LOGO_MIME}
              className="sr-only"
              disabled={isUploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleLogoUpload(f);
                // Reset so re-selecting the same filename re-triggers change.
                e.currentTarget.value = "";
              }}
            />
          </label>

          {/* Hidden field so the server action can persist the logo URL
              alongside the brand name + color. We re-send the current
              value (uploads pre-persist, but this guards against a
              race where the URL state changed but the server hasn't
              caught up). */}
          <input
            type="hidden"
            name="whiteLabelLogoUrl"
            value={logoUrl ?? ""}
          />
        </div>
      </SectionCard>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
