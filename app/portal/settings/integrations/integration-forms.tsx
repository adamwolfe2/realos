"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  connectPixel,
  disconnectPixel,
  type ConnectPixelResult,
} from "@/lib/actions/cursive-connect";

const INITIAL: ConnectPixelResult = { ok: true };

export function ConnectPixelForm({
  defaultWebsiteName,
}: {
  defaultWebsiteName: string;
}) {
  const [state, formAction, pending] = useActionState<
    ConnectPixelResult,
    FormData
  >(async (_prev, formData) => connectPixel(formData), INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-4">
        <p className="text-xs font-medium text-foreground">
          Step 1 — Tell us where the pixel will live
        </p>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="websiteName"
            className="text-[11px] font-medium text-foreground"
          >
            Website name
          </Label>
          <Input
            id="websiteName"
            name="websiteName"
            defaultValue={defaultWebsiteName}
          />
          <span className="text-[11px] text-muted-foreground">
            Shown in your portal and in the webhook metadata. The public name
            of the property or site.
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="websiteUrl"
            className="text-[11px] font-medium text-foreground"
          >
            Website URL
          </Label>
          <Input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            required
            placeholder="https://example.com"
          />
          <span className="text-[11px] text-muted-foreground">
            The full URL of the site where you&apos;ll paste the install snippet.
          </span>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-medium text-foreground">
          Step 2 — We provision the pixel and return your install snippet
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          We provision the identity-resolution pixel, bind it to your workspace,
          and register the webhook that drops resolved visitors into your CRM.
          If the upstream handshake needs manual setup, we&apos;ll finish it for
          you and email when the pixel is live.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Connecting…" : "Connect Cursive pixel"}
        </Button>
        {state && !state.ok && state.error ? (
          <span className="text-xs text-destructive">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}

export function DisconnectPixelForm() {
  const [state, formAction, pending] = useActionState<
    ConnectPixelResult,
    FormData
  >(async () => disconnectPixel(), INITIAL);

  return (
    <form action={formAction} className="pt-3 border-t flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-destructive underline underline-offset-2 disabled:opacity-40"
      >
        {pending ? "Disconnecting…" : "Disconnect pixel"}
      </button>
      {state && !state.ok && state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
