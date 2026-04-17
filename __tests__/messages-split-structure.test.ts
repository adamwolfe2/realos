import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Structural tests for the admin messages page split.
 * Verifies all 6 files exist, messages-admin-client.tsx imports children,
 * message-utils.ts exports helper functions, and all component files
 * are 'use client'.
 */

const MESSAGES_DIR = path.resolve(__dirname, "../app/admin/messages");

const EXPECTED_FILES = [
  "messages-admin-client.tsx",
  "message-utils.ts",
  "message-list.tsx",
  "message-thread.tsx",
  "new-conversation-dialog.tsx",
  "message-composer.tsx",
];

describe("messages split — file existence", () => {
  it(`has all ${EXPECTED_FILES.length} expected files`, () => {
    const missing = EXPECTED_FILES.filter(
      (f) => !fs.existsSync(path.join(MESSAGES_DIR, f))
    );
    expect(missing).toEqual([]);
  });

  for (const file of EXPECTED_FILES) {
    it(`${file} exists`, () => {
      expect(fs.existsSync(path.join(MESSAGES_DIR, file))).toBe(true);
    });
  }
});

describe("messages-admin-client.tsx imports child components", () => {
  const clientContent = fs.readFileSync(
    path.join(MESSAGES_DIR, "messages-admin-client.tsx"),
    "utf-8"
  );

  const CHILD_IMPORTS = [
    "MessageList",
    "MessageThread",
    "NewConversationDialog",
  ];

  for (const name of CHILD_IMPORTS) {
    it(`imports ${name}`, () => {
      expect(clientContent).toContain(name);
    });
  }

  it("imports from message-utils", () => {
    expect(clientContent).toContain("message-utils");
  });

  it("exports MessagesAdminClient", () => {
    expect(clientContent).toContain("export function MessagesAdminClient");
  });
});

describe("message-utils.ts exports helper functions", () => {
  const utilsContent = fs.readFileSync(
    path.join(MESSAGES_DIR, "message-utils.ts"),
    "utf-8"
  );

  it("exports formatTimestamp", () => {
    expect(utilsContent).toContain("export function formatTimestamp");
  });

  it("exports getResponseTime", () => {
    expect(utilsContent).toContain("export function getResponseTime");
  });

  it("exports formatReadAt", () => {
    expect(utilsContent).toContain("export function formatReadAt");
  });

  it("exports THREAD_POLL_MS constant", () => {
    expect(utilsContent).toContain("export const THREAD_POLL_MS");
  });

  it("exports LIST_POLL_MS constant", () => {
    expect(utilsContent).toContain("export const LIST_POLL_MS");
  });

  it("exports Message interface", () => {
    expect(utilsContent).toContain("export interface Message");
  });

  it("exports FullConversation interface", () => {
    expect(utilsContent).toContain("export interface FullConversation");
  });

  it("exports OrgOption interface", () => {
    expect(utilsContent).toContain("export interface OrgOption");
  });
});

describe("message component files are 'use client'", () => {
  const CLIENT_FILES = [
    "messages-admin-client.tsx",
    "message-list.tsx",
    "message-thread.tsx",
    "new-conversation-dialog.tsx",
    "message-composer.tsx",
  ];

  for (const file of CLIENT_FILES) {
    it(`${file} has 'use client' directive`, () => {
      const content = fs.readFileSync(
        path.join(MESSAGES_DIR, file),
        "utf-8"
      );
      expect(content).toMatch(/^['"]use client['"]/m);
    });
  }
});
