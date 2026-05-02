import { describe, expect, it } from 'vitest'
import type { GroupRole } from '../group/types'
import { getAvatarInitial, getVisibleThinkingRoles, isThinkingBubbleVisible, shouldConfirmMentionWithEnter, shouldSendMessageWithEnter, THINKING_TIMEOUT_MS } from './chatExperience'

const baseRole: GroupRole = {
  id: 'role-1',
  chatId: 'chat-1',
  name: '工程师',
  status: 'thinking',
  contextCursor: 0,
  updatedAt: 1_000,
  createdAt: 1_000,
}

describe('chat experience helpers', () => {
  it('uses one user-perceived character for avatar initials', () => {
    expect(getAvatarInitial('产品经理')).toBe('产')
    expect(getAvatarInitial('👩‍💻 工程师')).toBe('👩‍💻')
    expect(getAvatarInitial(' Alice ')).toBe('A')
  })

  it('sends on Enter while leaving Command/Control+Enter for newlines', () => {
    expect(shouldSendMessageWithEnter({ key: 'Enter', shiftKey: false, metaKey: false, ctrlKey: false })).toBe(true)
    expect(shouldSendMessageWithEnter({ key: 'Enter', shiftKey: false, metaKey: true, ctrlKey: false })).toBe(false)
    expect(shouldSendMessageWithEnter({ key: 'Enter', shiftKey: false, metaKey: false, ctrlKey: true })).toBe(false)
  })

  it('confirms mention options with plain Enter only', () => {
    expect(shouldConfirmMentionWithEnter({ key: 'Enter', shiftKey: false, metaKey: false, ctrlKey: false })).toBe(true)
    expect(shouldConfirmMentionWithEnter({ key: 'Enter', shiftKey: false, metaKey: true, ctrlKey: false })).toBe(false)
    expect(shouldConfirmMentionWithEnter({ key: 'Enter', shiftKey: false, metaKey: false, ctrlKey: true })).toBe(false)
  })

  it('shows one thinking bubble per thinking role until the 120-second timeout', () => {
    const visibleRole = { ...baseRole, id: 'role-visible', updatedAt: 10_000 }
    const timedOutRole = { ...baseRole, id: 'role-timeout', updatedAt: 10_000 - THINKING_TIMEOUT_MS }
    const readyRole = { ...baseRole, id: 'role-ready', status: 'ready' as const, updatedAt: 10_000 }

    expect(isThinkingBubbleVisible(visibleRole, 10_000 + THINKING_TIMEOUT_MS - 1)).toBe(true)
    expect(isThinkingBubbleVisible(timedOutRole, 10_000)).toBe(false)
    expect(getVisibleThinkingRoles([visibleRole, timedOutRole, readyRole], 10_000).map(role => role.id)).toEqual(['role-visible'])
  })
})
