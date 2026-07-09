// ---------------------------------------------------------------------------
// Denial-of-Wallet guards for the public chat endpoints.
//
// The message schema already caps each message at 4000 chars and the array at
// 50 items — but 50 × 4000 = 200K chars (~50K input tokens) PER request, and
// the streamText calls had no output cap at all. An unauthenticated caller can
// spoof a tenant's Origin, pad every request to the max, prompt for a huge
// reply, and run up that tenant's Anthropic bill (the per-org quota only counts
// calls, and fails open during a Redis outage). These two constants bound the
// per-request cost so no single call — authenticated or not — can be expensive.
//
// Legit chatbot turns are short (a few hundred chars each); 40K total chars is
// generous headroom for a full 50-message history without enabling abuse.
// ---------------------------------------------------------------------------

export const MAX_CHAT_INPUT_CHARS = 40_000;
export const MAX_CHAT_OUTPUT_TOKENS = 1024;

export function chatInputChars(
  messages: ReadonlyArray<{ content: string }>,
): number {
  return messages.reduce((sum, m) => sum + m.content.length, 0);
}

/** True when the aggregate input exceeds the per-request budget. */
export function exceedsChatInputBudget(
  messages: ReadonlyArray<{ content: string }>,
): boolean {
  return chatInputChars(messages) > MAX_CHAT_INPUT_CHARS;
}
