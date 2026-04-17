import type { Metadata } from "next";

export const metadata: Metadata = { title: "Conversations" };

// Placeholder. Sprint 09 brings the full chatbot conversation inbox, handoff
// to human, and transcript download.
export default function ConversationsStub() {
  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-3xl font-bold mb-4">Conversations</h1>
      <p className="text-sm opacity-70">
        Sprint 09 forks the chatbot from Telegraph Commons and wires up the
        conversation inbox here. Chats will appear the moment the module is
        live on your marketing site.
      </p>
    </div>
  );
}
