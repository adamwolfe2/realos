import "server-only";

// ---------------------------------------------------------------------------
// Vercel Domains REST integration.
//
// Auth:    Bearer token via VERCEL_API_TOKEN
// Project: VERCEL_PROJECT_ID (the Vercel project that serves every tenant
//          surface via hostname-based routing in middleware)
// Team:    optional VERCEL_TEAM_ID (required when the project lives in a team
//          rather than a personal scope)
//
// Endpoints used:
//   POST   /v10/projects/{projectId}/domains
//   DELETE /v9/projects/{projectId}/domains/{domain}
//   GET    /v9/projects/{projectId}/domains/{domain}
//   GET    /v6/domains/{domain}/config              (returns DNS misconfig info)
//   POST   /v9/projects/{projectId}/domains/{domain}/verify
//
// Reference docs:
//   https://vercel.com/docs/rest-api/reference/endpoints/projects
//   https://vercel.com/docs/rest-api/reference/endpoints/domains
//
// NOTE: This module deliberately replaces the older lib/build/domain-attach.ts
// helper with a more complete shape (verification records, 409 handling,
// idempotent attach). Callers that still import the older module continue to
// work; new code should import from here.
// ---------------------------------------------------------------------------

const VERCEL_API = "https://api.vercel.com";

// Vercel's recommended apex A-record IP and CNAME target. Surfaced to the
// operator UI so they can copy/paste DNS instructions to the client.
export const VERCEL_APEX_A_RECORD = "76.76.21.21";
export const VERCEL_CNAME_TARGET = "cname.vercel-dns.com";

export type VercelDomain = {
  name: string;
  apexName?: string;
  projectId?: string;
  verified: boolean;
  // verification[] contains TXT-record challenges Vercel needs the operator
  // to publish so it can prove ownership before issuing certs.
  verification?: Array<{
    type: string; // usually "TXT"
    domain: string;
    value: string;
    reason?: string;
  }>;
  createdAt?: number;
  updatedAt?: number;
};

export type VercelDomainConfig = {
  // From GET /v6/domains/{domain}/config. Tells us whether the *current* DNS
  // points at Vercel correctly, distinct from the verified flag (which is
  // about the TXT challenge).
  configuredBy?: "CNAME" | "A" | "http" | null;
  misconfigured: boolean;
  acceptedChallenges?: string[];
  serviceType?: string;
};

export type DnsRecordHint = {
  // What the operator should tell the client to set at their registrar.
  // We surface both the apex and the www variants.
  type: "A" | "CNAME" | "TXT";
  host: string; // e.g. "@", "www", "_vercel"
  value: string;
  reason: string;
};

export type AddDomainResult =
  | {
      ok: true;
      domain: VercelDomain;
      // True when the hostname was already attached to *this* project; the
      // operator can safely treat it as success.
      alreadyAttached: boolean;
      dnsRecords: DnsRecordHint[];
    }
  | {
      ok: false;
      // 409 when the hostname already lives on a *different* project/team.
      // Surfaced so the UI can tell the operator to release it first.
      code: "ALREADY_ON_OTHER_PROJECT" | "INVALID_HOSTNAME" | "API_ERROR";
      error: string;
    };

function authHeaders(): HeadersInit {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) {
    throw new Error(
      "VERCEL_API_TOKEN not configured, cannot call the Vercel Domains API",
    );
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function projectId(): string {
  const id = process.env.VERCEL_PROJECT_ID;
  if (!id) {
    throw new Error(
      "VERCEL_PROJECT_ID not configured, cannot call the Vercel Domains API",
    );
  }
  return id;
}

function teamQs(): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

function appendQs(base: string, extra: string): string {
  if (!extra) return base;
  return base.includes("?") ? `${base}&${extra.slice(1)}` : `${base}${extra}`;
}

// Strip protocol, trailing slash, port, lowercase. Vercel rejects anything
// that's not a bare hostname so we normalize defensively.
export function normalizeHostname(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:.*$/, "");
}

const HOSTNAME_RE =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function isValidHostname(host: string): boolean {
  return HOSTNAME_RE.test(host);
}

