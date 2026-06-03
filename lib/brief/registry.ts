import "server-only";

// ---------------------------------------------------------------------------
// Prospect-brief token registry.
//
// /brief/[token]/page.tsx looks tokens up here to map a random URL slug
// to the JSON file under prospects/. The token is the only auth — anyone
// with the URL can view the brief. That's the point: paste the URL into
// an email, the prospect opens it from any browser, no login wall.
//
// Tokens are 24-char URL-safe random strings generated with
//   node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"
// Treat as long-lived. Rotate by adding a new entry and emailing the
// new URL; don't delete the old one until the prospect has clicked.
// ---------------------------------------------------------------------------

export type BriefRegistryEntry = {
  /** Display name on the brief shell. */
  prospectName: string;
  /** Path under prospects/ (no extension). */
  dataFile: "255-cal";
};

export const BRIEF_REGISTRY: Record<string, BriefRegistryEntry> = {
  PgV3Av3WmG8o10bf_YJQB3a_: {
    prospectName: "255 Cal",
    dataFile: "255-cal",
  },
};
