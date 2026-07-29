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

// Words that follow "I'm" / "I am" / "this is" far more often than a name does.
// Without this guard "I'm Interested in a single" captures the name
// "Interested", which then lands in capturedName and is greeted by first name
// in the operator's lead email ("Hi Interested,"). A wrong name in a greeting
// is exactly the failure that made visitor-outreach indefensible, so the
// extractor drops anything ambiguous rather than guessing.
const NOT_A_NAME = new Set([
  "interested", "looking", "wondering", "trying", "hoping", "asking",
  "curious", "new", "here", "just", "still", "also", "not", "really",
  "currently", "moving", "planning", "considering", "available", "good",
  "great", "sorry", "okay", "ok", "yes", "no", "thanks", "hi", "hello",
  "hey", "from", "with", "for", "the", "a", "an", "my", "our", "his",
  "her", "their", "your", "it", "that", "this", "he", "she", "they",
  "we", "i", "you", "student", "students", "international", "email",
  "phone", "number", "name",
]);

function sanitizeName(raw: string | undefined): string | undefined {
  const name = raw?.trim();
  if (!name) return undefined;
  const words = name.split(/\s+/);
  // The FIRST word is the one that becomes firstName and gets used in a
  // greeting, so it carries the whole decision. If it isn't plausibly a given
  // name, throw the match away entirely rather than keeping a partial.
  const first = words[0]?.toLowerCase() ?? "";
  if (NOT_A_NAME.has(first)) return undefined;
  if (first.length < 2) return undefined;
  // "I'm looking for a Single" style matches drag a trailing noun in. Keep the
  // first word and only keep the second when it also looks like a surname.
  if (words.length > 1 && NOT_A_NAME.has(words[1]!.toLowerCase())) {
    return words[0];
  }
  return words.join(" ");
}

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
  // The lead-in is matched case-insensitively via explicit character classes
  // rather than the /i flag, because /i would also apply to the capture group
  // and let lowercase words through as names. Previously the whole pattern was
  // case-SENSITIVE, so it only ever fired on a lowercase "i'm" / "my name is"
  // and silently missed the far more common "My name is Priya" / "I'm Sarah".
  const nameMatch = userText.match(
    /(?:[Mm]y name is|[Ii]['\u2019]?m|[Tt]his is|[Ii] am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/
  );

  const name = sanitizeName(nameMatch?.[1]);
  const parts = name ? name.split(/\s+/) : [];

  return {
    email: emailMatch?.[0],
    // The leading [\s.()-]* in the phone pattern happily eats the space before
    // the number, so the raw match can arrive as " 510-462-5442".
    phone: phoneMatch?.[0]?.trim(),
    name,
    firstName: parts[0],
    lastName: parts.slice(1).join(" ") || undefined,
  };
}
