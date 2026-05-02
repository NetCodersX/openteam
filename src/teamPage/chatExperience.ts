import type { GroupRole } from '../group/types'

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
