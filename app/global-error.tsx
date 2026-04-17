"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Georgia, serif", background: "#F9F7F4", color: "#0A0A0A", padding: "4rem 2rem", maxWidth: "600px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Something went wrong</h1>
        <p style={{ color: "#C8C0B4", marginBottom: "2rem" }}>
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={() => reset()}
          style={{
            background: "#0A0A0A",
            color: "#F9F7F4",
            border: "none",
            padding: "0.75rem 1.5rem",
            cursor: "pointer",
            fontFamily: "Georgia, serif",
            fontSize: "1rem",
          }}
        >
          Try again
        </button>
        {error.digest && (
          <p style={{ color: "#C8C0B4", fontSize: "0.875rem", marginTop: "2rem" }}>
            Error ID: {error.digest}
          </p>
        )}
      </body>
    </html>
  )
}
