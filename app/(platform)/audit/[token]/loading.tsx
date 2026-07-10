// Skeleton frame rendered while /audit/[token] loads the audit row.
// Mirrors the report layout — brief header bar, DPS hero, pillar grid —
// so the page doesn't flash blank while Prisma resolves.

export default function AuditViewerLoading() {
  return (
    <div style={{ backgroundColor: "#FFFFFF" }} aria-busy="true">
      {/* Brief-shell header skeleton */}
      <div style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="max-w-[1080px] mx-auto px-4 md:px-6 py-5 flex items-center justify-between gap-4">
          <Shimmer width={220} height={16} />
          <Shimmer width={120} height={12} />
        </div>
      </div>

      <div className="max-w-[1080px] mx-auto px-4 md:px-6 pt-10 md:pt-12 pb-12">
        {/* DPS hero skeleton */}
        <div
          className="p-6 md:p-8"
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "2px",
          }}
        >
          <Shimmer width={140} height={12} />
          <div className="mt-5 flex items-center gap-6 flex-wrap">
            <Shimmer width={120} height={120} radius={60} />
            <div className="flex-1 min-w-[220px]">
              <Shimmer width={320} height={28} className="max-w-full" />
              <Shimmer width={260} height={14} className="mt-3 max-w-full" />
              <Shimmer width={220} height={14} className="mt-2 max-w-full" />
            </div>
          </div>
        </div>

        {/* Pillar grid skeleton */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="p-5"
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "2px",
              }}
            >
              <Shimmer width={110} height={11} />
              <Shimmer width={64} height={30} className="mt-3" />
              <Shimmer width={150} height={12} className="mt-3 max-w-full" />
            </div>
          ))}
        </div>

        {/* Sections skeleton */}
        <div className="mt-6 space-y-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="p-6"
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "2px",
              }}
            >
              <Shimmer width={180} height={12} />
              <Shimmer width={420} height={16} className="mt-4 max-w-full" />
              <Shimmer width={380} height={14} className="mt-2 max-w-full" />
              <Shimmer width={340} height={14} className="mt-2 max-w-full" />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes leasestack-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

function Shimmer({
  width,
  height,
  className,
  radius = 4,
}: {
  width: number;
  height: number;
  className?: string;
  radius?: number;
}) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius: radius,
        background:
          "linear-gradient(90deg, #F1F5F9 0%, #E2E8F0 50%, #F1F5F9 100%)",
        backgroundSize: "200% 100%",
        animation: "leasestack-shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}
