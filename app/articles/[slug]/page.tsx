import { notFound } from 'next/navigation'
import Link from 'next/link'
import { marked } from 'marked'
import type { Metadata } from 'next'
import { getAllArticleSlugs, getArticleBySlug } from '@/lib/articles'
import { ARTICLE_CATEGORIES, formatArticleDate } from '@/lib/articleCategories'
import CategoryTag from '../CategoryTag'
import styles from '../articles.module.css'

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
  const accent = ARTICLE_CATEGORIES[article.category].color

  return (
    <main className={styles.container}>
      <div className={styles.articleHeader}>
        <div className={styles.metaLine}>
          <CategoryTag category={article.category} />
          <span>{formatArticleDate(article.date)}</span>
          <span>·</span>
          <span>{article.readTimeMinutes} MIN READ</span>
        </div>
        <h1 className={styles.title}>{article.title}</h1>
        <p className={styles.dek}>{article.description}</p>
      </div>

      <article
        className={styles.body}
        style={{ ['--article-accent' as string]: accent }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div className={styles.footer}>
        <Link href="/articles" className={styles.backLink}>All articles</Link>
        <CategoryTag category={article.category} />
      </div>
    </main>
  )
}
