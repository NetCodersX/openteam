// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

function render(markdown: string): HTMLElement {
  document.head.replaceChildren()
  const root = document.createElement('div')
  root.className = 'markdown-body'
  root.append(renderMarkdown(markdown))
  return root
}

describe('renderMarkdown', () => {
  it('renders common markdown structures with scroll-safe table/code styles', () => {
    const root = render(`# Title\n\nHello **bold** and *em* with \`code\`.\n\n- one\n- two\n\n> quoted\n\n| A | B |\n| --- | --- |\n| 1 | 2 |`)
    const style = document.getElementById('openteam-markdown-styles')?.textContent ?? ''

    expect(root.querySelector('h1')?.textContent).toBe('Title')
    expect(root.querySelector('strong')?.textContent).toBe('bold')
    expect(root.querySelector('em')?.textContent).toBe('em')
    expect(root.querySelector('p code')?.textContent).toBe('code')
    expect([...root.querySelectorAll('li')].map(item => item.textContent)).toEqual(['one', 'two'])
    expect(root.querySelector('blockquote')?.textContent).toContain('quoted')
    expect(root.querySelector('.markdown-table-scroll table')?.textContent).toContain('A')
    expect(style).toContain('.markdown-body pre { max-width: 100%; overflow-x: auto;')
    expect(style).toContain('.markdown-table-scroll { max-width: 100%; overflow-x: auto;')
  })

  it('renders fenced code as inert text with language highlighting', () => {
    const root = render('```html\n<script>alert(1)</script>\n```')

    expect(root.querySelector('script')).toBeNull()
    expect(root.querySelector('pre code.language-html')?.textContent).toBe('<script>alert(1)</script>')
    expect(root.querySelector('.token.keyword')?.textContent).toContain('script')
  })

  it('sanitizes dangerous links and secures safe links', () => {
    const root = render('[bad](javascript:alert(1)) [good](https://example.com/path)')
    const links = root.querySelectorAll('a')

    expect(links[0].hasAttribute('href')).toBe(false)
    expect(links[0].textContent).toBe('bad')
    expect(links[1].getAttribute('href')).toBe('https://example.com/path')
    expect(links[1].getAttribute('target')).toBe('_blank')
    expect(links[1].getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('does not convert raw html into executable dom', () => {
    const root = render('<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>')

    expect(root.querySelector('img')).toBeNull()
    expect(root.querySelector('script')).toBeNull()
    expect(root.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(root.textContent).toContain('<script>alert(1)</script>')
  })
})
