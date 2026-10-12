import "server-only";
import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { authFromStoredCredentials as ga4Auth } from "@/lib/integrations/ga4";
import { authFromStoredCredentials as gscAuth } from "@/lib/integrations/gsc";
import { PENDING_OAUTH_BIND } from "@/lib/integrations/seo-sync";

// Lists what a signed-in Google user can pick after the GA4 / Search Console
// OAuth consent: GA4 properties (Analytics Admin API) and verified Search
// Console sites. Used by /portal/connect/[seo]/select and re-checked by the
// bind action so the client can't submit an identifier it doesn't own.

type GoogleAuth =
  | InstanceType<typeof google.auth.JWT>
  | InstanceType<typeof google.auth.OAuth2>;

export type GooglePropertyOption = {
  /** Value stored in SeoIntegration.propertyIdentifier. */
  id: string;
  name: string;
  detail: string | null;
};

export async function listGa4Properties(
  auth: GoogleAuth,
): Promise<GooglePropertyOption[]> {
  const admin = google.analyticsadmin({ version: "v1beta", auth });
  const out: GooglePropertyOption[] = [];
  let pageToken: string | undefined;
  // ponytail: 10 pages x 200 accounts is far past any operator; raise if an
  // agency login ever hits it.
  for (let page = 0; page < 10; page += 1) {
    const res = await admin.accountSummaries.list({ pageSize: 200, pageToken });
    for (const account of res.data.accountSummaries ?? []) {
      for (const p of account.propertySummaries ?? []) {
        const id = (p.property ?? "").replace(/^properties\//, "");
        if (!/^\d+$/.test(id)) continue;
        out.push({
          id,
          name: p.displayName ?? `Property ${id}`,
          detail: [account.displayName, id].filter(Boolean).join(" · "),
        });
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }
  return out;
}

export async function listGscSites(
  auth: GoogleAuth,
): Promise<GooglePropertyOption[]> {
  const sc = google.searchconsole({ version: "v1", auth });
  const res = await sc.sites.list();
  return (res.data.siteEntry ?? [])
    .filter(
      (s): s is { siteUrl: string; permissionLevel?: string | null } =>
        !!s.siteUrl && s.permissionLevel !== "siteUnverifiedUser",
    )
    .map((s) => ({
      id: s.siteUrl,
      name: s.siteUrl.replace(/^sc-domain:/, ""),
      detail: s.siteUrl.startsWith("sc-domain:")
        ? "Domain property"
        : "URL-prefix property",
    }));
}

export { PENDING_OAUTH_BIND };

export type SeoPickerProvider = "GA4" | "GSC";

export type PendingSeoRow = { id: string; propertyName: string | null };

/**
 * The GA4/GSC row still waiting for a property pick for this LeaseStack
 * property (null = the org-wide row), plus the properties its Google login
 * can reach. propertyId comes from the signed OAuth state via the callback
 * redirect, so per-property sign-ins never bind onto each other's rows.
 * Shared by the picker page and the bind action so the bound value is
 * always one Google listed.
 */
export async function loadPendingSeoOptions(
  orgId: string,
  provider: SeoPickerProvider,
  propertyId: string | null,
): Promise<
  | { row: null }
  | { row: PendingSeoRow; options: GooglePropertyOption[] }
> {
  const found = await prisma.seoIntegration.findFirst({
    where: { orgId, provider, propertyId, propertyIdentifier: PENDING_OAUTH_BIND },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      serviceAccountJsonEncrypted: true,
      property: { select: { name: true } },
    },
  });
  if (!found) return { row: null };
  const row = { id: found.id, propertyName: found.property?.name ?? null };
  // List with the token from the sign-in that created this row, not an older
  // org-level OAuthConnection, so the picker shows what this login can see.
  if (provider === "GA4") {
    const auth = ga4Auth(found.serviceAccountJsonEncrypted);
    return { row, options: await listGa4Properties(auth) };
  }
  const auth = gscAuth(found.serviceAccountJsonEncrypted);
  return { row, options: await listGscSites(auth) };
}
