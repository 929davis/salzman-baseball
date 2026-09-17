import type { MetadataRoute } from 'next'
import { getAllArticles } from '@/lib/articles'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export default function sitemap(): MetadataRoute.Sitemap {
  const articles = getAllArticles()
  return [
    {
      url: `${SITE_URL}/articles`,
      lastModified: articles[0]?.date ? new Date(articles[0].date) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...articles.map(article => ({
      url: `${SITE_URL}/articles/${article.slug}`,
      lastModified: new Date(article.date),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
