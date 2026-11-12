// Did the bot's previous reply ask the visitor how to reach them?
//
// The prompt tells the model not to ask twice in a row, but replaying real
// transcripts (2026-11-11, Lair/Zillow) showed it asks on every turn anyway
// and even reads "3" (bedrooms) as a failed phone number. So the server
// decides: if the last assistant message asked for contact and the visitor
// replied without giving one, this turn's prompt forbids asking.

const CONTACT_WORDS =
  /\b(phone|number|email|e-mail|text you|reach you|contact (info|details)|best way (to|for)|how (can|should) (we|they|the team) reach)\b/i;

// "yes" to "want the team to text you?" is consent, not an ignored ask: the
// next reply must collect the number (two-step capture), not go quiet.
const CONSENT =
  /^\s*(yes|yeah|yea|yep|yup|sure|ok|okay|please|yes please|sounds good|that works|go ahead|definitely|absolutely|of course|y)\b/i;

export function askedForContactLastTurn(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): boolean {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser && CONSENT.test(lastUser.content)) return false;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    // Only a question about contact counts; mentioning OUR phone number in a
    // statement ("call the team at 510...") is not an ask.
    return m.content.split(/(?<=[.!?])\s+/).some((s) => s.trim().endsWith("?") && CONTACT_WORDS.test(s));
  }
  return false;
}
