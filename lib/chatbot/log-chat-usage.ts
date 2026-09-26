import "server-only";
import { logUsage } from "@/lib/cost-tracker/log";

// Haiku 4.5 list price: $1/MTok input, $5/MTok output (same rate
// extract-prospect-profile logs at). Keeps chatbot spend on /admin/costs.
const INPUT_USD_PER_TOKEN = 1 / 1_000_000;
const OUTPUT_USD_PER_TOKEN = 5 / 1_000_000;

export async function logChatUsage(args: {
  endpoint: string;
  model: string;
  orgId?: string | null;
  propertyId?: string | null;
  startedAt: number;
  usage: { inputTokens?: number; outputTokens?: number } | undefined;
}): Promise<void> {
  const inputTokens = args.usage?.inputTokens ?? 0;
  const outputTokens = args.usage?.outputTokens ?? 0;
  await logUsage({
    provider: "anthropic",
    endpoint: `${args.endpoint}[${args.model}]`,
    status: "SUCCESS",
    costUsd:
      inputTokens * INPUT_USD_PER_TOKEN + outputTokens * OUTPUT_USD_PER_TOKEN,
    orgId: args.orgId ?? null,
    propertyId: args.propertyId ?? null,
    durationMs: Date.now() - args.startedAt,
    meta: { surface: "chatbot", model: args.model, inputTokens, outputTokens },
  });
}
