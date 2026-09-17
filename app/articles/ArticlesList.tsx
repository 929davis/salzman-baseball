'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ARTICLE_CATEGORIES, formatArticleDate, type ArticleCategory } from '@/lib/articleCategories'
import type { Article } from '@/lib/articles'
import CategoryTag from './CategoryTag'
import styles from './articles.module.css'

// Client-side filter: a coach reading Statcast breakdowns and a parent reading contrarian
// coaching takes are different readers of the same list -- this is a real filter, not a
// decorative control, hence living client-side rather than as separate server routes per tag.
export default function ArticlesList({ articles }: { articles: Article[] }) {
  const [filter, setFilter] = useState<ArticleCategory | 'all'>('all')
  const visible = filter === 'all' ? articles : articles.filter(a => a.category === filter)

  return (
    <>
      <div className={styles.filterRow}>
        <button
          className={filter === 'all' ? `${styles.filterBtn} ${styles.filterBtnActive}` : styles.filterBtn}
          onClick={() => setFilter('all')}
        >
          ALL
        </button>
        {(Object.keys(ARTICLE_CATEGORIES) as ArticleCategory[]).map(key => {
          const def = ARTICLE_CATEGORIES[key]
          return (
            <button
              key={key}
              className={filter === key ? `${styles.filterBtn} ${styles.filterBtnActive}` : styles.filterBtn}
              style={{ ['--tag-color' as string]: def.color }}
              onClick={() => setFilter(key)}
            >
              {def.code}
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <div className={styles.empty}>No articles in this category yet.</div>
      ) : (
        <ul className={styles.list}>
          {visible.map(article => (
            <li key={article.slug}>
              <Link href={`/articles/${article.slug}`} className={styles.row}>
                <span className={styles.rowTag}><CategoryTag category={article.category} /></span>
                <span>
                  <div className={styles.rowTitle}>{article.title}</div>
                  <p className={styles.rowDek}>{article.description}</p>
                </span>
                <span className={styles.rowMeta}>
                  {formatArticleDate(article.date)}<br />{article.readTimeMinutes} MIN
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
