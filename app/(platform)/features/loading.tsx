// Skeleton frame rendered while /features hydrates. Mirrors the real
// page's hero + two spotlight splits so the layout stays stable while
// the artifacts stream in.

export default function FeaturesLoading() {
  return (
    <div style={{ backgroundColor: "#FFFFFF" }} aria-busy="true">
      {/* Hero skeleton */}
      <section>
        <div className="max-w-[900px] mx-auto px-4 md:px-8 pt-20 md:pt-24 pb-16 text-center">
          <Shimmer width={120} height={12} className="mx-auto" />
          <Shimmer
            width={520}
            height={56}
            className="mx-auto mt-5 max-w-full"
            radius={4}
          />
          <Shimmer
            width={380}
            height={20}
            className="mx-auto mt-6 max-w-full"
          />
        </div>
      </section>

      {/* Two spotlight-split skeletons */}
      {[0, 1].map((i) => (
        <section key={i} style={{ backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#f4f4f4" }}>
          <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="max-w-xl">
                <Shimmer
                  width={420}
                  height={36}
                  className="max-w-full"
                  radius={4}
                />
                <Shimmer
                  width={400}
                  height={16}
                  className="mt-5 max-w-full"
                />
                <Shimmer
                  width={340}
                  height={16}
                  className="mt-2 max-w-full"
                />
                <div className="mt-6 space-y-3">
                  <Shimmer width={280} height={14} className="max-w-full" />
                  <Shimmer width={300} height={14} className="max-w-full" />
                  <Shimmer width={260} height={14} className="max-w-full" />
                </div>
              </div>
              <div className="min-w-0">
                <div
                  className="rounded-[28px] p-8 md:p-14"
                  style={{
                    background:
                      "linear-gradient(135deg, #E6F0FF 0%, #D6E4FF 50%, #B8CDFF 100%)",
                    boxShadow:
                      "0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px rgba(37, 99, 235, 0.08)",
                  }}
                >
                  <div
                    className="rounded-2xl bg-white"
                    style={{
                      minHeight: 360,
                      boxShadow:
                        "0 4px 12px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

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
          "linear-gradient(90deg, #f4f4f4 0%, #e0e0e0 50%, #f4f4f4 100%)",
        backgroundSize: "200% 100%",
        animation: "leasestack-shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}
