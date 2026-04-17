import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div className="text-center max-w-lg">
        <p
          className="font-mono text-xs tracking-[0.15em] uppercase mb-4"
          style={{ color: "var(--text-muted)" }}
        >
          404
        </p>
        <h1
          className="font-serif text-4xl md:text-5xl font-normal mb-4"
          style={{ color: "var(--text-headline)" }}
        >
          Page not found
        </h1>
        <p
          className="font-mono text-sm leading-relaxed mb-8"
          style={{ color: "var(--text-body)" }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center font-mono text-sm font-semibold btn-blue"
            style={{ padding: "12px 24px" }}
          >
            Back to Home
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center font-mono text-sm btn-outline"
            style={{ padding: "12px 24px" }}
          >
            Start Intake
          </Link>
        </div>
      </div>
    </main>
  );
}
