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
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">
          Turn anonymous visitors into named leads
        </h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Identity-resolution pixel matches your site&apos;s visitors against a
          consented identity graph and drops named leads with email, phone, and
          company into your CRM. Tell us where it should live and our team
          configures everything for you within one business day.
        </p>
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-4">
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
            Public name of the property or site. Used in your portal and on
            internal records.
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
            The full URL where you&apos;ll paste the install snippet.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Submitting…" : "Request your pixel"}
        </Button>
        {state && state.ok && state.queued ? (
          <span className="text-xs text-emerald-700">
            Got it. We&apos;ll email your install snippet within one business day.
          </span>
        ) : null}
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
