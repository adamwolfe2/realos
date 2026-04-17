// ---------------------------------------------------------------------------
// Heuristic lead-capture extractor. Scans user turns for email, phone, and a
// name. Replaces training a classifier, which would be overkill for v1.
// Intentionally conservative: missing a capture is fine (the agency follows
// up from the conversation log anyway), but we must not invent data.
// ---------------------------------------------------------------------------

export type ExtractedLead = {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

export function extractLeadCapture(
  messages: Array<{ role: string; content: string }>
): ExtractedLead {
  const userText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content ?? "")
    .join(" \n ");

  const emailMatch = userText.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const phoneMatch = userText.match(
    /\+?1?[\s.()-]*\d{3}[\s.()-]*\d{3}[\s.-]?\d{4}/
  );
  const nameMatch = userText.match(
    /(?:my name is|i['\u2019]?m|this is|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/
  );

  const name = nameMatch?.[1]?.trim();
  const parts = name ? name.split(/\s+/) : [];

  return {
    email: emailMatch?.[0],
    phone: phoneMatch?.[0],
    name,
    firstName: parts[0],
    lastName: parts.slice(1).join(" ") || undefined,
  };
}
