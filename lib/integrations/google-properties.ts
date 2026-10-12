import "server-only";
import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { authFromStoredCredentials as ga4Auth } from "@/lib/integrations/ga4";
import { authFromStoredCredentials as gscAuth } from "@/lib/integrations/gsc";

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

// Placeholder the OAuth callback writes until the operator picks a property.
export const PENDING_OAUTH_BIND = "PENDING_OAUTH_BIND";

export type SeoPickerProvider = "GA4" | "GSC";

/**
 * The org's most recent GA4/GSC row still waiting for a property pick, plus
 * the properties its Google login can reach. Shared by the picker page and
 * the bind action so the bound value is always one Google listed.
 */
export async function loadPendingSeoOptions(
  orgId: string,
  provider: SeoPickerProvider,
): Promise<
  | { row: null }
  | { row: { id: string }; options: GooglePropertyOption[] }
> {
  const row = await prisma.seoIntegration.findFirst({
    where: { orgId, provider, propertyIdentifier: PENDING_OAUTH_BIND },
    orderBy: { updatedAt: "desc" },
    select: { id: true, serviceAccountJsonEncrypted: true },
  });
  if (!row) return { row: null };
  // List with the token from the sign-in that created this row, not an older
  // org-level OAuthConnection, so the picker shows what this login can see.
  if (provider === "GA4") {
    const auth = ga4Auth(row.serviceAccountJsonEncrypted);
    return { row: { id: row.id }, options: await listGa4Properties(auth) };
  }
  const auth = gscAuth(row.serviceAccountJsonEncrypted);
  return { row: { id: row.id }, options: await listGscSites(auth) };
}
