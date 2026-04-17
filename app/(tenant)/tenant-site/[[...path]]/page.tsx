import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTenantFromHeaders } from "@/lib/tenancy/tenant-context";
import { Hero } from "@/components/tenant-site/hero";
import { ValueProps } from "@/components/tenant-site/value-props";
import { ListingsGrid } from "@/components/tenant-site/listings-grid";
import { AmenitiesSection } from "@/components/tenant-site/amenities-section";
import { AboutSection } from "@/components/tenant-site/about-section";
import { ApplyCta } from "@/components/tenant-site/apply-cta";
import { ApplyForm } from "@/components/tenant-site/apply-form";
import Link from "next/link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}): Promise<Metadata> {
  const tenant = await getTenantFromHeaders();
  if (!tenant) return { title: "Not found" };
  const { path: segments } = await params;
  const page = (segments ?? [])[0] ?? "home";
  const config = tenant.tenantSiteConfig;
  const base = config?.metaTitle ?? config?.siteTitle ?? tenant.name;
  const pageTitle = page === "home" ? base : `${titleCase(page)}, ${base}`;
  return {
    title: pageTitle,
    description: config?.metaDescription ?? undefined,
  };
}

export default async function TenantPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const tenant = await getTenantFromHeaders();
  if (!tenant) notFound();

  const { path: segments = [] } = await params;
  const first = segments[0] ?? "home";

  const property = tenant.properties[0];

  switch (first) {
    case "home":
      return <HomePage tenant={tenant} property={property} />;
    case "floor-plans":
      return <FloorPlansPage tenant={tenant} property={property} />;
    case "amenities":
      return <AmenitiesPage tenant={tenant} property={property} />;
    case "gallery":
      return <GalleryPage property={property} />;
    case "location":
      return <LocationPage property={property} />;
    case "contact":
      return <ContactPage tenant={tenant} />;
    case "parents":
      return <ParentsPage tenant={tenant} />;
    case "apply":
      return <ApplyPage tenant={tenant} property={property} />;
    case "schedule":
      return <SchedulePage tenant={tenant} />;
    case "privacy":
      return (
        <LegalPage
          title="Privacy"
          body="This site uses cookies and analytics to deliver a secure, personalized experience. We never sell your contact information. Contact us for a copy of the full privacy policy."
        />
      );
    case "terms":
      return (
        <LegalPage
          title="Terms of use"
          body="By using this site you agree to our standard terms of use. Full terms available on request."
        />
      );
    case "fair-housing":
      return (
        <LegalPage
          title="Fair Housing"
          body="We are committed to equal housing opportunity. We do not discriminate on the basis of race, color, religion, sex, disability, familial status, or national origin."
        />
      );
    default:
      notFound();
  }
}

// ---------------------------------------------------------------------------
// Page renderers
// ---------------------------------------------------------------------------

type TenantProp = {
  tenant: NonNullable<Awaited<ReturnType<typeof getTenantFromHeaders>>>;
  property: NonNullable<
    Awaited<ReturnType<typeof getTenantFromHeaders>>
  >["properties"][number];
};

function HomePage({ tenant, property }: TenantProp) {
  const config = tenant.tenantSiteConfig;
  return (
    <>
      <Hero
        headline={config?.heroHeadline ?? tenant.name}
        subheadline={config?.heroSubheadline}
        imageUrl={config?.heroImageUrl}
        ctaText={config?.primaryCtaText ?? "Apply Now"}
        ctaUrl={config?.primaryCtaUrl ?? "/apply"}
        secondaryCtaText="Schedule a tour"
        secondaryCtaUrl="/schedule"
      />
      <ValueProps />
      {(config?.showListings ?? true) && property ? (
        <ListingsGrid
          property={property}
          listings={property.listings}
          compact
        />
      ) : null}
      {(config?.showAmenities ?? true) && property?.amenities ? (
        <AmenitiesSection amenities={property.amenities as string[]} />
      ) : null}
      {config?.aboutCopy ? <AboutSection copy={config.aboutCopy} /> : null}
      <ApplyCta tenant={tenant} />
    </>
  );
}

