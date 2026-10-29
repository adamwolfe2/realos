import { redirect } from "next/navigation";

// Connecting data lives in the setup walkthrough now (one place, per
// property). Kept as a redirect: many pages and emails link here. The
// OAuth account pickers under /portal/connect/*/select are unchanged.
export default function ConnectPage() {
  redirect("/portal/setup");
}
