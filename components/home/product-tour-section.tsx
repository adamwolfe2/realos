import { ProductTour } from "@/components/product-tour";

export function ProductTourSection() {
  return (
    <section id="product-tour" style={{ backgroundColor: "#F1F5F9", borderTop: "1px solid #E2E8F0" }}>
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-20 pb-20 md:pb-28 md:pt-24">
        <div className="max-w-3xl mb-10 md:mb-12">
          <p className="eyebrow mb-4">Interactive preview</p>
          <h2 className="heading-section" style={{ color: "#1E2A3A" }}>
            Click through the operator portal.
          </h2>
          <p
            className="mt-4 max-w-2xl"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "17px",
              lineHeight: 1.6,
              color: "#64748B",
            }}
          >
            Every tab in the sidebar below is a real surface in the platform.
            Open a lead. Read a chatbot conversation. Filter the creative
            queue. This is what ships on day one.
          </p>
        </div>
        <ProductTour />
      </div>
    </section>
  );
}
