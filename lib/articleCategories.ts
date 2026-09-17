// Client-safe: category taxonomy and date formatting, split out of lib/articles.ts so client
// components (the filter, the category tag) don't pull in that file's fs/path usage.

// Four beats this site actually publishes -- not a generic tag system. Each has one fixed
// accent color used everywhere the category appears: list rows, filters, the article header,
// and blockquote callouts within the piece.
export const ARTICLE_CATEGORIES = {
  data: { label: 'Data', code: 'DATA', color: 'var(--navy)' },
  mech: { label: 'Mechanics', code: 'MECH', color: 'var(--red)' },
  bio: { label: 'Biomechanics', code: 'BIO', color: 'var(--gold)' },
  takes: { label: 'Takes', code: 'TAKES', color: 'var(--ink)' },
} as const

export type ArticleCategory = keyof typeof ARTICLE_CATEGORIES

// Compact instrument-readout date, not prose -- consistent everywhere the date appears.
export function formatArticleDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}
