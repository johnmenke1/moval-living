'use client'

import { useRef, useState } from 'react'
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Code,
  Eye,
  Pencil,
} from 'lucide-react'

interface Props {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  minRows?: number
}

// Markdown formatting toolbar — pairs with a textarea underneath.
// Strategy: insert markdown syntax around the user's selection.
// If text is selected, wrap it; otherwise insert a placeholder and select it.
// CommonMark syntax that the server-side renderMarkdown() already supports.
export default function MarkdownEditor({ value, onChange, placeholder, minRows = 14 }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [previewHtml, setPreviewHtml] = useState<string>('')

  const insert = (before: string, after: string = before, placeholderText: string = '') => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.slice(start, end) || placeholderText
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      ta.focus()
      const cursor = start + before.length
      const selEnd = cursor + selected.length
      ta.setSelectionRange(cursor, selEnd)
    })
  }

  const insertLine = (prefix: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    // Find start of current line
    const beforeCursor = value.slice(0, start)
    const lineStart = beforeCursor.lastIndexOf('\n') + 1
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    onChange(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + prefix.length, start + prefix.length)
    })
  }

  const promptFor = (label: string, placeholder: string) => {
    const v = window.prompt(label, placeholder)
    return v?.trim() || ''
  }

  const handleBold = () => insert('**', '**', 'bold text')
  const handleItalic = () => insert('*', '*', 'italic text')
  const handleH1 = () => insertLine('# ')
  const handleH2 = () => insertLine('## ')
  const handleH3 = () => insertLine('### ')
  const handleUL = () => insertLine('- ')
  const handleOL = () => insertLine('1. ')
  const handleQuote = () => insertLine('> ')
  const handleCode = () => insert('`', '`', 'code')
  const handleCodeBlock = () => insert('\n```\n', '\n```\n', 'code block')
  const handleLink = () => {
    const url = promptFor('Link URL', 'https://')
    if (!url) return
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.slice(start, end) || 'link text'
    const next = value.slice(0, start) + `[${selected}](${url})` + value.slice(end)
    onChange(next)
  }
  const handleImage = () => {
    const url = promptFor('Image URL', 'https://')
    if (!url) return
    const alt = promptFor('Alt text (describe the image for screen readers)', '') || 'image'
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const next = value.slice(0, start) + `![${alt}](${url})` + value.slice(end)
    onChange(next)
  }

  const handlePreview = async () => {
    setTab('preview')
    try {
      // Client-side preview via the public API route.
      // Falls back to a static message if the endpoint is unreachable.
      const res = await fetch('/api/markdown/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: value }),
      })
      if (res.ok) {
        const data = await res.json()
        setPreviewHtml(data.html ?? '')
      } else {
        setPreviewHtml('<p class="text-red-600 text-sm">Preview failed.</p>')
      }
    } catch {
      setPreviewHtml('<p class="text-red-600 text-sm">Preview failed (network).</p>')
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Best-effort HTML-to-markdown conversion when pasting rich content
    // (e.g. from Google Docs, Word, a website). Falls through to plain
    // text paste if the payload has no HTML.
    const html = e.clipboardData.getData('text/html')
    if (!html) return // plain text — let browser do its thing
    e.preventDefault()
    const md = htmlToMarkdown(html)
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const next = value.slice(0, start) + md + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + md.length, start + md.length)
    })
  }

  const ToolButton = ({
    onClick,
    label,
    icon: Icon,
  }: {
    onClick: () => void
    label: string
    icon: typeof Bold
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="p-2 text-text-secondary hover:text-text hover:bg-slate-100 rounded transition-colors"
    >
      <Icon className="w-4 h-4" />
    </button>
  )

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-1 py-1.5 bg-slate-50 border-b border-slate-200 flex-wrap">
        <ToolButton onClick={handleBold} label="Bold (Ctrl+B)" icon={Bold} />
        <ToolButton onClick={handleItalic} label="Italic (Ctrl+I)" icon={Italic} />
        <span className="w-px h-5 bg-slate-300 mx-1" />
        <ToolButton onClick={handleH1} label="Heading 1" icon={Heading1} />
        <ToolButton onClick={handleH2} label="Heading 2" icon={Heading2} />
        <ToolButton onClick={handleH3} label="Heading 3" icon={Heading3} />
        <span className="w-px h-5 bg-slate-300 mx-1" />
        <ToolButton onClick={handleUL} label="Bulleted list" icon={List} />
        <ToolButton onClick={handleOL} label="Numbered list" icon={ListOrdered} />
        <ToolButton onClick={handleQuote} label="Blockquote" icon={Quote} />
        <span className="w-px h-5 bg-slate-300 mx-1" />
        <ToolButton onClick={handleLink} label="Insert link" icon={LinkIcon} />
        <ToolButton onClick={handleImage} label="Insert image" icon={ImageIcon} />
        <ToolButton onClick={handleCode} label="Inline code" icon={Code} />
        <button
          type="button"
          onClick={handleCodeBlock}
          title="Code block"
          aria-label="Code block"
          className="p-2 text-text-secondary hover:text-text hover:bg-slate-100 rounded transition-colors font-mono text-xs font-semibold"
        >
          {'</>'}
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => (tab === 'write' ? handlePreview() : setTab('write'))}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text rounded transition-colors"
        >
          {tab === 'write' ? (
            <>
              <Eye className="w-4 h-4" /> Preview
            </>
          ) : (
            <>
              <Pencil className="w-4 h-4" /> Edit
            </>
          )}
        </button>
      </div>

      {/* Editor / Preview */}
      {tab === 'write' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            // Ctrl/Cmd + B / I shortcuts
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
              e.preventDefault()
              handleBold()
            } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
              e.preventDefault()
              handleItalic()
            }
          }}
          rows={minRows}
          placeholder={placeholder ?? 'Write here, or paste formatted content from Google Docs / Word…'}
          className="w-full px-4 py-3 text-sm font-mono focus:outline-none resize-y leading-relaxed"
        />
      ) : (
        <div
          className="px-4 py-3 min-h-[300px] prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-text prose-p:text-text prose-a:text-primary hover:prose-a:underline prose-strong:text-text prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-slate-400 text-sm">Nothing to preview yet.</p>' }}
        />
      )}

      {/* Footer hint */}
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-xs text-text-secondary flex items-center justify-between flex-wrap gap-2">
        <span>Markdown supported · paste formatted text to auto-convert</span>
        <span className="font-mono">{value.length.toLocaleString()} chars</span>
      </div>
    </div>
  )
}

