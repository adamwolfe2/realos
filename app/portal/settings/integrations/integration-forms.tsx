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
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs tracking-widest uppercase opacity-70">
          Website name
        </span>
        <input
          name="websiteName"
          defaultValue={defaultWebsiteName}
          className="border rounded px-3 py-2 text-sm bg-background"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs tracking-widest uppercase opacity-70">
          Website URL
        </span>
        <input
          name="websiteUrl"
          type="url"
          required
          placeholder="https://example.com"
          className="border rounded px-3 py-2 text-sm bg-background"
        />
        <span className="text-[11px] opacity-60">
          Include the full URL of the site where you'll install the pixel.
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-foreground text-background px-4 py-2 text-xs font-semibold rounded disabled:opacity-40"
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
