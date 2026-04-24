// Pure JSON parsing helper for Google service account credentials. Lives
// outside gsc.ts / ga4.ts so it can be unit-tested without needing a node
// runtime that supports `import "server-only"`.
//
// Handles the common paste-into-env-var mistake where the private_key value
// contains real newline characters instead of the JSON-escaped "\n" form.
// JSON.parse rejects raw control characters inside string literals, so we
// detect that failure and escape offending newlines / carriage returns /
// tabs before trying again.

export type ParsedServiceAccount = {
  raw: string;
  email: string | null;
  projectId: string | null;
};

type RawCreds = {
  client_email?: string;
  project_id?: string;
  private_key?: string;
};

function tryParse(input: string): RawCreds | null {
  try {
    return JSON.parse(input) as RawCreds;
  } catch {
    return null;
  }
}

/**
 * Walk the input character by character, tracking whether we're inside a
 * quoted JSON string. Inside strings, replace raw newline / carriage return /
 * tab characters with their JSON-escaped form. A naive regex would break
 * the structure. Also honors existing backslash escapes so we don't double-
 * escape already-correct sequences.
 */
function escapeControlCharsInStrings(input: string): string {
  let out = "";
  let inString = false;
  let prevBackslash = false;
  for (const ch of input) {
    if (inString) {
      if (prevBackslash) {
        out += ch;
        prevBackslash = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        prevBackslash = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      out += ch;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    out += ch;
  }
  return out;
}

export function parseServiceAccountJson(input: string): ParsedServiceAccount {
  let parsed = tryParse(input);
  let canonicalRaw = input;

  if (!parsed) {
    // Fallback: JSON likely contains raw newlines inside the private_key
    // value because someone pasted a PEM key into a Vercel env var. Escape
    // real control chars inside string literals and try again.
    const sanitised = escapeControlCharsInStrings(input);
    parsed = tryParse(sanitised);
    if (!parsed) {
      throw new Error("Service account JSON is not valid JSON.");
    }
    canonicalRaw = sanitised;
  }

  if (!parsed.client_email || !parsed.project_id) {
    throw new Error(
      "Service account JSON is missing client_email or project_id. Re-download from Google Cloud Console.",
    );
  }

  // Re-serialise so downstream consumers that JSON.parse again always see a
  // clean, well-formed payload (private_key newlines encoded as "\\n").
  const reserialised = JSON.stringify(parsed);

  return {
    raw: reserialised,
    email: parsed.client_email,
    projectId: parsed.project_id,
  };
}