// Minimal HTML → markdown converter for paste handling.
// We deliberately keep it conservative: headings, bold/italic, links, lists,
// blockquotes, code, paragraphs, and images. Anything fancier (tables, divs)
// degrades to plain text rather than mangling it.
function htmlToMarkdown(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return walk(tmp).trim() + '\n'
}

function walk(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const children = Array.from(el.childNodes).map(walk).join('')
  switch (tag) {
    case 'h1': return `\n# ${children}\n\n`
    case 'h2': return `\n## ${children}\n\n`
    case 'h3': return `\n### ${children}\n\n`
    case 'h4': return `\n#### ${children}\n\n`
    case 'h5': return `\n##### ${children}\n\n`
    case 'h6': return `\n###### ${children}\n\n`
    case 'strong':
    case 'b': return `**${children}**`
    case 'em':
    case 'i': return `*${children}*`
    case 'u': return children // markdown has no native underline
    case 's':
    case 'strike':
    case 'del': return `~~${children}~~`
    case 'code': {
      if (el.parentElement?.tagName.toLowerCase() === 'pre') return children
      return '`' + children.replace(/`/g, '') + '`'
    }
    case 'pre': return `\n\`\`\`\n${children}\n\`\`\`\n\n`
    case 'a': {
      const href = el.getAttribute('href') ?? ''
      if (!href) return children
      return `[${children}](${href})`
    }
    case 'img': {
      const src = el.getAttribute('src') ?? ''
      const alt = el.getAttribute('alt') ?? ''
      if (!src) return ''
      return `![${alt}](${src})`
    }
    case 'br': return '\n'
    case 'blockquote': return children.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n') + '\n\n'
    case 'ul': {
      return '\n' + Array.from(el.children)
        .map((li) => `- ${walk(li)}`)
        .join('\n') + '\n\n'
    }
    case 'ol': {
      return '\n' + Array.from(el.children)
        .map((li, i) => `${i + 1}. ${walk(li)}`)
        .join('\n') + '\n\n'
    }
    case 'li': return children
    case 'p':
    case 'div':
      return `\n${children}\n\n`
    default:
      return children
  }
}