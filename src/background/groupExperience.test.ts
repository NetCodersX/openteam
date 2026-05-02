import { describe, expect, it, vi } from 'vitest'
import type { GroupChat, GroupRole, OpenTeamStore, RoleTemplate } from '../group/types'

type RuntimeMessage = { type: string; [key: string]: unknown }
type MessageSender = chrome.runtime.MessageSender

type BackgroundHarness = {
  stored: Record<string, OpenTeamStore>
  storeKey: string
  tabsSendMessage: ReturnType<typeof vi.fn>
  runtimeSendMessage: ReturnType<typeof vi.fn>
  invoke: (message: RuntimeMessage, sender?: MessageSender) => Promise<unknown>
}

async function setupBackground(initialStore?: OpenTeamStore): Promise<BackgroundHarness> {
  vi.resetModules()
  const { STORE_KEY, createDefaultStore } = await import('../group/store')
  const stored: Record<string, OpenTeamStore> = {
    [STORE_KEY]: structuredClone(initialStore ?? createDefaultStore()),
  }
  const listeners: Array<(message: RuntimeMessage, sender: MessageSender, sendResponse: (response: unknown) => void) => boolean> = []
  const tabsSendMessage = vi.fn().mockResolvedValue({ ok: true })
  const runtimeSendMessage = vi.fn().mockResolvedValue({ ok: true })

  vi.stubGlobal('chrome', {
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onMessage: { addListener: vi.fn(listener => listeners.push(listener)) },
      sendMessage: runtimeSendMessage,
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    },
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: stored[key] })),
        set: vi.fn(async (items: Record<string, OpenTeamStore>) => {
          Object.assign(stored, structuredClone(items))
        }),
      },
    },
    tabs: {
      sendMessage: tabsSendMessage,
      create: vi.fn().mockResolvedValue({}),
      onRemoved: { addListener: vi.fn() },
    },
    action: {
      onClicked: { addListener: vi.fn() },
    },
  })

  await import('./index')
  expect(listeners).toHaveLength(1)

  return {
    stored,
    storeKey: STORE_KEY,
    tabsSendMessage,
    runtimeSendMessage,
    invoke: (message, sender = { tab: { id: 900 } as chrome.tabs.Tab, frameId: 0, url: 'https://gemini.google.com/app/test' }) =>
      new Promise(resolve => {
        listeners[0](message, sender, resolve)
      }),
  }
}

