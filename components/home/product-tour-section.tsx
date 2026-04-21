import { ProductTour } from "@/components/product-tour";

export function ProductTourSection() {
  return (
    <section id="product-tour" style={{ backgroundColor: "#faf9f5", borderTop: "1px solid #f0eee6" }}>
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-20 pb-20 md:pb-28 md:pt-24">
        <div className="text-center mb-8 md:mb-10 max-w-[720px] mx-auto">
          <p className="eyebrow mb-4">Interactive preview</p>
          <h2 className="heading-section" style={{ color: "#141413" }}>
            Click through the actual portal.
          </h2>
          <p
            className="mt-3 mx-auto"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              lineHeight: 1.6,
              color: "#5e5d59",
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