function isApex(host: string): boolean {
  // Naive but good enough for the vast majority of TLDs we'll encounter:
  // a hostname with exactly one dot is treated as apex (example.com), more
  // dots is treated as a subdomain (www.example.com, app.example.co.uk).
  // The minor edge case (foo.co.uk) only impacts DNS *hint* copy, not
  // correctness.
  return host.split(".").length === 2;
}

function dnsHintsForHost(host: string): DnsRecordHint[] {
  const apex = isApex(host);
  if (apex) {
    return [
      {
        type: "A",
        host: "@",
        value: VERCEL_APEX_A_RECORD,
        reason: "Points the apex domain at Vercel's edge.",
      },
      {
        type: "CNAME",
        host: "www",
        value: VERCEL_CNAME_TARGET,
        reason: "Mirrors www to the same site (recommended).",
      },
    ];
  }
  return [
    {
      type: "CNAME",
      host: host.split(".")[0] ?? host,
      value: VERCEL_CNAME_TARGET,
      reason: "Points this subdomain at Vercel's edge.",
    },
  ];
}

// ---------------------------------------------------------------------------
// addDomainToProject — POST /v10/projects/{projectId}/domains
//
// Behavior:
//   - 200/201: returns the Vercel domain payload (with optional verification
//     challenges) plus the DNS records the operator should send to the client.
//   - 409 same project: treat as success (idempotent), set alreadyAttached.
//   - 409 different project: return ALREADY_ON_OTHER_PROJECT so the UI can
//     tell the operator they need to release it on the other Vercel project
//     before retrying.
// ---------------------------------------------------------------------------

export async function addDomainToProject(
  rawHostname: string,
): Promise<AddDomainResult> {
  const hostname = normalizeHostname(rawHostname);
  if (!isValidHostname(hostname)) {
    return {
      ok: false,
      code: "INVALID_HOSTNAME",
      error: `"${rawHostname}" is not a valid hostname.`,
    };
  }

  const url = appendQs(
    `${VERCEL_API}/v10/projects/${projectId()}/domains`,
    teamQs(),
  );
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name: hostname }),
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      code: "API_ERROR",
      error: `Network error talking to Vercel: ${(err as Error).message}`,
    };
  }

  if (res.ok) {
    const domain = (await res.json()) as VercelDomain;
    return {
      ok: true,
      domain,
      alreadyAttached: false,
      dnsRecords: buildDnsRecords(hostname, domain),
    };
  }

  // 409 = either already on this project (fine, treat as idempotent), or on
  // another. Disambiguate by GET'ing the current binding.
  if (res.status === 409) {
    const existing = await getDomainStatus(hostname).catch(() => null);
    if (existing && existing.projectId === projectId()) {
      return {
        ok: true,
        domain: existing,
        alreadyAttached: true,
        dnsRecords: buildDnsRecords(hostname, existing),
      };
    }
    return {
      ok: false,
      code: "ALREADY_ON_OTHER_PROJECT",
      error: `Hostname ${hostname} is already attached to another Vercel project. Release it on that project, then retry.`,
    };
  }

  const body = await res.text().catch(() => "");
  return {
    ok: false,
    code: "API_ERROR",
    error: `Vercel returned ${res.status}: ${body.slice(0, 300)}`,
  };
}

function buildDnsRecords(
  hostname: string,
  domain: VercelDomain,
): DnsRecordHint[] {
  const records: DnsRecordHint[] = [];

  // Vercel's verification[] only appears when ownership challenges are
  // outstanding. When present they always take precedence; without them DNS
  // is the only thing required.
  if (domain.verification && domain.verification.length > 0) {
    for (const v of domain.verification) {
      records.push({
        type: (v.type === "TXT" ? "TXT" : "TXT") as DnsRecordHint["type"],
        host: v.domain,
        value: v.value,
        reason: v.reason ?? "Required by Vercel to prove ownership.",
      });
    }
  }

  records.push(...dnsHintsForHost(hostname));
  return records;
}

