/**
 * SSRF protection utility.
 * Returns false for any URL that points to a private/loopback address
 * or uses a non-http(s) protocol, blocking server-side request forgery attacks.
 */
export function isAllowedUrl(urlString: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(urlString)
  } catch {
    return false
  }

  const { protocol, hostname } = parsed

  // Only allow http and https
  if (protocol !== 'http:' && protocol !== 'https:') return false

  const host = hostname.toLowerCase()

  // Block localhost
  if (host === 'localhost') return false

  // Block IPv6 loopback
  if (host === '::1' || host === '[::1]') return false

  // Block IPv4 private/loopback/link-local ranges
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const [, a, b] = ipv4.map(Number)
    if (a === 127) return false                       // 127.x.x.x loopback
    if (a === 10) return false                        // 10.x.x.x private
    if (a === 192 && b === 168) return false          // 192.168.x.x private
    if (a === 172 && b >= 16 && b <= 31) return false // 172.16–31.x.x private
    if (a === 169 && b === 254) return false          // 169.254.x.x link-local
    if (a === 0) return false                         // 0.x.x.x
  }

  return true
}
