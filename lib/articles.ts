// Reads Markdown files out of content/articles/[slug].md for the public /articles blog.
// No database — the filesystem is the source of truth, read at request/build time.
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const ARTICLES_DIR = path.join(process.cwd(), 'content', 'articles')

export type ArticleFrontmatter = {
  title: string
  description: string
  date: string // ISO 8601, e.g. '2026-03-05'
  slug: string
}

export type Article = ArticleFrontmatter & { content: string }

function readArticleFile(slug: string): Article | null {
  const filePath = path.join(ARTICLES_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)
  if (!data.title || !data.description || !data.date) {
    throw new Error(`content/articles/${slug}.md is missing required frontmatter (title, description, date)`)
  }
  return { title: data.title, description: data.description, date: data.date, slug: data.slug || slug, content }
}

export function getAllArticleSlugs(): string[] {
  if (!fs.existsSync(ARTICLES_DIR)) return []
  return fs.readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace(/\.md$/, ''))
}

// Newest first, by frontmatter `date`.
export function getAllArticles(): Article[] {
  return getAllArticleSlugs()
    .map(readArticleFile)
    .filter((a): a is Article => a !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getArticleBySlug(slug: string): Article | null {
  return readArticleFile(slug)
}
