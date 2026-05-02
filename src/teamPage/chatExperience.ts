import type { GroupChat, GroupRole } from '../group/types'

export const THINKING_TIMEOUT_MS = 120_000

export type KeyboardShortcutEvent = Pick<KeyboardEvent, 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'>

interface GraphemeSegment {
  segment: string
}

interface GraphemeSegmenter {
  segment(value: string): Iterable<GraphemeSegment>
}

interface IntlWithSegmenter {
  Segmenter?: new (locale: string | undefined, options: { granularity: 'grapheme' }) => GraphemeSegmenter
}

export function getAvatarInitial(name: string | undefined, fallback = 'AI'): string {
  const trimmed = name?.trim()
  if (!trimmed) return fallback

  const Segmenter = (Intl as IntlWithSegmenter).Segmenter
  const segmenter = Segmenter ? new Segmenter(undefined, { granularity: 'grapheme' }) : undefined
  const firstSegment = segmenter?.segment(trimmed)[Symbol.iterator]().next().value?.segment
  return (firstSegment ?? Array.from(trimmed)[0] ?? fallback).toUpperCase()
}

export function shouldConfirmMentionWithEnter(event: KeyboardShortcutEvent): boolean {
  return event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey
}

export function shouldSendMessageWithEnter(event: KeyboardShortcutEvent): boolean {
  return event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey
}

export function isThinkingBubbleVisible(role: Pick<GroupRole, 'status' | 'updatedAt'>, now = Date.now()): boolean {
  return role.status === 'thinking' && now - role.updatedAt < THINKING_TIMEOUT_MS
}

export function getVisibleThinkingRoles(roles: GroupRole[], now = Date.now()): GroupRole[] {
  return roles.filter(role => isThinkingBubbleVisible(role, now))
}

export interface ChatStartupNotice {
  title: string
  body: string
}

export function getChatStartupNotice(chat: Pick<GroupChat, 'status'>, roles: Pick<GroupRole, 'status'>[]): ChatStartupNotice | undefined {
  const hasStartingRole = roles.some(role => role.status === 'pending' || role.status === 'loading')
  if (chat.status !== 'initializing' && chat.status !== 'running' && !hasStartingRole) return undefined
  return {
    title: '正在初始化角色',
    body: '正在创建角色窗口，准备好后就可以继续对话。',
  }
}

export function formatChatListTime(timestamp: number, now = Date.now()): string {
  if (!timestamp) return '-'

  const current = new Date(now)
  const target = new Date(timestamp)
  const currentDay = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime()
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  const dayDelta = Math.round((currentDay - targetDay) / 86_400_000)

  if (dayDelta === 0) {
    return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(target)
  }
  if (dayDelta === 1) return '昨天'
  if (dayDelta === 2) return '前天'

  const month = String(target.getMonth() + 1).padStart(2, '0')
  const day = String(target.getDate()).padStart(2, '0')
  if (target.getFullYear() === current.getFullYear()) return `${month}/${day}`
  return `${target.getFullYear()}/${month}/${day}`
}
