import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { enrichLimiter, checkRateLimit } from "@/lib/rate-limit";
import { isAllowedUrl } from "@/lib/utils/ssrf-protection";

const enrichSchema = z.object({
  url: z.string().url(),
});

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
      description?: string;
      ogImage?: string;
      favicon?: string;
      ogTitle?: string;
      ogDescription?: string;
      [key: string]: unknown;
    };
  };
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = enrichSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide a valid URL" },
        { status: 400 }
      );
    }

    if (!isAllowedUrl(parsed.data.url)) {
      return NextResponse.json(
        { error: "URL not allowed" },
        { status: 400 }
      );
    }

    const rl = await checkRateLimit(enrichLimiter, userId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      );
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Firecrawl API not configured" },
        { status: 503 }
      );
    }

    // Call Firecrawl scrape endpoint
    const firecrawlRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: parsed.data.url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    if (!firecrawlRes.ok) {
      const errText = await firecrawlRes.text();
      console.error("Firecrawl error:", errText);
      return NextResponse.json(
        { error: "Could not fetch website data" },
        { status: 502 }
      );
    }

    const result: FirecrawlResponse = await firecrawlRes.json();

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: "Could not extract website data" },
        { status: 422 }
      );
    }

    const meta = result.data.metadata || {};
    const content = result.data.markdown || "";

    // Extract company info from metadata + content
    const companyName =
      meta.ogTitle || meta.title || extractFromUrl(parsed.data.url);
    const description = meta.ogDescription || meta.description || "";
    const logo = meta.ogImage || meta.favicon || null;

    // Try to extract phone, email, address from page content
    const phone = extractPhone(content);
    const email = extractEmail(content);
    const address = extractAddress(content);

    return NextResponse.json({
      companyName: cleanText(companyName),
      description: cleanText(description),
      logo,
      phone,
      email,
      address,
      website: parsed.data.url,
      rawTitle: meta.title,
    });
  } catch (error) {
    console.error("Error enriching company:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function extractFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname
      .replace(/^www\./, "")
      .split(".")[0]
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  } catch {
    return "";
  }
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 500);
}

function extractPhone(content: string): string | null {
  const phoneRegex =
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  const match = content.match(phoneRegex);
  return match ? match[0] : null;
}

function extractEmail(content: string): string | null {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = content.match(emailRegex);
  return match ? match[0] : null;
}

function extractAddress(content: string): string | null {
  // Try to find a US address pattern
  const addressRegex =
    /\d{1,5}\s[\w\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct)[.,]?\s*[\w\s]*,?\s*[A-Z]{2}\s*\d{5}/i;
  const match = content.match(addressRegex);
  return match ? match[0].trim() : null;
}
