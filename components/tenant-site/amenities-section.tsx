export function AmenitiesSection({
  amenities,
  headline,
}: {
  amenities: string[];
  headline?: string;
}) {
  if (amenities.length === 0) return null;
  return (
    <section className="bg-slate-50 border-y">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20">
        <h2 className="font-serif text-3xl md:text-4xl font-bold">
          {headline ?? "What's included"}
        </h2>
        <ul className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {amenities.map((item) => (
            <li
              key={item}
              className="border rounded-md px-4 py-3 bg-white"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
