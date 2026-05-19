/**
 * Zillow URL validation. We accept the canonical detail URL shape:
 *
 *   https://www.zillow.com/homedetails/<slug>/<zpid>_zpid/
 *   https://www.zillow.com/homes/<slug>/<zpid>_zpid/
 *   https://www.zillow.com/b/<zpid>_zpid/                 (building-level)
 *
 * Any of these must be HTTPS and live on a zillow.com host (apex or
 * subdomain). We pull the zpid out of the path so the caller can store
 * a canonical identifier alongside the raw URL.
 */

const ZPID_REGEX = /\/(\d+)_zpid\b/i;

export type ZillowUrlParts = {
  url: string;
  host: string;
  zpid: string;
};

export function isZillowHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "zillow.com" || h.endsWith(".zillow.com");
}

/**
 * Returns parts if the URL is a valid HTTPS Zillow detail URL, else null.
 * This is the single source of truth for "looks like a Zillow listing."
 */
export function parseZillowUrl(input: string): ZillowUrlParts | null {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (!isZillowHost(parsed.hostname)) return null;

  const match = parsed.pathname.match(ZPID_REGEX);
  if (!match) return null;
  const zpid = match[1];
  if (!zpid || !/^\d+$/.test(zpid)) return null;

  return {
    url: parsed.toString(),
    host: parsed.hostname.toLowerCase(),
    zpid,
  };
}
