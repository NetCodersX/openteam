import { describe, expect, it, vi } from 'vitest'
import type { GroupChat, GroupRole, OpenTeamStore, OrchestrationFlow } from '../group/types'

type RuntimeMessage = { type: string; [key: string]: unknown }
type MessageSender = chrome.runtime.MessageSender

async function setupBackground(initialStore?: OpenTeamStore) {
  vi.resetModules()
  const { STORE_KEY, createDefaultStore, loadStore } = await import('../group/store')
  const stored: Record<string, unknown> = { [STORE_KEY]: structuredClone(initialStore ?? createDefaultStore()) }
  const listeners: Array<(message: RuntimeMessage, sender: MessageSender, sendResponse: (response: unknown) => void) => boolean> = []
  const tabsSendMessage = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('chrome', {
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onMessage: { addListener: vi.fn(listener => listeners.push(listener)) },
      sendMessage: vi.fn().mockResolvedValue({ ok: true }),
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    },
    storage: {
      local: {
        get: vi.fn(async (key?: string | string[] | null) => {
          if (key === null || typeof key === 'undefined') return structuredClone(stored)
          if (Array.isArray(key)) return Object.fromEntries(key.map(item => [item, structuredClone(stored[item])]))
          return { [key]: structuredClone(stored[key]) }
        }),
        set: vi.fn(async (items: Record<string, unknown>) => Object.assign(stored, structuredClone(items))),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key]
        }),
      },
    },
    tabs: { sendMessage: tabsSendMessage, create: vi.fn().mockResolvedValue({}), onRemoved: { addListener: vi.fn() } },
    action: { onClicked: { addListener: vi.fn() } },
  })
  await import('./index')
  expect(listeners).toHaveLength(1)
  return {
    tabsSendMessage,
    getStore: loadStore,
    invoke: (message: RuntimeMessage, sender = { tab: { id: 900 } as chrome.tabs.Tab, frameId: 0, url: 'https://gemini.google.com/app/test' }) => new Promise(resolve => listeners[0](message, sender, resolve)),
  }
}

describe('orchestration background handlers', () => {
  it('saves and deletes flows by chat order', async () => {
    const store = makeStore()
    const harness = await setupBackground(store)
    const flow = makeFlow('chat-1')

    const saved = await harness.invoke({ type: 'GROUP_ORCHESTRATION_FLOW_SAVE', flow }) as { ok: boolean; store: OpenTeamStore }

    expect(saved.ok).toBe(true)
    expect(saved.store.orchestrationFlowsById['flow-1']).toMatchObject({ id: 'flow-1', chatId: 'chat-1', maxRounds: 1 })
    expect(saved.store.orchestrationFlowOrderByChatId['chat-1']).toEqual(['flow-1'])

    const deleted = await harness.invoke({ type: 'GROUP_ORCHESTRATION_FLOW_DELETE', chatId: 'chat-1', flowId: 'flow-1' }) as { ok: boolean; store: OpenTeamStore }

    expect(deleted.ok).toBe(true)
    expect(deleted.store.orchestrationFlowsById['flow-1']).toBeUndefined()
    expect(deleted.store.orchestrationFlowOrderByChatId['chat-1']).toEqual([])
  })

  it('runs with submitted flow draft stages instead of requiring a flowId', async () => {
    const store = makeStore(['role-1', 'role-2'])
    store.orchestrationFlowsById['flow-1'] = makeFlow('chat-1', ['role-1'])
    store.orchestrationFlowOrderByChatId['chat-1'] = ['flow-1']
    const harness = await setupBackground(store)
    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-1' }, { tab: { id: 101 } as chrome.tabs.Tab, frameId: 1, url: 'https://gemini.google.com/app/one' })
    await harness.invoke({ type: 'TEAM_FRAME_ROLE_READY', chatId: 'chat-1', roleId: 'role-2' }, { tab: { id: 102 } as chrome.tabs.Tab, frameId: 2, url: 'https://gemini.google.com/app/two' })
    const draft = makeFlow('chat-1', ['role-2'])
    draft.stages[0].id = 'draft-stage'
    draft.stages[0].name = 'Draft stage'

    const started = await harness.invoke({ type: 'GROUP_ORCHESTRATION_RUN', chatId: 'chat-1', task: 'Use draft', flow: draft }) as { ok: boolean; run: { id: string }; store: OpenTeamStore }

    expect(started.ok).toBe(true)
    expect(promptCalls(harness.tabsSendMessage)).toHaveLength(1)
    expect(promptCalls(harness.tabsSendMessage)[0][1]).toMatchObject({ roleId: 'role-2' })
    const latestStore = await harness.getStore()
    expect(latestStore.orchestrationFlowsById['flow-1'].stages).toEqual(draft.stages)
    expect(latestStore.orchestrationRunsById[started.run.id].stageRuns[0]).toMatchObject({ stageId: 'draft-stage' })
  })
})

function makeStore(roleIds: string[] = ['role-1']): OpenTeamStore {
  return {
    version: 5,
    chatOrder: ['chat-1'],
    chatsById: { 'chat-1': makeChat('chat-1', roleIds) },
    rolesById: Object.fromEntries(roleIds.map(roleId => [roleId, makeRole('chat-1', roleId)])),
    messagesById: {},
    roleTemplateOrder: [],
    roleTemplatesById: {},
    orchestrationFlowsById: {},
    orchestrationFlowOrderByChatId: {},
    orchestrationRunsById: {},
    activeOrchestrationRunIdByChatId: {},
    settings: { defaultMode: 'independent', maxContextChars: 6000, defaultChatSite: 'gemini', externalModelOrder: [], externalModelsById: {} },
  }
}

function makeChat(id: string, roleIds: string[] = []): GroupChat {
  return { id, name: id, mode: 'independent', roleIds, messageIds: [], nextMessageSeq: 1, status: 'ready', createdAt: 1, updatedAt: 1 }
}

function makeRole(chatId: string, id: string): GroupRole {
  return { id, chatId, name: id, status: 'ready', contextCursor: 0, createdAt: 1, updatedAt: 1 }
}

function promptCalls(mock: ReturnType<typeof vi.fn>): Array<[number, { type?: string; roleId: string; messageId: string }, { frameId: number }]> {
  return mock.mock.calls.filter(call => call[1]?.type === 'TEAM_SEND_PROMPT') as Array<[number, { type?: string; roleId: string; messageId: string }, { frameId: number }]>
}

function makeFlow(chatId: string, roleIds: string[] = ['role-1']): OrchestrationFlow {
  return { id: 'flow-1', chatId, name: 'Flow', stages: [{ id: 'stage-1', kind: 'roles', name: 'Build', roleIds }], maxRounds: 1, createdAt: 1, updatedAt: 1 }
}