describe('background group chat experience handlers', () => {
  it('validates GROUP_ROLES_CREATE_BATCH as a whole batch and keeps temporary people out of the library', async () => {
    const store = makeStore()
    store.chatsById['chat-1'] = makeChat('chat-1')
    store.chatOrder = ['chat-1']
    store.roleTemplatesById['template-1'] = makeTemplate('template-1', '工程师', '从工程角度分析')
    store.roleTemplateOrder = ['template-1']
    const harness = await setupBackground(store)

    const rejected = await harness.invoke({
      type: 'GROUP_ROLES_CREATE_BATCH',
      chatId: 'chat-1',
      items: [
        { source: 'library', roleTemplateId: 'template-1' },
        { source: 'temporary', name: '', systemPrompt: 'invalid' },
      ],
    }) as { ok: boolean; error: string }

    expect(rejected.ok).toBe(false)
    expect(rejected.error).toBe('人员名称不能为空')
    expect(harness.stored[harness.storeKey].chatsById['chat-1'].roleIds).toEqual([])
    expect(harness.stored[harness.storeKey].rolesById).toEqual({})

    const accepted = await harness.invoke({
      type: 'GROUP_ROLES_CREATE_BATCH',
      chatId: 'chat-1',
      items: [
        { source: 'library', roleTemplateId: 'template-1' },
        { source: 'temporary', name: '法务', description: '关注合规', systemPrompt: '从法务角度分析' },
      ],
    }) as { ok: boolean; roles: GroupRole[]; store: OpenTeamStore }

    expect(accepted.ok).toBe(true)
    expect(accepted.roles).toHaveLength(2)
    expect(accepted.roles[0]).toMatchObject({ templateId: 'template-1', name: '工程师', systemPrompt: '从工程角度分析' })
    expect(accepted.roles[1]).toMatchObject({ name: '法务', description: '关注合规', systemPrompt: '从法务角度分析' })
    expect(accepted.roles[1].templateId).toBeUndefined()
    expect(accepted.store.roleTemplateOrder).toEqual(['template-1'])
    expect(Object.keys(accepted.store.roleTemplatesById)).toEqual(['template-1'])
  })

  it('protects used role templates from deletion and deletes unused templates', async () => {
    const store = makeStore()
    store.chatsById['chat-1'] = makeChat('chat-1', ['role-1'])
    store.chatOrder = ['chat-1']
    store.roleTemplatesById['template-used'] = makeTemplate('template-used', '工程师', '工程人设')
    store.roleTemplatesById['template-unused'] = makeTemplate('template-unused', '产品', '产品人设')
    store.roleTemplateOrder = ['template-used', 'template-unused']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师', { templateId: 'template-used' })
    const harness = await setupBackground(store)

    const denied = await harness.invoke({ type: 'ROLE_TEMPLATE_DELETE', templateId: 'template-used' }) as { ok: boolean; error: string }
    expect(denied.ok).toBe(false)
    expect(denied.error).toBe('该人员库人员已被群聊使用，不能删除')
    expect(harness.stored[harness.storeKey].roleTemplatesById['template-used']).toBeDefined()

    const deleted = await harness.invoke({ type: 'ROLE_TEMPLATE_DELETE', templateId: 'template-unused' }) as { ok: boolean; store: OpenTeamStore }
    expect(deleted.ok).toBe(true)
    expect(deleted.store.roleTemplatesById['template-unused']).toBeUndefined()
    expect(deleted.store.roleTemplateOrder).toEqual(['template-used'])
  })

  it('skips full persona in ordinary prompts for roles with an active Gemini conversation', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = makeChat('chat-1', ['role-1'])
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师', {
      systemPrompt: '这是一段很长的人设，普通消息不应重复发送。',
      geminiConversationUrl: 'https://gemini.google.com/app/existing-conversation',
      geminiConversationId: 'existing-conversation',
    })
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/existing-conversation' })
    const response = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '请评估这个方案' }) as { ok: boolean }

    expect(response.ok).toBe(true)
    const promptCalls = harness.tabsSendMessage.mock.calls.filter(call => call[1]?.type === 'TEAM_SEND_PROMPT')
    expect(promptCalls).toHaveLength(1)
    const prompt = promptCalls[0][1]
    expect(prompt.includesPersona).toBe(false)
    expect(prompt.content).toContain('请评估这个方案')
    expect(prompt.content).not.toContain('这是一段很长的人设')
  })

  it('stores explicit mentions for display while sending the cleaned message content', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = makeChat('chat-1', ['role-1'])
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师')
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/test' })
    const response = await harness.invoke({ type: 'GROUP_MESSAGE_SEND', chatId: 'chat-1', raw: '@工程师 请评估这个方案' }) as { ok: boolean; store: OpenTeamStore }

    expect(response.ok).toBe(true)
    const messageId = response.store.chatsById['chat-1'].messageIds[0]
    expect(response.store.messagesById[messageId]).toMatchObject({
      type: 'user',
      content: '请评估这个方案',
      targetRoleIds: ['role-1'],
      mentionedRoleIds: ['role-1'],
    })
  })

  it('renames chats, marks background replies as new, and clears new-message state when read', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = makeChat('chat-1')
    store.chatsById['chat-2'] = makeChat('chat-2', ['role-2'])
    store.chatOrder = ['chat-1', 'chat-2']
    store.rolesById['role-2'] = makeRole('chat-2', 'role-2', '产品经理')
    const harness = await setupBackground(store)

    const reply = await harness.invoke({ type: 'TEAM_ROLE_REPLY', chatId: 'chat-2', roleId: 'role-2', content: '后台回复', messageId: 'msg-user' }) as { ok: boolean; store: OpenTeamStore }
    expect(reply.ok).toBe(true)
    const chatTwoMessageId = reply.store.chatsById['chat-2'].messageIds[0]
    expect(reply.store.messagesById[chatTwoMessageId]).toMatchObject({ chatId: 'chat-2', type: 'assistant', content: '后台回复' })
    expect(reply.store.viewState?.chatHasNewMessageById?.['chat-2']).toBe(true)

    const renamed = await harness.invoke({ type: 'GROUP_CHAT_UPDATE', chatId: 'chat-2', patch: { name: '增长讨论', description: '新描述' } }) as { ok: boolean; chat: GroupChat }
    expect(renamed.ok).toBe(true)
    expect(renamed.chat).toMatchObject({ id: 'chat-2', name: '增长讨论', description: '新描述' })

    const markedRead = await harness.invoke({ type: 'GROUP_CHAT_MARK_READ', chatId: 'chat-2' }) as { ok: boolean; store: OpenTeamStore }
    expect(markedRead.ok).toBe(true)
    expect(markedRead.store.viewState?.chatReadSeqById?.['chat-2']).toBe(markedRead.store.chatsById['chat-2'].nextMessageSeq - 1)
    expect(markedRead.store.viewState?.chatHasNewMessageById?.['chat-2']).toBeUndefined()
  })

  it('deletes a chat with its roles, messages, read state, and runtime bindings', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1']), messageIds: ['msg-1'], nextMessageSeq: 2 }
    store.chatsById['chat-2'] = makeChat('chat-2')
    store.chatOrder = ['chat-1', 'chat-2']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '程序员')
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-1',
      seq: 1,
      type: 'assistant',
      roleId: 'role-1',
      roleName: '程序员',
      content: '历史消息',
      createdAt: 1,
      status: 'received',
    }
    store.viewState = {
      chatReadSeqById: { 'chat-1': 1 },
      chatHasNewMessageById: { 'chat-1': true },
    }
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1', hostTabId: 900 }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 7, url: 'https://gemini.google.com/app/test' })
    const deleted = await harness.invoke({ type: 'GROUP_CHAT_DELETE', chatId: 'chat-1' }) as { ok: boolean; store: OpenTeamStore }

    expect(deleted.ok).toBe(true)
    expect(deleted.store.chatsById['chat-1']).toBeUndefined()
    expect(deleted.store.rolesById['role-1']).toBeUndefined()
    expect(deleted.store.messagesById['msg-1']).toBeUndefined()
    expect(deleted.store.chatOrder).toEqual(['chat-2'])
    expect(deleted.store.currentChatId).toBe('chat-2')
    expect(deleted.store.viewState?.chatReadSeqById?.['chat-1']).toBeUndefined()
    expect(deleted.store.viewState?.chatHasNewMessageById?.['chat-1']).toBeUndefined()
    const snapshot = await harness.invoke({ type: 'GROUP_STORE_GET' }) as { bindings: unknown[] }
    expect(snapshot.bindings).toEqual([])
  })

  it('does not push the switched store back to the tab that already receives the command response', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = makeChat('chat-1')
    store.chatsById['chat-2'] = { ...makeChat('chat-2'), messageIds: ['msg-1'], nextMessageSeq: 2 }
    store.chatOrder = ['chat-1', 'chat-2']
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-2',
      seq: 1,
      type: 'assistant',
      roleName: '产品经理',
      content: '后台回复',
      createdAt: 1,
      status: 'sent',
    }
    const harness = await setupBackground(store)

    await harness.invoke({ type: 'GROUP_STORE_GET' }, { tab: { id: 900 } as chrome.tabs.Tab, frameId: 0 })
    await harness.invoke({ type: 'GROUP_STORE_GET' }, { tab: { id: 901 } as chrome.tabs.Tab, frameId: 0 })
    harness.tabsSendMessage.mockClear()
    const switched = await harness.invoke({ type: 'GROUP_CHAT_SWITCH', chatId: 'chat-2' }, { tab: { id: 900 } as chrome.tabs.Tab, frameId: 0 }) as { ok: boolean; store: OpenTeamStore }

    expect(switched.ok).toBe(true)
    expect(switched.store.currentChatId).toBe('chat-2')
    expect(harness.tabsSendMessage).toHaveBeenCalledTimes(1)
    expect(harness.tabsSendMessage.mock.calls[0][0]).toBe(901)
  })

  it('marks timed-out personnel errors and delivery status through TEAM_ROLE_ERROR', async () => {
    const store = makeStore()
    store.currentChatId = 'chat-1'
    store.chatsById['chat-1'] = { ...makeChat('chat-1', ['role-1']), messageIds: ['msg-1'], nextMessageSeq: 2, status: 'running' }
    store.chatOrder = ['chat-1']
    store.rolesById['role-1'] = makeRole('chat-1', 'role-1', '工程师', { status: 'thinking', lastPromptMessageId: 'msg-1' })
    store.messagesById['msg-1'] = {
      id: 'msg-1',
      chatId: 'chat-1',
      seq: 1,
      type: 'user',
      content: '请分析',
      targetRoleIds: ['role-1'],
      createdAt: 1,
      status: 'pending',
      deliveryStatus: { 'role-1': 'pending' },
    }
    const harness = await setupBackground(store)

    const result = await harness.invoke({ type: 'TEAM_ROLE_ERROR', chatId: 'chat-1', roleId: 'role-1', messageId: 'msg-1', reason: '人员回复超时' }) as { ok: boolean; store: OpenTeamStore }

    expect(result.ok).toBe(true)
    expect(result.store.rolesById['role-1'].status).toBe('error')
    expect(result.store.rolesById['role-1'].lastPromptMessageId).toBeUndefined()
    expect(result.store.messagesById['msg-1'].status).toBe('error')
    expect(result.store.messagesById['msg-1'].deliveryStatus?.['role-1']).toBe('error')
    expect(result.store.chatsById['chat-1'].status).toBe('error')
  })
})

function makeStore(): OpenTeamStore {
  return {
    version: 1,
    chatOrder: [],
    chatsById: {},
    rolesById: {},
    messagesById: {},
    roleTemplateOrder: [],
    roleTemplatesById: {},
    settings: { defaultMode: 'independent', maxContextChars: 6000 },
    viewState: { chatReadSeqById: {}, chatHasNewMessageById: {} },
  }
}

function makeChat(id: string, roleIds: string[] = []): GroupChat {
  return {
    id,
    name: id,
    mode: 'independent',
    roleIds,
    messageIds: [],
    nextMessageSeq: 1,
    status: roleIds.length > 0 ? 'ready' : 'draft',
    createdAt: 1,
    updatedAt: 1,
  }
}

function makeTemplate(id: string, name: string, systemPrompt: string): RoleTemplate {
  return {
    id,
    name,
    systemPrompt,
    createdAt: 1,
    updatedAt: 1,
  }
}

function makeRole(chatId: string, id: string, name: string, overrides: Partial<GroupRole> = {}): GroupRole {
  return {
    id,
    chatId,
    name,
    status: 'ready',
    contextCursor: 0,
    systemPrompt: `${name}人设`,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}
