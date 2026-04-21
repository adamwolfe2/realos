import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/copy/blog";

export const metadata: Metadata = {
  title: "Blog, real estate marketing notes from the build",
  description:
    "Field notes from shipping a managed marketing platform for real estate operators: identity pixels, AI chatbots, managed ads, and the economics of modern leasing.",
};

export default function BlogIndex() {
  return (
    <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}>
      <header style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-4xl mx-auto px-4 md:px-8 pt-24 pb-14">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.18em] mb-5"
            style={{ color: "var(--text-muted)" }}
          >
            Blog
          </p>
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-[1.05]"
            style={{ color: "var(--text-headline)" }}
          >
            Field notes from the build.
          </h1>
          <p
            className="mt-6 font-mono text-sm md:text-base leading-relaxed max-w-2xl"
            style={{ color: "var(--text-body)" }}
          >
            Short essays about real estate marketing, pricing economics, and
            what we're learning shipping this platform.
          </p>
        </div>
      </header>

      <section>
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-16 space-y-8">
          {BLOG_POSTS.map((post) => (
            <article
              key={post.slug}
              className="p-6 bg-white"
              style={{
                border: "1px solid var(--border-strong)",
                borderRadius: "12px",
              }}
            >
              <Link href={`/blog/${post.slug}`} className="block group">
                <p
                  className="font-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {new Date(post.publishedAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  · {post.readingMinutes} min read
                </p>
                <h2
                  className="font-serif text-2xl md:text-3xl font-normal mt-3 group-hover:opacity-70 transition-opacity"
                  style={{ color: "var(--text-headline)" }}
                >
                  {post.title}
                </h2>
                <p
                  className="font-mono text-sm leading-relaxed mt-3"
                  style={{ color: "var(--text-body)" }}
                >
                  {post.description}
                </p>
                <p
                  className="mt-4 font-mono text-xs font-semibold inline-flex items-center gap-1"
                  style={{ color: "var(--blue)" }}
                >
                  Read the piece <span aria-hidden="true">→</span>
                </p>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
