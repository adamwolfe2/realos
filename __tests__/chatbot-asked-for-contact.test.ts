import { describe, expect, it } from "vitest";
import { askedForContactLastTurn } from "@/lib/chatbot/asked-for-contact";

const convo = (assistant: string) => [
  { role: "user" as const, content: "Children allowed?" },
  { role: "assistant" as const, content: assistant },
  { role: "user" as const, content: "3" },
];

describe("askedForContactLastTurn", () => {
  it("detects a contact question in the last bot reply", () => {
    expect(askedForContactLastTurn(convo("I don't have that. Want me to have the team text you? What's a good number?"))).toBe(true);
    expect(askedForContactLastTurn(convo("What's the best way for them to reach you?"))).toBe(true);
    expect(askedForContactLastTurn(convo("Can I grab your email to send floor plans?"))).toBe(true);
  });
  it("ignores our own number given as a statement, and non-contact questions", () => {
    expect(askedForContactLastTurn(convo("You can call the team at (510) 770-6539. How many bedrooms do you need?"))).toBe(false);
    expect(askedForContactLastTurn(convo("Are you looking to move in soon?"))).toBe(false);
  });
  it("false when the bot has not replied yet", () => {
    expect(askedForContactLastTurn([{ role: "user", content: "hi" }])).toBe(false);
  });
});

describe("consent is not an ignored ask", () => {
  it("'yes' / 'sure' after a contact offer lets the bot collect the number", () => {
    const msgs = (reply: string) => [
      { role: "user" as const, content: "Do you allow pets?" },
      { role: "assistant" as const, content: "I don't have that. Want me to have the team text you the answer?" },
      { role: "user" as const, content: reply },
    ];
    expect(askedForContactLastTurn(msgs("yes"))).toBe(false);
    expect(askedForContactLastTurn(msgs("Sure, that works"))).toBe(false);
    expect(askedForContactLastTurn(msgs("Yes please!"))).toBe(false);
    expect(askedForContactLastTurn(msgs("3"))).toBe(true);
    expect(askedForContactLastTurn(msgs("what about parking?"))).toBe(true);
  });
});
