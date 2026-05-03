import type { ChatSiteAdapter, ConversationSnapshot } from './types'
import { keepDeepestResponseContainers } from '../responseContainers'
import { findClickableCopyButton, readResponseTextFromCopyAction } from './clipboardCopy'
import { readEditorText, setContentEditableText } from './contentEditable'
import { extractMarkdownFromDom } from './domMarkdown'
import { buttonLabelMatches, describeElement, extractCleanTextFromDom, findClosestMatchingAncestor } from './domText'
import { isClickableButton, waitForClickableButton, waitForElement } from './waitForElement'

const CHATGPT_HOSTS = new Set(['chatgpt.com', 'chat.openai.com'])
const DEFAULT_INPUT_TIMEOUT_MS = 9000
const DEFAULT_CLIPBOARD_TIMEOUT_MS = 900
const DEFAULT_CLIPBOARD_POLL_MS = 40

const CHATGPT_SELECTORS = {
  editor: 'form[data-type="unified-composer"] #prompt-textarea[contenteditable="true"], #prompt-textarea.ProseMirror[contenteditable="true"]',
  sendButton:
    'button[data-testid="send-button"], button[aria-label*="发送"], button[aria-label*="Send"], button[aria-label*="提交"], button[aria-label*="Submit"]',
  response: '[data-message-author-role="assistant"]',
  copyButton:
    'button[data-testid="copy-turn-action-button"], button[aria-label="复制回复"], button[aria-label*="Copy"], button[aria-label*="复制"]',
  turn: '[data-testid^="conversation-turn-"], [data-turn]',
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'BUTTON', 'TEXTAREA', 'SVG'])

interface ChatGptAdapterOptions {
  href?: string
  inputTimeoutMs?: number
  clipboardTimeoutMs?: number
  clipboardPollMs?: number
}

export function createChatGptAdapter(options: ChatGptAdapterOptions = {}): ChatSiteAdapter {
  const inputTimeoutMs = options.inputTimeoutMs ?? DEFAULT_INPUT_TIMEOUT_MS
  const clipboardTimeoutMs = options.clipboardTimeoutMs ?? DEFAULT_CLIPBOARD_TIMEOUT_MS
  const clipboardPollMs = options.clipboardPollMs ?? DEFAULT_CLIPBOARD_POLL_MS

  function currentHref(): string {
    return options.href ?? location.href
  }

  function getConversationSnapshot(): ConversationSnapshot {
    return getChatGptConversationLocation(currentHref())
  }

  function getConversationId(): string {
    return getConversationSnapshot().conversationId || '__default__'
  }

  function getResponseContainers(): Element[] {
    return [...document.querySelectorAll(CHATGPT_SELECTORS.response)]
  }

  function getAllAssistantReplies(): string[] {
    return keepDeepestResponseContainers(getResponseContainers()).map(container => extractCleanText(container)).filter(Boolean)
  }

  async function fillAndSend(content: string, autoSend = true): Promise<void> {
    const editor = await waitForElement(CHATGPT_SELECTORS.editor, inputTimeoutMs)

    setContentEditableText(editor, content)
    if (readEditorText(editor) !== content.trim()) {
      throw new Error('ChatGPT editor did not accept the prompt text')
    }

    if (!autoSend) return

    const sendButton = await waitForClickableButton(CHATGPT_SELECTORS.sendButton, inputTimeoutMs, 'ChatGPT 发送按钮暂不可用，请稍后重试')
    sendButton.click()
  }

  return {
    id: 'chatgpt',
    getConversationSnapshot,
    getConversationId,
    getResponseContainers,
    getAllAssistantReplies,
    readResponseText: extractCleanText,
    readResponseTextFromCopy: node => readResponseTextFromCopy(node, clipboardTimeoutMs, clipboardPollMs),
    readResponseMarkdown: extractMarkdownFromDom,
    findResponseContainer,
    isGenerating: isChatGptGenerating,
    fillAndSend,
    collectPromptDiagnostics,
  }
}

async function readResponseTextFromCopy(node: Node, timeoutMs: number, pollMs: number): Promise<string | undefined> {
  return readResponseTextFromCopyAction({ node, timeoutMs, pollMs, findCopyButton })
}

function findCopyButton(response: Element): HTMLButtonElement | undefined {
  const turn = response.closest(CHATGPT_SELECTORS.turn) ?? response.parentElement
  return findClickableCopyButton(turn, CHATGPT_SELECTORS.copyButton)
}

export function getChatGptConversationLocation(href: string): ConversationSnapshot {
  const url = parseSafeChatGptUrl(href)
  if (!url) return {}

  return {
    conversationId: extractConversationId(url),
    conversationUrl: url.href,
  }
}

function parseSafeChatGptUrl(value: string | undefined): URL | undefined {
  if (!value) return undefined

  try {
    const url = new URL(value)
    return url.protocol === 'https:' && CHATGPT_HOSTS.has(url.hostname) ? url : undefined
  } catch {
    return undefined
  }
}

function extractConversationId(url: URL): string | undefined {
  if (!url.pathname.startsWith('/c/')) return undefined

  const conversationId = url.pathname.slice('/c/'.length).split('/')[0]
  return conversationId ? decodeURIComponent(conversationId) : undefined
}

function collectPromptDiagnostics(): Record<string, unknown> {
  return {
    href: location.href,
    readyState: document.readyState,
    visibilityState: document.visibilityState,
    title: document.title,
    editorMatches: [...document.querySelectorAll(CHATGPT_SELECTORS.editor)].slice(0, 5).map(describeElement),
    sendButtonMatches: [...document.querySelectorAll(CHATGPT_SELECTORS.sendButton)].slice(0, 5).map(describeElement),
    visibleButtonSamples: [...document.querySelectorAll('button')].slice(0, 12).map(describeElement),
  }
}

function extractCleanText(node: Node): string {
  return extractCleanTextFromDom(node, { skipTags: SKIP_TAGS })
}

function findResponseContainer(element: Element | null): Element | null {
  return findClosestMatchingAncestor(element, CHATGPT_SELECTORS.response)
}

function isChatGptGenerating(): boolean {
  return [...document.querySelectorAll('button')].some(button => {
    return buttonLabelMatches(button, /stop|stopping|停止|中止/) && isClickableButton(button as HTMLElement)
  })
}
