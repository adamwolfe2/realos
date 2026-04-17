// ---------------------------------------------------------------------------
// AI Tool definitions for the chatbot + admin chat features.
// Distribution-domain tools (orders, products, analytics, clients) were
// stripped during the hard fork. Real-estate tool executors land in Sprint 09
// alongside the chatbot fork from telegraph-commons.
// ---------------------------------------------------------------------------

import type { Tool } from "@anthropic-ai/sdk/resources/messages";

type ToolInput = Record<string, unknown>;
type ToolContext = { userId: string };

export const toolExecutors: Record<
  string,
  (input: ToolInput, ctx: ToolContext) => Promise<unknown>
> = {};

export const anthropicTools: Tool[] = [];
