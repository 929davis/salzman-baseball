import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import Link from 'next/link'
import styles from './articles.module.css'

// One family, two cuts: Plex Sans carries prose/headlines, Plex Mono carries everything that's
// data (dates, category codes, read time, table numerals). Scoped to this route only -- the
// rest of the app keeps its own fonts.
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-sans' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-mono' })

export default function ArticlesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${styles.shell} ${plexSans.variable} ${plexMono.variable}`}>
      <div className={styles.topbar}>
        <Link href="/" className={styles.wordmark}>SALZMAN BASEBALL</Link>
        <Link href="/articles" className={styles.wordmark}>ARTICLES</Link>
      </div>
      {children}
    </div>
  )
}
