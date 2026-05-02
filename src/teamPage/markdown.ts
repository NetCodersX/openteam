const MARKDOWN_STYLE_ID = 'openteam-markdown-styles'
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const LANGUAGE_ALIASES: Record<string, string> = {
  bash: 'bash',
  css: 'css',
  html: 'html',
  htm: 'html',
  javascript: 'javascript',
  js: 'javascript',
  json: 'json',
  shell: 'bash',
  sh: 'bash',
  ts: 'typescript',
  tsx: 'typescript',
  typescript: 'typescript',
}

const KEYWORDS: Record<string, Set<string>> = {
  bash: new Set(['case', 'cd', 'do', 'done', 'echo', 'elif', 'else', 'esac', 'export', 'fi', 'for', 'function', 'if', 'in', 'local', 'then', 'while']),
  css: new Set(['and', 'from', 'important', 'media', 'only', 'root', 'screen', 'to']),
  html: new Set(['body', 'button', 'div', 'form', 'head', 'html', 'input', 'label', 'li', 'link', 'main', 'meta', 'ol', 'p', 'script', 'section', 'span', 'style', 'table', 'tbody', 'td', 'textarea', 'th', 'thead', 'title', 'tr', 'ul']),
  javascript: new Set(['async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'else', 'export', 'extends', 'finally', 'for', 'from', 'function', 'if', 'import', 'let', 'new', 'return', 'switch', 'throw', 'try', 'typeof', 'undefined', 'var', 'while']),
  json: new Set(['false', 'null', 'true']),
  typescript: new Set(['async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'else', 'enum', 'export', 'extends', 'finally', 'for', 'from', 'function', 'if', 'implements', 'import', 'interface', 'let', 'new', 'private', 'protected', 'public', 'readonly', 'return', 'switch', 'throw', 'try', 'type', 'typeof', 'undefined', 'var', 'while']),
}

export function renderMarkdown(content: string): DocumentFragment {
  ensureMarkdownStyles()
  try {
    return renderBlocks(content)
  } catch (error) {
    console.warn('[OpenTeam][team-page]', 'markdown:render-failed', {
      contentLength: content.length,
      error: error instanceof Error ? error.name : typeof error,
    })
    const fragment = document.createDocumentFragment()
    const paragraph = document.createElement('p')
    paragraph.textContent = content
    fragment.append(paragraph)
    return fragment
  }
}

function ensureMarkdownStyles(): void {
  if (document.getElementById(MARKDOWN_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = MARKDOWN_STYLE_ID
  style.textContent = `
    .markdown-body { white-space: normal; }
    .markdown-body > :first-child { margin-top: 0; }
    .markdown-body > :last-child { margin-bottom: 0; }
    .markdown-body p,
    .markdown-body ul,
    .markdown-body ol,
    .markdown-body blockquote,
    .markdown-body pre,
    .markdown-body .markdown-table-scroll { margin: 0 0 11px; }
    .markdown-body h1,
    .markdown-body h2,
    .markdown-body h3,
    .markdown-body h4,
    .markdown-body h5,
    .markdown-body h6 { margin: 12px 0 7px; color: #eef7fb; line-height: 1.25; }
    .markdown-body h1 { font-size: 19px; }
    .markdown-body h2 { font-size: 17px; }
    .markdown-body h3 { font-size: 15px; }
    .markdown-body h4,
    .markdown-body h5,
    .markdown-body h6 { font-size: 14px; }
    .markdown-body ul,
    .markdown-body ol { padding-left: 22px; }
    .markdown-body li + li { margin-top: 4px; }
    .markdown-body blockquote { border-left: 3px solid rgba(47, 216, 204, 0.48); padding: 6px 0 6px 12px; color: #9fb0bd; background: rgba(47, 216, 204, 0.05); }
    .markdown-body a { color: #7ee7df; text-decoration: none; }
    .markdown-body a:hover { text-decoration: underline; }
    .markdown-body code { border: 1px solid rgba(132, 153, 171, 0.16); border-radius: 5px; padding: 1px 5px; background: rgba(2, 8, 14, 0.62); color: #dff8ff; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 0.92em; }
    .markdown-body pre { max-width: 100%; overflow-x: auto; border: 1px solid rgba(132, 153, 171, 0.16); border-radius: 8px; padding: 12px; background: rgba(2, 8, 14, 0.76); }
    .markdown-body pre code { display: block; min-width: max-content; border: 0; padding: 0; background: transparent; white-space: pre; line-height: 1.55; }
    .markdown-body .token.keyword { color: #8ac7ff; }
    .markdown-body .token.string { color: #a8e6a2; }
    .markdown-body .token.comment { color: #6f8290; }
    .markdown-body .token.number { color: #ffc777; }
    .markdown-table-scroll { max-width: 100%; overflow-x: auto; border: 1px solid rgba(132, 153, 171, 0.16); border-radius: 8px; }
    .markdown-body table { min-width: max-content; border-collapse: collapse; font-size: 13px; }
    .markdown-body th,
    .markdown-body td { border-bottom: 1px solid rgba(132, 153, 171, 0.14); padding: 7px 10px; text-align: left; vertical-align: top; }
    .markdown-body th { color: #eef7fb; background: rgba(132, 153, 171, 0.08); }
  `
  document.head.append(style)
}

function renderBlocks(content: string): DocumentFragment {
  const fragment = document.createDocumentFragment()
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    const fence = line.match(/^```\s*([\w+-]*)\s*$/)
    if (fence) {
      const language = normalizeLanguage(fence[1] || '')
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      fragment.append(codeBlock(codeLines.join('\n'), language))
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const element = document.createElement(`h${level}`)
      element.append(renderInline(heading[2].trim()))
      fragment.append(element)
      index += 1
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = []
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ''))
        index += 1
      }
      const quote = document.createElement('blockquote')
      quote.append(renderBlocks(quoteLines.join('\n')))
      fragment.append(quote)
      continue
    }

    if (isTableStart(lines, index)) {
      const tableLines = [lines[index], lines[index + 1]]
      index += 2
      while (index < lines.length && looksLikeTableRow(lines[index])) {
        tableLines.push(lines[index])
        index += 1
      }
      fragment.append(tableBlock(tableLines))
      continue
    }

    const listMarker = parseListMarker(line)
    if (listMarker) {
      const ordered = listMarker.ordered
      const list = document.createElement(ordered ? 'ol' : 'ul')
      while (index < lines.length) {
        const currentMarker = parseListMarker(lines[index])
        if (!currentMarker || currentMarker.ordered !== ordered) break
        const item = document.createElement('li')
        item.append(renderInline(currentMarker.text))
        list.append(item)
        index += 1
      }
      fragment.append(list)
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length && lines[index].trim()) {
      if (/^```/.test(lines[index]) || /^(#{1,6})\s+/.test(lines[index]) || /^\s*>\s?/.test(lines[index]) || parseListMarker(lines[index]) || isTableStart(lines, index)) break
      paragraphLines.push(lines[index].trim())
      index += 1
    }
    const paragraph = document.createElement('p')
    paragraph.append(renderInline(paragraphLines.join(' ')))
    fragment.append(paragraph)
  }

  return fragment
}

function parseListMarker(line: string): { ordered: boolean; text: string } | undefined {
  const unordered = line.match(/^\s*[-*+]\s+(.+)$/)
  if (unordered) return { ordered: false, text: unordered[1] }
  const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/)
  if (ordered) return { ordered: true, text: ordered[1] }
  return undefined
}

function isTableStart(lines: string[], index: number): boolean {
  return looksLikeTableRow(lines[index]) && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])
}

function looksLikeTableRow(line: string | undefined): boolean {
  return Boolean(line && line.includes('|') && line.trim().replace(/^\|/, '').replace(/\|$/, '').includes('|'))
}

function tableBlock(lines: string[]): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'markdown-table-scroll'
  const table = document.createElement('table')
  const headerCells = splitTableCells(lines[0])
  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')
  for (const cell of headerCells) {
    const th = document.createElement('th')
    th.append(renderInline(cell.trim()))
    headerRow.append(th)
  }
  thead.append(headerRow)
  table.append(thead)

  const tbody = document.createElement('tbody')
  for (const rowLine of lines.slice(2)) {
    const row = document.createElement('tr')
    for (const cell of splitTableCells(rowLine)) {
      const td = document.createElement('td')
      td.append(renderInline(cell.trim()))
      row.append(td)
    }
    tbody.append(row)
  }
  table.append(tbody)
  wrapper.append(table)
  return wrapper
}

function splitTableCells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
}

function codeBlock(code: string, language: string): HTMLElement {
  const pre = document.createElement('pre')
  const codeEl = document.createElement('code')
  if (language) codeEl.className = `language-${language}`
  try {
    appendHighlightedCode(codeEl, code, language)
  } catch (error) {
    console.warn('[OpenTeam][team-page]', 'markdown:highlight-failed', {
      contentLength: code.length,
      language: language || 'plain',
      error: error instanceof Error ? error.name : typeof error,
    })
    codeEl.textContent = code
  }
  pre.append(codeEl)
  return pre
}

function normalizeLanguage(language: string): string {
  const normalized = language.trim().toLowerCase()
  return LANGUAGE_ALIASES[normalized] ?? normalized
}

function appendHighlightedCode(parent: HTMLElement, code: string, language: string): void {
  const keywords = KEYWORDS[language]
  if (!keywords) {
    parent.textContent = code
    return
  }

  const tokenPattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/.*|#.*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$-]*\b|<\/?[A-Za-z][\w:-]*|[{}()[\].,;:+*/%=<>!&|-]|\s+|.)/g
  let match: RegExpExecArray | null
  while ((match = tokenPattern.exec(code)) !== null) {
    const token = match[0]
    if (/^\s+$/.test(token)) {
      parent.append(document.createTextNode(token))
    } else if (/^("|'|`)/.test(token)) {
      parent.append(highlightSpan('string', token))
    } else if (/^(\/\/|#)/.test(token)) {
      parent.append(highlightSpan('comment', token))
    } else if (/^\d/.test(token)) {
      parent.append(highlightSpan('number', token))
    } else if (keywords.has(token.replace(/^<\/?/, '').toLowerCase())) {
      parent.append(highlightSpan('keyword', token))
    } else {
      parent.append(document.createTextNode(token))
    }
  }
}

function highlightSpan(kind: string, value: string): HTMLElement {
  const span = document.createElement('span')
  span.className = `token ${kind}`
  span.textContent = value
  return span
}

function renderInline(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment()
  appendInline(fragment, text, 0)
  return fragment
}

function appendInline(parent: DocumentFragment | HTMLElement, text: string, start: number): void {
  let cursor = start
  while (cursor < text.length) {
    const next = findNextInlineToken(text, cursor)
    if (!next) {
      parent.append(document.createTextNode(text.slice(cursor)))
      return
    }

    if (next.index > cursor) parent.append(document.createTextNode(text.slice(cursor, next.index)))

    if (next.type === 'code') {
      const code = document.createElement('code')
      code.textContent = next.content
      parent.append(code)
    } else if (next.type === 'strong') {
      const strong = document.createElement('strong')
      appendInline(strong, next.content, 0)
      parent.append(strong)
    } else if (next.type === 'em') {
      const emphasis = document.createElement('em')
      appendInline(emphasis, next.content, 0)
      parent.append(emphasis)
    } else {
      parent.append(linkElement(next.content, next.href))
    }

    cursor = next.end
  }
}

type InlineToken =
  | { type: 'code' | 'em' | 'strong'; index: number; end: number; content: string }
  | { type: 'link'; index: number; end: number; content: string; href: string }

function findNextInlineToken(text: string, start: number): InlineToken | undefined {
  const candidates: InlineToken[] = []
  const codeIndex = text.indexOf('`', start)
  if (codeIndex >= 0) {
    const end = text.indexOf('`', codeIndex + 1)
    if (end > codeIndex) candidates.push({ type: 'code', index: codeIndex, end: end + 1, content: text.slice(codeIndex + 1, end) })
  }

  const linkMatch = matchLink(text, start)
  if (linkMatch) candidates.push(linkMatch)

  const strongIndex = text.indexOf('**', start)
  if (strongIndex >= 0) {
    const end = text.indexOf('**', strongIndex + 2)
    if (end > strongIndex) candidates.push({ type: 'strong', index: strongIndex, end: end + 2, content: text.slice(strongIndex + 2, end) })
  }

  const emIndex = text.indexOf('*', start)
  if (emIndex >= 0 && text[emIndex + 1] !== '*') {
    const end = text.indexOf('*', emIndex + 1)
    if (end > emIndex) candidates.push({ type: 'em', index: emIndex, end: end + 1, content: text.slice(emIndex + 1, end) })
  }

  return candidates.sort((left, right) => left.index - right.index || left.end - right.end)[0]
}

function matchLink(text: string, start: number): InlineToken | undefined {
  const open = text.indexOf('[', start)
  if (open < 0) return undefined
  const close = text.indexOf('](', open + 1)
  if (close < 0) return undefined
  const hrefEnd = text.indexOf(')', close + 2)
  if (hrefEnd < 0) return undefined
  return {
    type: 'link',
    index: open,
    end: hrefEnd + 1,
    content: text.slice(open + 1, close),
    href: text.slice(close + 2, hrefEnd),
  }
}

function linkElement(label: string, href: string): HTMLElement {
  const anchor = document.createElement('a')
  anchor.append(renderInline(label))
  const safeHref = sanitizeHref(href)
  if (safeHref) {
    anchor.href = safeHref
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
  }
  return anchor
}

function sanitizeHref(href: string): string | undefined {
  const trimmed = href.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed
  try {
    const url = new URL(trimmed)
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}
