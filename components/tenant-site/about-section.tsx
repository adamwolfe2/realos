export function AboutSection({
  headline,
  copy,
}: {
  headline?: string;
  copy: string;
}) {
  return (
    <section className="max-w-3xl mx-auto px-4 md:px-6 py-20">
      <h2 className="font-serif text-3xl md:text-4xl font-bold mb-6">
        {headline ?? "About this community"}
      </h2>
      <div className="text-base leading-relaxed opacity-90 whitespace-pre-wrap">
        {copy}
      </div>
    </section>
  );
}
