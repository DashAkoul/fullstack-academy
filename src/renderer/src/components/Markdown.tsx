import { Children, isValidElement, memo, useState, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import graphql from 'highlight.js/lib/languages/graphql'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import ini from 'highlight.js/lib/languages/ini'
import powershell from 'highlight.js/lib/languages/powershell'
import diff from 'highlight.js/lib/languages/diff'
import markdown from 'highlight.js/lib/languages/markdown'
import kotlin from 'highlight.js/lib/languages/kotlin'
import swift from 'highlight.js/lib/languages/swift'
import plaintext from 'highlight.js/lib/languages/plaintext'
import { Check, Copy } from 'lucide-react'

// Only register the grammars used by the curriculum: keeps the renderer small.
for (const [name, grammar] of Object.entries({
  javascript,
  typescript,
  xml,
  css,
  json,
  bash,
  sql,
  yaml,
  graphql,
  dockerfile,
  ini,
  powershell,
  diff,
  markdown,
  kotlin,
  swift,
  plaintext
})) {
  hljs.registerLanguage(name, grammar)
}

const ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'xml',
  htm: 'xml',
  svg: 'xml',
  vue: 'xml',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  gql: 'graphql',
  docker: 'dockerfile',
  toml: 'ini',
  ps1: 'powershell',
  pwsh: 'powershell',
  text: 'plaintext',
  txt: 'plaintext',
  env: 'plaintext',
  prisma: 'plaintext'
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

function highlight(code: string, rawLang: string): string {
  const lang = ALIASES[rawLang] ?? rawLang
  if (!hljs.getLanguage(lang)) return hljs.highlight(code, { language: 'plaintext' }).value
  return hljs.highlight(code, { language: lang }).value
}

function CodeBlock({ code, children }: { code: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false)

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
  pre: ({ children }) => {
    const child = Children.toArray(children)[0]
    const dataCode = isValidElement<{ 'data-code'?: string }>(child) ? child.props['data-code'] : undefined
    const code = typeof dataCode === 'string' ? dataCode : textOf(children)
    return (
      <pre>
        <CodeBlock code={code}>{children}</CodeBlock>
      </pre>
    )
  },
  code: ({ className, children }) => {
    const lang = /language-([\w-]+)/.exec(className ?? '')?.[1]
    if (!lang) {
      return <code className={className}>{children}</code>
    }
    const code = String(children).replace(/\n$/, '')
    return (
      <code
        className={`${className ?? ''} hljs`}
        data-code={code}
        dir="ltr"
        dangerouslySetInnerHTML={{ __html: highlight(code, lang) }}
      />
    )
  },
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        if (href?.startsWith('https://') || href?.startsWith('http://')) {
          void window.academy.shell.openExternal(href)
        }
      }}
      rel="noreferrer"
    >
      {children}
    </a>
  )
}

export const Markdown = memo(function Markdown({
  children,
  className = ''
}: {
  children: string
  className?: string
}) {
  return (
    <div className={`lesson-prose prose prose-slate max-w-none dark:prose-invert ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
})
