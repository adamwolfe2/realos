import "server-only";

// ---------------------------------------------------------------------------
// Vercel Domain API helpers.
// Docs: https://vercel.com/docs/rest-api/reference/endpoints/projects
//
// Flow when onboarding a new tenant with a custom domain:
//   1. Agency operator records the hostname in DomainBinding.
//   2. We call attachDomainToProject(hostname) to register it with Vercel.
//   3. Client updates their DNS (A record to 76.76.21.21 or CNAME to
//      cname.vercel-dns.com). See docs/domains-setup.md.
//   4. We call verifyDomain(hostname) on a cron until it returns verified.
//   5. Vercel issues an SSL certificate automatically.
//
// Wildcard subdomain `*.{platform-domain}` is added once, manually, per the
// docs. Client subdomains (`{slug}.{platform-domain}`) require no API calls.
// ---------------------------------------------------------------------------

const VERCEL_API = "https://api.vercel.com";

function qs(params: Record<string, string | undefined>): string {
  const pairs = Object.entries(params).filter(([, v]) => !!v) as [string, string][];
  if (pairs.length === 0) return "";
  return "?" + new URLSearchParams(pairs).toString();
}

function authHeaders(): HeadersInit {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) {
    throw new Error(
      "VERCEL_API_TOKEN not configured, cannot call Vercel Domain API"
    );
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function projectPath(): string {
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) {
    throw new Error("VERCEL_PROJECT_ID not configured");
  }
  return `/v10/projects/${projectId}`;
}

function teamQs(): Record<string, string | undefined> {
  return { teamId: process.env.VERCEL_TEAM_ID || undefined };
}

export type VercelDomainStatus = {
  name: string;
  verified: boolean;
  configuredBy?: string | null;
  misconfigured?: boolean;
  apexName?: string;
  projectId?: string;
  createdAt?: number;
  updatedAt?: number;
};

export async function attachDomainToProject(hostname: string) {
  const res = await fetch(
    `${VERCEL_API}${projectPath()}/domains${qs(teamQs())}`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name: hostname }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `attachDomainToProject(${hostname}) failed, ${res.status}: ${body}`
    );
  }
  return (await res.json()) as VercelDomainStatus;
}

export async function removeDomainFromProject(hostname: string) {
  const res = await fetch(
    `${VERCEL_API}${projectPath()}/domains/${encodeURIComponent(hostname)}${qs(teamQs())}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `removeDomainFromProject(${hostname}) failed, ${res.status}: ${body}`
    );
  }
  return { ok: true };
}

export async function verifyDomain(hostname: string): Promise<{
  verified: boolean;
  raw: unknown;
}> {
  const res = await fetch(
    `${VERCEL_API}/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${encodeURIComponent(hostname)}/verify${qs(teamQs())}`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { verified: false, raw };
  }
  const r = raw as { verified?: boolean };
  return { verified: !!r.verified, raw };
}

export async function getDomainStatus(
  hostname: string
): Promise<VercelDomainStatus | null> {
  const res = await fetch(
    `${VERCEL_API}/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${encodeURIComponent(hostname)}${qs(teamQs())}`,
    { headers: authHeaders() }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `getDomainStatus(${hostname}) failed, ${res.status}: ${body}`
    );
  }
  return (await res.json()) as VercelDomainStatus;
}
