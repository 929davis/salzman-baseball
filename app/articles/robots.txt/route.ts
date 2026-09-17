// Next.js's robots.ts metadata-route convention only works at the true app root -- nested
// under a route segment (app/articles/robots.ts) it's silently not recognized as a special
// file, and the request falls through to app/articles/[slug]/page.tsx instead (confirmed:
// that produced a 404 treating "robots.txt" as an article slug). A plain Route Handler at
// this literal path works, since arbitrary folder names (including ones with dots) are valid
// App Router segments, and static segments are matched before the [slug] dynamic one.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export function GET() {
  const body = `User-Agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/articles/sitemap.xml\n`
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } })
}
