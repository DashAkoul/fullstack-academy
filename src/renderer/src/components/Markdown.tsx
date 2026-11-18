import { Children, isValidElement, useState, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy } from 'lucide-react'

function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

function languageOf(node: ReactNode): string {
  if (!isValidElement<{ className?: string }>(node)) return ''
  const className = node.props.className ?? ''
  const match = /language-([\w-]+)/.exec(className)
  return match?.[1] ?? ''
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const code = textOf(children)
  const lang = languageOf(Children.toArray(children)[0])

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="code-shell group">
      {lang && <span className="code-lang">{lang}</span>}
      <button
        onClick={copy}
        className="absolute bottom-2 left-2 z-10 rounded-md border border-white/10 bg-white/10 p-1.5 text-white/60 opacity-60 transition-opacity hover:bg-white/20 hover:text-white hover:opacity-100 focus-visible:opacity-100"
        aria-label="کپی کد"
        title="کپی کد"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
      {children}
    </div>
  )
}

const components: Components = {
  pre: ({ children }) => <pre>{<CodeBlock>{children}</CodeBlock>}</pre>,
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        if (href?.startsWith('http')) void window.academy.shell.openExternal(href)
      }}
      rel="noreferrer"
    >
      {children}
    </a>
  )
}

export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`lesson-prose prose prose-slate max-w-none dark:prose-invert ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
