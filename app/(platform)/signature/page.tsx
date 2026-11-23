import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { BookDemoLink } from "@/components/marketing/book-demo-link";
import { SectionShell, LabelChip } from "@/components/home/section-shell";
import { ProductFrame } from "@/components/home/product-frame";
import { SignatureShowcase } from "@/components/signature/showcase";
import { COMPARE, FAQ, FOR_WHOM, INCLUDED, SIGNATURE_NAME, STEPS } from "@/lib/signature/showcase";

// ---------------------------------------------------------------------------
// /signature — LeaseStack Signature, the premium add-on: an interactive
// building and a private page for every residence, suite or villa.
//
// The page is the builds themselves: a hero screen, the live builds embedded,
// then what each includes shown with real screens. Copy stays short.
//
// Not linked from the nav or the sitemap, and noindex, until Adam launches it
// (flip LAUNCHED). Two of the builds are concepts for properties that are not
// clients; each says so on the page.
// ---------------------------------------------------------------------------

const LAUNCHED = false;

export const metadata: Metadata = {
  title: `${SIGNATURE_NAME}: a private page for every residence`,
  description:
    "The premium add-on to LeaseStack for branded residences, luxury rentals, hotels and resorts. Every home gets its own interactive page, and every enquiry shows what that person looked at.",
  robots: LAUNCHED ? undefined : { index: false, follow: false },
};

const INK = "#161616";
const MUTED = "#6f6f6f";
const BORDER = "#e0e0e0";

const h2: React.CSSProperties = { color: INK, fontFamily: "var(--font-display)", fontSize: "clamp(30px, 4vw, 52px)", fontWeight: 600, lineHeight: 1.05, letterSpacing: "-0.03em" };
const lede: React.CSSProperties = { color: MUTED, fontSize: 18, lineHeight: 1.55, maxWidth: 600 };

