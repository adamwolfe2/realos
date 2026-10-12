import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ForbiddenError,
  requireWorkspaceAdmin,
  TrialExpiredError,
} from "@/lib/tenancy/scope";
import {
  loadPendingSeoOptions,
  type GooglePropertyOption,
  type SeoPickerProvider,
} from "@/lib/integrations/google-properties";
import { PageHeader } from "@/components/admin/page-header";
import { ConnectStepper } from "@/components/portal/connect/account-picker-list";
import { SeoPropertyPicker } from "./seo-property-picker";

const COPY: Record<
  SeoPickerProvider,
  { title: string; noun: string; start: string; empty: string }
> = {
  GA4: {
    title: "Choose a Google Analytics property",
    noun: "GA4 properties",
    start: "/api/oauth/ga4/start",
    empty:
      "The Google account you signed in with can't see any GA4 properties. Ask whoever owns your Analytics account to add you as a Viewer, then sign in again.",
  },
  GSC: {
    title: "Choose a Search Console property",
    noun: "Search Console properties",
    start: "/api/oauth/gsc/start",
    empty:
      "The Google account you signed in with has no verified Search Console properties. Ask the site owner to add you as a user, then sign in again.",
  },
};

// Server shell for /portal/connect/{ga4,gsc}/select.
export async function SeoSelectPage({
  provider,
  propertyId,
}: {
  provider: SeoPickerProvider;
  /** LeaseStack property the sign-in was scoped to; null = org-wide. */
  propertyId: string | null;
}) {
  // Only owners/admins can connect sources, so only they see the list.
  let scope;
  try {
    scope = await requireWorkspaceAdmin();
  } catch (err) {
    // TrialExpiredError extends ForbiddenError: billing, not back to Connect.
    if (err instanceof TrialExpiredError) redirect("/portal/billing");
    if (err instanceof ForbiddenError) redirect("/portal/connect");
    throw err;
  }
  const copy = COPY[provider];

  let pending: Awaited<ReturnType<typeof loadPendingSeoOptions>> | null = null;
  let listError: string | null = null;
  try {
    pending = await loadPendingSeoOptions(scope, provider, propertyId);
  } catch (err) {
    console.error(`[connect/${provider}] listing properties failed`, err);
    listError = `Couldn't load your ${copy.noun} from Google.`;
  }
  // No pending row: this sign-in refreshed an already-connected property's
  // token, so there's nothing to pick.
  if (pending && !pending.row) {
    redirect("/portal/settings/integrations");
  }
  const options: GooglePropertyOption[] =
    pending && pending.row ? pending.options : [];
  const forProperty = pending?.row?.propertyName ?? null;
  // Retry keeps the sign-in's property scope.
  const retryHref = propertyId
    ? `${copy.start}?propertyId=${encodeURIComponent(propertyId)}`
    : copy.start;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={copy.title}
        description={`These are the ${copy.noun} your Google login can reach. Pick the one for ${forProperty ?? "this workspace"}. You can connect more later.`}
        actions={
          <Link
            href="/portal/connect"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        }
      />
      {listError || options.length === 0 ? (
        <>
          <ConnectStepper current={2} />
          <div className="rounded-[2px] border border-border bg-muted/20 p-5 space-y-2">
            <p className="text-sm font-medium text-foreground">
              {listError ?? `No ${copy.noun} found.`}
            </p>
            {listError ? null : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {copy.empty}
              </p>
            )}
            <Link
              href={retryHref}
              className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              Sign in with Google again
            </Link>
          </div>
        </>
      ) : (
        <SeoPropertyPicker
          provider={provider}
          propertyId={propertyId}
          options={options}
        />
      )}
    </div>
  );
}
