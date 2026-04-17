import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/email/lead-sequences";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UnsubPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; token?: string }>;
}) {
  const { lead, token } = await searchParams;
  if (!lead || !token) {
    return (
      <Layout>
        <h1 className="font-serif text-3xl font-bold">Invalid unsubscribe link</h1>
        <p className="opacity-70 mt-2">
          Check the email this link came from, or reply asking to be removed.
        </p>
      </Layout>
    );
  }

  const ok = verifyUnsubscribeToken(lead, token);
  if (!ok) {
    return (
      <Layout>
        <h1 className="font-serif text-3xl font-bold">Link is expired or wrong</h1>
        <p className="opacity-70 mt-2">
          Reply to any email you've received from us and we'll take you off the
          list manually within one business day.
        </p>
      </Layout>
    );
  }

  await prisma.lead
    .update({
      where: { id: lead },
      data: {
        unsubscribedFromEmails: true,
        unsubscribedAt: new Date(),
      },
    })
    .catch(() => null);

  return (
    <Layout>
      <h1 className="font-serif text-3xl font-bold">You're unsubscribed</h1>
      <p className="opacity-70 mt-2">
        Sorry to see you go. No more automated emails from us.
      </p>
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-24">
      <div className="max-w-md w-full text-center">{children}</div>
    </main>
  );
}
