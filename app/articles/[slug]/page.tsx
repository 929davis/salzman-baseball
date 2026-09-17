import { notFound } from 'next/navigation'
import { marked } from 'marked'
import type { Metadata } from 'next'
import { getAllArticleSlugs, getArticleBySlug } from '@/lib/articles'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return getAllArticleSlugs().map(slug => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) return {}
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `${SITE_URL}/articles/${article.slug}` },
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) notFound()

  const html = await marked.parse(article.content)

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>{article.title}</h1>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 32 }}>
        {new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
      <article
        style={{ fontSize: 16, lineHeight: 1.7, color: '#222' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  )
}
