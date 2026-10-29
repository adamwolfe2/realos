import { describe, expect, it } from "vitest";
import { excerptExchange } from "@/lib/chatbot/learning/evidence";

describe("excerptExchange", () => {
  it("returns the first renter question and the reply after it", () => {
    expect(
      excerptExchange([
        { role: "assistant", content: "Hi! How can I help?" },
        { role: "user", content: "  How much is a 2 bedroom? " },
        { role: "assistant", content: "I'd be happy to help with that!" },
      ]),
    ).toEqual({ question: "How much is a 2 bedroom?", reply: "I'd be happy to help with that!" });
  });

  it("handles a question with no reply and non-array input", () => {
    expect(excerptExchange([{ role: "user", content: "Pets?" }])).toEqual({ question: "Pets?", reply: null });
    expect(excerptExchange(null)).toBeNull();
    expect(excerptExchange([{ role: "assistant", content: "Hi" }])).toBeNull();
  });
});
