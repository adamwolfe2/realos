"use client";

import { useActionState } from "react";
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
      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-medium text-foreground">
          Step 1 — Tell us where the pixel will live
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[11px] font-medium text-foreground">
            Website name
          </span>
          <input
            name="websiteName"
            defaultValue={defaultWebsiteName}
            className="border rounded px-3 py-2 text-sm bg-background"
          />
          <span className="text-[11px] text-muted-foreground">
            Shown in your portal and in the webhook metadata. The public name
            of the property or site.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[11px] font-medium text-foreground">
            Website URL
          </span>
          <input
            name="websiteUrl"
            type="url"
            required
            placeholder="https://example.com"
            className="border rounded px-3 py-2 text-sm bg-background"
          />
          <span className="text-[11px] text-muted-foreground">
            The full URL of the site where you&apos;ll paste the install snippet.
          </span>
        </label>
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

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-4 py-2 text-xs font-semibold rounded disabled:opacity-40"
        >
          {pending ? "Connecting…" : "Connect Cursive pixel"}
        </button>
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
