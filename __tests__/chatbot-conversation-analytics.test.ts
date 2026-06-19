import { describe, it, expect } from "vitest";
import {
  extractFirstUserMessage,
  extractUserText,
  tokenize,
  topKeywords,
  topQuestions,
} from "@/lib/chatbot/conversation-analytics";

describe("chatbot conversation analytics helpers", () => {
  const convo = [
    { role: "assistant", content: "Hi! How can I help?" },
    { role: "user", content: "Do you allow pets in the studio?" },
    { role: "assistant", content: "Yes, with a deposit." },
    { role: "user", content: "What's the pet deposit?" },
  ];

  it("extractFirstUserMessage returns the first user-typed message", () => {
    expect(extractFirstUserMessage(convo)).toBe("Do you allow pets in the studio?");
    expect(extractFirstUserMessage([])).toBeNull();
    expect(extractFirstUserMessage(null)).toBeNull();
    expect(extractFirstUserMessage([{ role: "assistant", content: "hi" }])).toBeNull();
  });

  it("extractUserText joins only user messages", () => {
    expect(extractUserText(convo)).toBe(
      "Do you allow pets in the studio? What's the pet deposit?",
    );
    expect(extractUserText("nope")).toBe("");
  });

  it("tokenize drops stopwords, short words, and pure numbers", () => {
    expect(tokenize("Do you allow pets in the studio for 2 people?")).toEqual([
      "allow",
      "pets",
      "studio",
      "people",
    ]);
  });

  it("topKeywords counts each term once per conversation", () => {
    const texts = [
      "pets pets pets allowed", // counts pets once despite repetition
      "pets deposit parking",
      "parking available",
    ];
    const kw = topKeywords(texts, 10);
    const map = Object.fromEntries(kw.map((k) => [k.term, k.count]));
    expect(map.pets).toBe(2); // once per conversation it appears in (1 + 2)
    expect(map.parking).toBe(2);
    expect(map.deposit).toBe(1);
  });

  it("topQuestions collapses punctuation/case variants and ranks by frequency", () => {
    const qs = [
      "What's included?",
      "whats included",
      "What's Included!",
      "Do you have parking?",
    ];
    const top = topQuestions(qs, 5);
    // The three "what's included" variants collapse to one group of 3
    // (punctuation + case normalized; contractions are NOT expanded).
    expect(top[0].count).toBe(3);
    expect(top[0].question).toBe("What's included?"); // readable verbatim kept
    expect(top.find((q) => q.question === "Do you have parking?")?.count).toBe(1);
  });

  it("topQuestions skips noise (too short) and essays (too long)", () => {
    const qs = ["hi", "x".repeat(200), "Is there a gym?"];
    const top = topQuestions(qs);
    expect(top).toHaveLength(1);
    expect(top[0].question).toBe("Is there a gym?");
  });
});
