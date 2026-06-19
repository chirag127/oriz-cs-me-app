/**
 * Blog RSS Fetcher — parses blog.oriz.in/rss.xml
 * Used at build time to display latest blog posts.
 */

export interface BlogPost {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

/**
 * Fetch and parse the RSS feed into structured blog posts.
 * Falls back to an empty array on ANY failure.
 */
export async function fetchBlogPosts(): Promise<BlogPost[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch('https://blog.oriz.in/rss.xml', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`[Blog] RSS fetch failed: ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseRSS(xml);
  } catch {
    // DNS, timeout, network — all silently return []
    console.warn('[Blog] RSS unavailable, skipping.');
    return [];
  }
}

/** Minimal XML RSS parser using regex. */
function parseRSS(xml: string): BlogPost[] {
  const items: BlogPost[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  match = itemRegex.exec(xml);
  while (match !== null) {
    const block = match[1] ?? '';
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const description = extractTag(block, 'description')
      .replace(/<[^>]*>/g, '')
      .slice(0, 200);

    if (title && link) {
      items.push({ title, link, pubDate, description });
    }
    match = itemRegex.exec(xml);
  }
  return items;
}

function extractTag(xml: string, tag: string): string {
  const cdataMatch = xml.match(
    new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`),
  );
  if (cdataMatch) return cdataMatch[1]!.trim();

  const simpleMatch = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return simpleMatch ? simpleMatch[1]!.trim() : '';
}
