import { ARTICLE_CATEGORIES, type ArticleCategory } from '@/lib/articleCategories'
import styles from './articles.module.css'

export default function CategoryTag({ category }: { category: ArticleCategory }) {
  const def = ARTICLE_CATEGORIES[category]
  return (
    <span className={styles.tag} style={{ ['--tag-color' as string]: def.color }}>
      [{def.code}]
    </span>
  )
}
