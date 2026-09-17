import type { Metadata } from 'next'
import { getAllArticles } from '@/lib/articles'
import ArticlesList from './ArticlesList'
import styles from './articles.module.css'

export const metadata: Metadata = {
  title: 'Articles',
  description: 'Data-driven pitching breakdowns: Statcast pulls, mechanics analysis, biomechanics research, and contrarian coaching takes.',
}

export default function ArticlesIndexPage() {
  const articles = getAllArticles()

  return (
    <main className={styles.container}>
      <div className={styles.indexHeader}>
        <h1 className={styles.indexTitle}>Articles</h1>
        <p className={styles.indexDek}>
          Statcast pulls, mechanics breakdowns, biomechanics research, and coaching takes that
          go against the grain. Written for pitchers, parents, and coaches who want the data,
          not the hype.
        </p>
      </div>
      <ArticlesList articles={articles} />
    </main>
  )
}
