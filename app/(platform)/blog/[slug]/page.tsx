import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BLOG_POSTS, findPost } from "@/lib/copy/blog";

export async function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = findPost(slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.title,
    description: post.description,
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = findPost(slug);
  if (!post) notFound();

  const paragraphs = post.body.split(/\n\s*\n/);

  return (
    <div style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-body)" }}>
      <div className="max-w-2xl mx-auto px-4 md:px-8 pt-16 pb-20">
        <Link
          href="/blog"
          className="font-mono text-[10px] uppercase tracking-[0.12em]"
          style={{ color: "var(--text-muted)" }}
        >
          ← Blog
        </Link>
        <header className="mt-8">
          <p
            className="font-mono text-[11px] uppercase tracking-[0.12em]"
            style={{ color: "var(--text-muted)" }}
          >
            {new Date(post.publishedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}{" "}
            · {post.readingMinutes} min read · {post.author}
          </p>
          <h1
            className="mt-4 text-4xl md:text-5xl font-normal leading-[1.1]"
            style={{ color: "var(--text-headline)", fontFamily: "var(--font-display)" }}
          >
            {post.title}
          </h1>
          <p
            className="mt-5 text-base leading-relaxed"
            style={{ color: "var(--text-body)" }}
          >
            {post.description}
          </p>
        </header>

        <article className="mt-12 space-y-5 text-base leading-[1.75]" style={{ color: "var(--text-body)" }}>
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </article>

        <div
          className="mt-16 p-10"
          style={{
            backgroundColor: "var(--color-accent)",
            border: "1px solid var(--color-border)",
            borderRadius: "2px",
            color: "#161616",
          }}
        >
          <h2
            className="text-2xl font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Seeing yourself in this?
          </h2>
          <p
            className="text-sm leading-relaxed mt-3"
            style={{ color: "#393939" }}
          >
            Book a demo and bring your current marketing invoice. We'll show
            you, line by line, how we'd rebuild it.
          </p>
          <Link
            href="/onboarding"
            className="mt-6 inline-block font-mono text-xs font-semibold px-6 py-4 rounded-none"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "#FFFFFF",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Book a demo
          </Link>
        </div>
      </div>
    </div>
  );
}
