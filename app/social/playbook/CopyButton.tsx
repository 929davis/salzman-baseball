'use client'
import { useState } from 'react'

const C = {
  bg3: '#1c2333', border: '#30363d', gold: '#e8b84b', teal: '#39d353', text: '#e6edf3',
}

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback for contexts where the async Clipboard API is unavailable (older WebKit,
      // non-HTTPS). execCommand is deprecated but still works everywhere the API doesn't.
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={onCopy}
      style={{
        background: copied ? C.teal : C.bg3,
        color: copied ? '#0d1117' : C.text,
        border: `1px solid ${copied ? C.teal : C.border}`,
        borderRadius: 8,
        padding: '10px 16px',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        minWidth: 84,
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
