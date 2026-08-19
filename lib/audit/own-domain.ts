// Our own hosts. A prospect audit must never be run against LeaseStack
// itself, and a prospect's logo must never resolve to one of our images.
//
// Adam 2026-08-19: a report was generated with property name "Warwick" and
// URL leasestack.co. Every engine got asked about Leasestack, the mentions
// scan found LeaseStack posts, and all of it rendered under the Warwick
// name. Auditing ourselves has no legitimate use — the report only ever
// makes sense pointed at a prospect — so it's refused at the boundary
// rather than left to produce a confusing report.

const OWN_HOSTS = ["leasestack.co", "leasestack.com", "realos.vercel.app"];

/** True when the host is ours, including www. and any subdomain. */
export function isOwnDomain(hostOrDomain: string): boolean {
  const host = hostOrDomain.trim().toLowerCase().replace(/^www\./, "");
  if (!host) return false;
  return OWN_HOSTS.some((own) => host === own || host.endsWith(`.${own}`));
}

/** True when a URL points at one of our hosts. Unparseable → true, so a
 *  caller using this as a guard fails closed. */
export function isOwnUrl(url: string): boolean {
  try {
    return isOwnDomain(new URL(url).hostname);
  } catch {
    return true;
  }
}
