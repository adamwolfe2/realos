// Pure JSON parsing helper for Google service account credentials. Lives
// outside gsc.ts / ga4.ts so it can be unit-tested without needing a node
// runtime that supports `import "server-only"`.

export type ParsedServiceAccount = {
  raw: string;
  email: string | null;
  projectId: string | null;
};

export function parseServiceAccountJson(input: string): ParsedServiceAccount {
  let parsed: { client_email?: string; project_id?: string };
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("Service account JSON is not valid JSON.");
  }
  if (!parsed.client_email || !parsed.project_id) {
    throw new Error(
      "Service account JSON is missing client_email or project_id. Re-download from Google Cloud Console.",
    );
  }
  return {
    raw: input,
    email: parsed.client_email ?? null,
    projectId: parsed.project_id ?? null,
  };
}
