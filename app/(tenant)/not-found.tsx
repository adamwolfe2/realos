// Tenant marketing site 404 boundary. Triggered when middleware can't resolve
// a hostname to a tenant org, or when a tenant subroute doesn't exist.
export default function TenantNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-white text-slate-900">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-4">
        404
      </p>
      <h1 className="font-serif text-3xl sm:text-4xl mb-3 text-center text-slate-900">
        Page not found.
      </h1>
      <p className="font-mono text-sm mb-8 max-w-md text-center leading-relaxed text-slate-600">
        This page does not exist or was moved.
      </p>
      <a
        href="/"
        className="font-mono text-xs font-semibold px-5 py-3 rounded text-white uppercase tracking-wider"
        style={{ backgroundColor: "var(--tenant-primary, #111827)" }}
      >
        Back to home
      </a>
    </div>
  );
}
