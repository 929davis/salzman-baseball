// Reads Markdown files out of content/playbook/[name].md for the private /social/playbook
// reference page. No database -- same fs-is-source-of-truth pattern as lib/articles.ts, since
// this is version-controlled reference material edited and pushed via git, not
// coach-authored content needing an admin UI.
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { marked } from 'marked'

const PLAYBOOK_DIR = path.join(process.cwd(), 'content', 'playbook')
const DM_SEQUENCE_ID = 'dm-sequence'
const EXPECTED_DM_MESSAGE_COUNT = 5

export type PlaybookSection = {
  id: string // filename without extension -- also the anchor id and <details> id
  title: string
  order: number
  html: string
}

export type DmMessage = {
  index: number
  text: string // plain text, pasted as-is into Instagram DMs -- no markdown rendering
}

function readSectionFile(filename: string): { id: string, title: string, order: number, content: string } {
  const id = filename.replace(/\.md$/, '')
  const raw = fs.readFileSync(path.join(PLAYBOOK_DIR, filename), 'utf8')
  const { data, content } = matter(raw)
  if (!data.title || typeof data.order !== 'number') {
    throw new Error(`content/playbook/${filename} is missing required frontmatter (title, order).`)
  }
  return { id, title: data.title, order: data.order, content }
}

// Splits dm-sequence.md's body on "## Message N" headings into discrete plain-text messages,
// one per copy button. Throws rather than rendering fewer -- a heading typo silently
// swallowing a message would otherwise only surface by testing the DM flow live on a phone.
function parseDmMessages(content: string): DmMessage[] {
  const parts = content.split(/^##\s*Message\s*\d+\s*$/m).slice(1)
  const messages = parts.map(p => p.trim()).filter(Boolean)
  if (messages.length !== EXPECTED_DM_MESSAGE_COUNT) {
    throw new Error(
      `content/playbook/dm-sequence.md must contain exactly ${EXPECTED_DM_MESSAGE_COUNT} "## Message N" sections, found ${messages.length}.`
    )
  }
  return messages.map((text, i) => ({ index: i + 1, text }))
}

// Ordered by frontmatter `order`, not filename or directory listing order -- so section order
// is a one-line edit in the file itself, not a change to this module or the page.
export async function getPlaybookSections(): Promise<PlaybookSection[]> {
  const files = fs.readdirSync(PLAYBOOK_DIR).filter(f => f.endsWith('.md'))
  const parsed = files.map(readSectionFile).sort((a, b) => a.order - b.order)

  const sections: PlaybookSection[] = []
  for (const s of parsed) {
    // dm-sequence's body is rendered as discrete plain-text messages (getDmMessages), not as
    // one HTML blob -- skip marked() for it so the two representations can't drift.
    const html = s.id === DM_SEQUENCE_ID ? '' : await marked.parse(s.content)
    sections.push({ id: s.id, title: s.title, order: s.order, html })
  }
  return sections
}

export function getDmMessages(): DmMessage[] {
  const raw = fs.readFileSync(path.join(PLAYBOOK_DIR, `${DM_SEQUENCE_ID}.md`), 'utf8')
  const { content } = matter(raw)
  return parseDmMessages(content)
}

export { DM_SEQUENCE_ID }
