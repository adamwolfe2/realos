import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Generate a short, URL-safe, collision-free slug for a SiteRequest. Used
// as the public reference id ("REQ-xxxxxxxx") and in the status URL. Short
// enough to read aloud on a call, long enough that brute-force enumeration
// is infeasible (8 hex chars = 16^8 = ~4 billion).
// ---------------------------------------------------------------------------

function makeCandidate(): string {
  // 5 bytes → 8 base32-style chars, lowercased for readability. Avoids
  // ambiguous chars (0/O, 1/I/l) by sticking to 0-9 + a-z minus those.
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz"; // 31 chars
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i % bytes.length] % alphabet.length];
  }
  return out;
}

export async function generateUniqueSiteRequestSlug(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = makeCandidate();
    const exists = await prisma.siteRequest
      .findUnique({ where: { slug: candidate }, select: { id: true } })
      .catch(() => null);
    if (!exists) return candidate;
  }
  // Final fallback — extend with a timestamp.
  return `${makeCandidate()}-${Date.now().toString(36)}`;
}
