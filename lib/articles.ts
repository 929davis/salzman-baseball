// Reads Markdown files out of content/articles/[slug].md for the public /articles blog.
// No database — the filesystem is the source of truth, read at request/build time.
// Server-only (uses fs/path) -- category constants and date formatting live in
// lib/articleCategories.ts instead, so client components can import those without pulling in
// this file's Node-only code.
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { ARTICLE_CATEGORIES, type ArticleCategory } from './articleCategories'

const ARTICLES_DIR = path.join(process.cwd(), 'content', 'articles')

export type { ArticleCategory }

export type ArticleFrontmatter = {
  title: string
  description: string
  date: string // ISO 8601, e.g. '2026-03-05'
  slug: string
  category: ArticleCategory
}

export type Article = ArticleFrontmatter & { content: string; readTimeMinutes: number }

const WORDS_PER_MINUTE = 200

function readArticleFile(slug: string): Article | null {
  const filePath = path.join(ARTICLES_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)
  if (!data.title || !data.description || !data.date) {
    throw new Error(`content/articles/${slug}.md is missing required frontmatter (title, description, date)`)
  }
  const category: ArticleCategory = data.category in ARTICLE_CATEGORIES ? data.category : 'takes'
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length
  const readTimeMinutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE))
  return {
    title: data.title,
    description: data.description,
    date: data.date,
    slug: data.slug || slug,
    category,
    content,
    readTimeMinutes,
  }
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
