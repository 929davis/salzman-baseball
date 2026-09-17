import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllArticles } from '@/lib/articles'

export const metadata: Metadata = {
  title: 'Articles',
  description: 'Articles and writing from Salzman Baseball.',
}

export default function ArticlesIndexPage() {
  const articles = getAllArticles()

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 24 }}>Articles</h1>
      {articles.length === 0 && <p style={{ color: '#666' }}>No articles yet.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {articles.map(article => (
          <li key={article.slug}>
            <Link href={`/articles/${article.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 6px 0' }}>{article.title}</h2>
            </Link>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>
              {new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <p style={{ fontSize: 15, color: '#444', margin: 0 }}>{article.description}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