// ---------------------------------------------------------------------------
// removeDomainFromProject — DELETE /v9/projects/{projectId}/domains/{name}
// ---------------------------------------------------------------------------

export type RemoveDomainResult =
  | { ok: true }
  | { ok: false; error: string };

export async function removeDomainFromProject(
  rawHostname: string,
): Promise<RemoveDomainResult> {
  const hostname = normalizeHostname(rawHostname);
  const url = appendQs(
    `${VERCEL_API}/v9/projects/${projectId()}/domains/${encodeURIComponent(
      hostname,
    )}`,
    teamQs(),
  );
  const res = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(),
    cache: "no-store",
  });
  // 404 = already gone; treat as success so removeClientDomain can still
  // tear down the local row even if Vercel state has drifted.
  if (res.ok || res.status === 404) return { ok: true };
  const body = await res.text().catch(() => "");
  return {
    ok: false,
    error: `Vercel returned ${res.status}: ${body.slice(0, 300)}`,
  };
}

// ---------------------------------------------------------------------------
// getDomainStatus — GET /v9/projects/{projectId}/domains/{name}
// Returns null on 404. Used by the action layer to look up vercelDomainId
// after a successful attach and to refresh status on demand.
// ---------------------------------------------------------------------------

export async function getDomainStatus(
  rawHostname: string,
): Promise<VercelDomain | null> {
  const hostname = normalizeHostname(rawHostname);
  const url = appendQs(
    `${VERCEL_API}/v9/projects/${projectId()}/domains/${encodeURIComponent(
      hostname,
    )}`,
    teamQs(),
  );
  const res = await fetch(url, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`getDomainStatus(${hostname}) failed, ${res.status}: ${body}`);
  }
  return (await res.json()) as VercelDomain;
}

// ---------------------------------------------------------------------------
// getDomainConfig — GET /v6/domains/{name}/config
//
// Tells us whether the *current* public DNS for the hostname is pointing at
// Vercel correctly. `misconfigured: false` is what we map to dnsConfigured
// in the local DomainBinding row. This is distinct from the verification
// challenges, which prove ownership.
// ---------------------------------------------------------------------------

export async function getDomainConfig(
  rawHostname: string,
): Promise<VercelDomainConfig> {
  const hostname = normalizeHostname(rawHostname);
  const url = appendQs(
    `${VERCEL_API}/v6/domains/${encodeURIComponent(hostname)}/config`,
    teamQs(),
  );
  const res = await fetch(url, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`getDomainConfig(${hostname}) failed, ${res.status}: ${body}`);
  }
  return (await res.json()) as VercelDomainConfig;
}

// ---------------------------------------------------------------------------
// verifyDomain — POST /v9/projects/{projectId}/domains/{name}/verify
//
// Forces Vercel to re-check the verification challenges. Returns the latest
// verification records (if still failing) or verified: true on success.
// ---------------------------------------------------------------------------

export type VerifyDomainResult = {
  verified: boolean;
  domain: VercelDomain | null;
  raw: unknown;
};

export async function verifyDomain(
  rawHostname: string,
): Promise<VerifyDomainResult> {
  const hostname = normalizeHostname(rawHostname);
  const url = appendQs(
    `${VERCEL_API}/v9/projects/${projectId()}/domains/${encodeURIComponent(
      hostname,
    )}/verify`,
    teamQs(),
  );
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    cache: "no-store",
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { verified: false, domain: null, raw };
  }
  const r = raw as VercelDomain;
  return { verified: !!r.verified, domain: r, raw };
}

// ---------------------------------------------------------------------------
// computeSslStatus — turn the verified + misconfigured signals into the
// shorthand we persist on DomainBinding.sslStatus. Vercel auto-issues certs
// once both flags are clean, so "active" is a reasonable shorthand.
// ---------------------------------------------------------------------------

export function computeSslStatus(
  verified: boolean,
  misconfigured: boolean,
): "pending" | "active" | "failed" {
  if (verified && !misconfigured) return "active";
  if (misconfigured) return "failed";
  return "pending";
}
