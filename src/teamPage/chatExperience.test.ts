import { describe, expect, it } from 'vitest'
import type { GroupChat, GroupRole } from '../group/types'
import { formatChatListTime, getAvatarInitial, getChatStartupNotice, getVisibleThinkingRoles, isThinkingBubbleVisible, shouldConfirmMentionWithEnter, shouldSendMessageWithEnter, THINKING_TIMEOUT_MS } from './chatExperience'

const baseRole: GroupRole = {
  id: 'role-1',
  chatId: 'chat-1',
  name: '工程师',
  status: 'thinking',
  contextCursor: 0,
  updatedAt: 1_000,
  createdAt: 1_000,
}

const baseChat: GroupChat = {
  id: 'chat-1',
  name: '产品评审群',
  mode: 'independent',
  roleIds: ['role-1'],
  messageIds: [],
  nextMessageSeq: 1,
  status: 'ready',
  createdAt: 1_000,
  updatedAt: 1_000,
}

describe('chat experience helpers', () => {
  it('uses one user-perceived character for avatar initials', () => {
    expect(getAvatarInitial('产品经理')).toBe('产')
    expect(getAvatarInitial('👩‍💻 工程师')).toBe('👩‍💻')
    expect(getAvatarInitial(' Alice ')).toBe('A')
  })

  it('formats chat list timestamps like a compact conversation list', () => {
    const now = new Date(2026, 4, 2, 12, 0).getTime()

    expect(formatChatListTime(new Date(2026, 4, 2, 9, 35).getTime(), now)).toBe('09:35')
    expect(formatChatListTime(new Date(2026, 4, 1, 23, 13).getTime(), now)).toBe('昨天')
    expect(formatChatListTime(new Date(2026, 3, 30, 9, 18).getTime(), now)).toBe('前天')
    expect(formatChatListTime(new Date(2026, 3, 29, 21, 17).getTime(), now)).toBe('04/29')
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

  it('shows a startup notice while a chat is initializing roles', () => {
    expect(getChatStartupNotice({ ...baseChat, status: 'initializing' }, [{ ...baseRole, status: 'pending' }])).toEqual({
      title: '正在初始化角色',
      body: '正在创建角色窗口，准备好后就可以继续对话。',
    })
    expect(getChatStartupNotice(baseChat, [{ ...baseRole, status: 'loading' }])?.title).toBe('正在初始化角色')
    expect(getChatStartupNotice(baseChat, [{ ...baseRole, status: 'ready' }])).toBeUndefined()
  })
})