function FloorPlansPage({ tenant, property }: TenantProp) {
  if (!property) return <EmptyState title="Floor plans coming soon" />;
  return (
    <div>
      <PageHeader
        eyebrow={tenant.name}
        title="Floor plans"
        subtitle="Every live unit, grouped by layout. Price shown is all-inclusive."
      />
      <ListingsGrid property={property} listings={property.listings} />
      <ApplyCta tenant={tenant} />
    </div>
  );
}

function AmenitiesPage({ tenant, property }: TenantProp) {
  const amenities = Array.isArray(property?.amenities)
    ? (property!.amenities as string[])
    : [];
  return (
    <div>
      <PageHeader
        eyebrow={tenant.name}
        title="Amenities"
        subtitle="What's included in every lease, and the community spaces you can use."
      />
      {amenities.length === 0 ? (
        <EmptyState title="Amenities list coming soon" />
      ) : (
        <AmenitiesSection amenities={amenities} />
      )}
    </div>
  );
}

function GalleryPage({ property }: Pick<TenantProp, "property">) {
  const photos = Array.isArray(property?.photoUrls)
    ? (property!.photoUrls as string[])
    : [];
  return (
    <div>
      <PageHeader title="Gallery" />
      {photos.length === 0 ? (
        <EmptyState title="Photos coming soon" />
      ) : (
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              className="aspect-[4/3] object-cover w-full rounded"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LocationPage({ property }: Pick<TenantProp, "property">) {
  return (
    <div>
      <PageHeader
        title="Location"
        subtitle="Walk score, commute times, and the neighborhood."
      />
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 space-y-4">
        {property?.addressLine1 ? (
          <address className="not-italic text-lg">
            {property.addressLine1}
            <br />
            {property.city}
            {property.state ? `, ${property.state}` : ""}{" "}
            {property.postalCode ?? ""}
          </address>
        ) : (
          <p className="opacity-70">Address coming soon.</p>
        )}
        {property?.latitude != null && property?.longitude != null ? (
          <iframe
            title="Map"
            className="w-full h-[400px] rounded border"
            src={`https://www.google.com/maps?q=${property.latitude},${property.longitude}&hl=en&z=15&output=embed`}
            loading="lazy"
          />
        ) : null}
      </section>
    </div>
  );
}

function ContactPage({ tenant }: Pick<TenantProp, "tenant">) {
  const config = tenant.tenantSiteConfig;
  return (
    <div>
      <PageHeader
        title="Get in touch"
        subtitle="Call, email, or send the form below. We respond the same day."
      />
      <section className="max-w-3xl mx-auto px-4 md:px-6 py-12 space-y-6 text-sm">
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {config?.phoneNumber ? (
            <div>
              <dt className="text-xs tracking-widest uppercase opacity-60 mb-1">
                Phone
              </dt>
              <dd>
                <a
                  className="text-lg font-medium"
                  href={`tel:${config.phoneNumber.replace(/[^0-9+]/g, "")}`}
                >
                  {config.phoneNumber}
                </a>
              </dd>
            </div>
          ) : null}
          {config?.contactEmail ? (
            <div>
              <dt className="text-xs tracking-widest uppercase opacity-60 mb-1">
                Email
              </dt>
              <dd>
                <a
                  className="text-lg font-medium"
                  href={`mailto:${config.contactEmail}`}
                >
                  {config.contactEmail}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
        <ApplyForm
          orgId={tenant.id}
          propertyId={tenant.properties[0]?.id}
          unitTypes={uniqueUnitTypes(tenant)}
          context="contact"
        />
      </section>
    </div>
  );
}

function ParentsPage({ tenant }: Pick<TenantProp, "tenant">) {
  const subtype = tenant.residentialSubtype;
  if (subtype !== "STUDENT_HOUSING") {
    return <EmptyState title="Coming soon" />;
  }
  return (
    <div>
      <PageHeader
        title="Parents + FAQ"
        subtitle="The questions we get most often from parents of prospective residents."
      />
      <section className="max-w-3xl mx-auto px-4 md:px-6 py-12 space-y-6 text-sm">
        {FAQ.map((q) => (
          <details key={q.q} className="border rounded-md p-4 group">
            <summary className="cursor-pointer font-medium">{q.q}</summary>
            <p className="opacity-80 mt-3">{q.a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}

function ApplyPage({ tenant, property }: TenantProp) {
  return (
    <div>
      <PageHeader
        title={`Apply to live at ${tenant.name}`}
        subtitle="Takes about five minutes. We respond within one business day."
      />
      <section className="max-w-2xl mx-auto px-4 md:px-6 py-12">
        <ApplyForm
          orgId={tenant.id}
          propertyId={property?.id}
          unitTypes={uniqueUnitTypes(tenant)}
          context="apply"
        />
      </section>
    </div>
  );
}

function SchedulePage({ tenant }: Pick<TenantProp, "tenant">) {
  const config = tenant.tenantSiteConfig;
  return (
    <div>
      <PageHeader
        title="Schedule a tour"
        subtitle="In-person, virtual, or self-guided. Pick what works for you."
      />
      <section className="max-w-2xl mx-auto px-4 md:px-6 py-12 space-y-6 text-sm">
        <p className="opacity-80">
          Tours typically take 20 minutes. We'll meet you at the lobby and
          walk through a unit that matches your preferences.
        </p>
        <Link
          href={config?.primaryCtaUrl ?? "/apply"}
          className="inline-block px-6 py-3 text-sm font-semibold rounded"
          style={{ backgroundColor: "var(--tenant-primary)", color: "white" }}
        >
          Request a tour
        </Link>
      </section>
    </div>
  );
}

function LegalPage({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <section className="max-w-3xl mx-auto px-4 md:px-6 py-12 text-sm opacity-80 whitespace-pre-wrap">
        {body}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function PageHeader({
  title,
  subtitle,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}) {
  return (
    <header className="max-w-6xl mx-auto px-4 md:px-6 pt-20 pb-8">
      {eyebrow ? (
        <p className="text-xs tracking-widest uppercase opacity-60 mb-2">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-serif text-4xl md:text-5xl font-bold">{title}</h1>
      {subtitle ? (
        <p className="mt-3 text-base opacity-70 max-w-2xl">{subtitle}</p>
      ) : null}
    </header>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-24 text-center">
      <h2 className="font-serif text-2xl font-bold">{title}</h2>
      <p className="opacity-60 mt-2">
        We're finishing this section, check back soon or reach out on the
        contact page.
      </p>
    </div>
  );
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
    .join(" ");
}

function uniqueUnitTypes(
  tenant: NonNullable<Awaited<ReturnType<typeof getTenantFromHeaders>>>
): string[] {
  const set = new Set<string>();
  for (const p of tenant.properties) {
    for (const l of p.listings) {
      if (l.unitType) set.add(l.unitType);
    }
  }
  return Array.from(set);
}

const FAQ = [
  {
    q: "How do I apply?",
    a: "Submit the Apply form and we'll send an application link within one business day. Applications are reviewed in the order received.",
  },
  {
    q: "What's included in rent?",
    a: "Rent includes WiFi, utilities, cable, fully furnished rooms, and weekly tidy-up of common areas. Specific inclusions vary by unit type, see the floor plan detail.",
  },
  {
    q: "What's the lease term?",
    a: "Standard leases are 10 months academic-year. Summer sublets are available separately. Short-term leases can be arranged case by case.",
  },
  {
    q: "Is the building furnished?",
    a: "Yes. Every bedroom includes a bed, desk, and dresser. Common areas are furnished with sofas, dining tables, and kitchen equipment.",
  },
  {
    q: "How do we pay rent?",
    a: "Rent is paid through the AppFolio online portal. ACH, credit card, and autopay are all supported.",
  },
];
