"use client";

import { useEffect } from "react";
import Script from "next/script";
import { useUser } from "@clerk/nextjs";

const CRISP_WEBSITE_ID = "2539aaab-caa5-4244-8a1b-b2a2826bf929";

declare global {
  interface Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
  }
}

// Identifies the signed-in Clerk user inside Crisp so support has context.
// Falls back to anonymous visitor when no user is present (marketing site).
function CrispUserIdentifier() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (typeof window === "undefined") return;
    const crisp = window.$crisp;
    if (!crisp) return;

    if (user) {
      const email = user.primaryEmailAddress?.emailAddress;
      const name = user.fullName ?? user.username ?? undefined;
      if (email) crisp.push(["set", "user:email", [email]]);
      if (name) crisp.push(["set", "user:nickname", [name]]);
      crisp.push([
        "set",
        "session:data",
        [[["user_id", user.id]]],
      ]);
    }
  }, [user, isLoaded]);

  return null;
}

export function CrispChat() {
  return (
    <>
      <Script
        id="crisp-chat-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.$crisp=[];window.CRISP_WEBSITE_ID="${CRISP_WEBSITE_ID}";(function(){var d=document;var s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();`,
        }}
      />
      <CrispUserIdentifier />
    </>
  );
}