export default function SignaturePage() {
  return (
    <div style={{ backgroundColor: "#FFFFFF", color: INK }}>
      <SectionShell>
        <div className="pt-14 md:pt-20 pb-12 md:pb-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)] lg:items-center">
            <div>
              <LabelChip>Premium add-on</LabelChip>
              <h1 className="mt-5" style={{ color: INK, fontFamily: "var(--font-display)", fontSize: "clamp(42px, 5.6vw, 76px)", fontWeight: 550, lineHeight: 1.02, letterSpacing: "-0.04em" }}>
                A private page for every residence.
              </h1>
              <p className="mt-6" style={lede}>
                {SIGNATURE_NAME} turns a building into something a buyer can open: each home on its floor, with its measured plan, its rooms and its view. Your team sends one link. You see what they looked at.
              </p>
              <div className="mt-8 flex flex-col items-stretch sm:flex-row sm:items-center gap-3">
                <BookDemoLink className="btn-primary sm:w-auto" style={{ display: "flex", justifyContent: "center" }}>Book a demo</BookDemoLink>
                <Link href="#builds" className="btn-secondary sm:w-auto" style={{ display: "flex", justifyContent: "center" }}>Explore the live builds</Link>
              </div>
            </div>
            <div className="relative">
              <ProductFrame url="theritzpdx.vercel.app/homes/2810">
                <Image src="/signature/ritz-home.webp" alt="The page for one residence: its living room, its facts and its floor lit on the tower" width={1600} height={878} priority sizes="(max-width: 1024px) 100vw, 700px" style={{ display: "block", width: "100%", height: "auto" }} />
              </ProductFrame>
              <div className="absolute hidden sm:block" style={{ left: -14, bottom: -28, width: "21%", border: "1px solid #d6d6d6", borderRadius: 14, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 24px 48px -16px rgba(22,22,22,0.35)" }}>
                <Image src="/signature/ritz-phone.webp" alt="The same page on a phone, prepared for a named buyer" width={786} height={1704} sizes="160px" style={{ display: "block", width: "100%", height: "auto" }} />
              </div>
              <p className="mt-10 sm:mt-12 sm:pl-[24%]" style={{ color: MUTED, fontSize: 13, lineHeight: 1.5 }}>
                Concept build from publicly published material. Not affiliated with or endorsed by The Ritz-Carlton Hotel Company, Marriott International or the owner of The Residences.
              </p>
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell id="builds" bg="#f7f9fe">
        <div className="py-14 md:py-20">
          <h2 style={h2}>Open one.</h2>
          <p className="mt-4 mb-8" style={lede}>These are working builds, not mock-ups. Pick a property, then explore it live.</p>
          <SignatureShowcase />
        </div>
      </SectionShell>

      <SectionShell>
        <div className="py-14 md:py-20">
          <h2 style={h2}>What every build includes.</h2>
          <p className="mt-4" style={lede}>Each screen below is from the Portland concept build above.</p>
          <ul className="mt-10 grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-12">
            {INCLUDED.map((f) => (
              <li key={f.title}>
                <div style={{ aspectRatio: "16 / 10", overflow: "hidden", border: `1px solid ${BORDER}`, borderRadius: 2, backgroundColor: "#f4f3f1", padding: f.whole ? "5%" : 0 }}>
                  <Image src={f.img} alt={f.alt} width={f.w} height={f.h} sizes="(max-width: 1024px) 50vw, 400px" style={{ display: "block", width: "100%", height: "100%", objectFit: f.whole ? "contain" : "cover", objectPosition: f.whole ? "center" : "top" }} />
                </div>
                <h3 className="mt-3" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(17px, 1.6vw, 22px)", fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.2 }}>{f.title}</h3>
                <p className="mt-1" style={{ color: MUTED, fontSize: 15, lineHeight: 1.45 }}>{f.line}</p>
              </li>
            ))}
          </ul>
        </div>
      </SectionShell>

      <SectionShell bg="#f4f4f4">
        <div className="py-14 md:py-20">
          <h2 style={h2}>A listing page, or this.</h2>
          <div className="mt-8" style={{ backgroundColor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 2 }}>
            <div className="hidden md:grid grid-cols-[1fr_1.15fr_1.35fr] gap-6 px-6 py-3" style={{ borderBottom: `1px solid ${INK}`, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>
              <span />
              <span>A listing page</span>
              <span style={{ color: "#0f43b8" }}>{SIGNATURE_NAME}</span>
            </div>
            {COMPARE.map(([what, before, after], i) => (
              <div key={what} className="grid gap-x-6 gap-y-1.5 px-4 md:px-6 py-4 md:grid-cols-[1fr_1.15fr_1.35fr]" style={{ borderTop: i ? `1px solid ${BORDER}` : undefined }}>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{what}</span>
                <span className="flex items-start gap-2" style={{ color: MUTED, fontSize: 16 }}><X size={17} aria-hidden className="mt-0.5 shrink-0" /><span><span className="sr-only">A listing page: </span>{before}</span></span>
                <span className="flex items-start gap-2" style={{ fontSize: 16 }}><Check size={17} aria-hidden className="mt-0.5 shrink-0" style={{ color: "#0f62fe" }} /><span><span className="sr-only">{SIGNATURE_NAME}: </span>{after}</span></span>
              </div>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell>
        <div className="py-14 md:py-20 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 style={h2}>Built for buildings worth showing.</h2>
            <dl className="mt-8">
              {FOR_WHOM.map(([k, v]) => (
                <div key={k} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[180px_1fr]" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <dt style={{ fontWeight: 600, fontSize: 16 }}>{k}</dt>
                  <dd style={{ color: MUTED, fontSize: 16, lineHeight: 1.5 }}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h2 style={h2}>How it runs.</h2>
            <ol className="mt-8">
              {STEPS.map(([k, v], i) => (
                <li key={k} className="grid grid-cols-[44px_1fr] gap-x-4 py-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#0f43b8", paddingTop: 3 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span>
                    <span className="block" style={{ fontWeight: 600, fontSize: 16 }}>{k}</span>
                    <span className="block mt-1" style={{ color: MUTED, fontSize: 16, lineHeight: 1.5 }}>{v}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </SectionShell>

      <SectionShell bg="#f7f9fe">
        <div className="py-14 md:py-20 grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <h2 style={h2}>Questions.</h2>
          <div>
            {FAQ.map(([q, a]) => (
              <details key={q} className="group" style={{ borderTop: `1px solid ${BORDER}` }}>
                <summary className="cursor-pointer py-4" style={{ fontWeight: 600, fontSize: 17, minHeight: 44 }}>{q}</summary>
                <p className="pb-5" style={{ color: MUTED, fontSize: 16, lineHeight: 1.55, maxWidth: 640 }}>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </SectionShell>

      <SectionShell bg="#f4f4f4">
        <div className="py-16 md:py-24 text-center">
          <h2 className="mx-auto" style={{ ...h2, fontSize: "clamp(36px, 5.4vw, 64px)", maxWidth: 820 }}>See your building this way.</h2>
          <p className="mt-5 mx-auto" style={{ ...lede, maxWidth: 560 }}>Bring one property. We will show you what its first residence page would look like.</p>
          <div className="mt-8 flex justify-center">
            <BookDemoLink className="btn-primary" style={{ display: "inline-flex", justifyContent: "center" }}>Book a demo</BookDemoLink>
          </div>
        </div>
      </SectionShell>
    </div>
  );
}
