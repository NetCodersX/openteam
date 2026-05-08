// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createDefaultStore } from '../group/store'
import type { GroupChat, GroupRole, OpenTeamStore } from '../group/types'
import { createOrchestrationModalView } from './orchestrationModalView'

class MockGraph {
  constructor(public options: Record<string, unknown>) {}
  clearCells(): void {}
  addNode(node: unknown): unknown { return node }
  addEdge(edge: unknown): unknown { return edge }
  on(_eventName: string, _handler: (args: { node?: { getData(): Record<string, unknown> } }) => void): void {}
  dispose(): void {}
}

interface Harness {
  refs: {
    openOrchestrationEl: HTMLButtonElement
    orchestrationModalEl: HTMLElement
    closeOrchestrationEl: HTMLButtonElement
    orchestrationTaskEl: HTMLTextAreaElement
    orchestrationPeopleListEl: HTMLElement
    orchestrationCanvasEl: HTMLElement
    orchestrationHintEl: HTMLElement
    orchestrationStageSettingsEl: HTMLElement
    orchestrationReviewSettingsEl: HTMLElement
    orchestrationMaxRoundsEl: HTMLInputElement
    saveOrchestrationEl: HTMLButtonElement
    runOrchestrationEl: HTMLButtonElement
  }
  store: OpenTeamStore
  runCommand: Mock<[string, Record<string, unknown>?], Promise<void>>
  errors: string[]
  successes: string[]
}

function createHarness(): Harness {
  document.body.innerHTML = `
    <button id="open-orchestration"></button>
    <div id="orchestration-modal" hidden>
      <button id="close-orchestration"></button>
      <textarea id="orchestration-task"></textarea>
      <div id="orchestration-people-list"></div>
      <div id="orchestration-stage-canvas"></div>
      <p id="orchestration-empty-hint"></p>
      <div id="orchestration-stage-settings"></div>
      <div id="orchestration-review-settings"></div>
      <input id="orchestration-max-rounds" />
      <button id="save-orchestration"></button>
      <button id="run-orchestration"></button>
    </div>
  `
  const store = createDefaultStore()
  const chat: GroupChat = { id: 'chat-1', name: '测试群聊', mode: 'collaborative', roleIds: ['role-1', 'role-2'], messageIds: [], nextMessageSeq: 1, status: 'ready', createdAt: 1, updatedAt: 1 }
  const roleOne: GroupRole = { id: 'role-1', chatId: 'chat-1', name: '产品', status: 'ready', contextCursor: 0, createdAt: 1, updatedAt: 1 }
  const roleTwo: GroupRole = { id: 'role-2', chatId: 'chat-1', name: '评审', status: 'ready', contextCursor: 0, createdAt: 1, updatedAt: 1 }
  store.currentChatId = chat.id
  store.chatOrder = [chat.id]
  store.chatsById[chat.id] = chat
  store.rolesById[roleOne.id] = roleOne
  store.rolesById[roleTwo.id] = roleTwo
  return {
    refs: {
      openOrchestrationEl: document.querySelector('#open-orchestration') as HTMLButtonElement,
      orchestrationModalEl: document.querySelector('#orchestration-modal') as HTMLElement,
      closeOrchestrationEl: document.querySelector('#close-orchestration') as HTMLButtonElement,
      orchestrationTaskEl: document.querySelector('#orchestration-task') as HTMLTextAreaElement,
      orchestrationPeopleListEl: document.querySelector('#orchestration-people-list') as HTMLElement,
      orchestrationCanvasEl: document.querySelector('#orchestration-stage-canvas') as HTMLElement,
      orchestrationHintEl: document.querySelector('#orchestration-empty-hint') as HTMLElement,
      orchestrationStageSettingsEl: document.querySelector('#orchestration-stage-settings') as HTMLElement,
      orchestrationReviewSettingsEl: document.querySelector('#orchestration-review-settings') as HTMLElement,
      orchestrationMaxRoundsEl: document.querySelector('#orchestration-max-rounds') as HTMLInputElement,
      saveOrchestrationEl: document.querySelector('#save-orchestration') as HTMLButtonElement,
      runOrchestrationEl: document.querySelector('#run-orchestration') as HTMLButtonElement,
    },
    store,
    runCommand: vi.fn<[string, Record<string, unknown>?], Promise<void>>(async () => undefined),
    errors: [],
    successes: [],
  }
}

function createView(harness: Harness): ReturnType<typeof createOrchestrationModalView> {
  return createOrchestrationModalView({
    ...harness.refs,
    getStore: () => harness.store,
    getCurrentChat: () => harness.store.currentChatId ? harness.store.chatsById[harness.store.currentChatId] : undefined,
    getCurrentRoles: () => harness.store.currentChatId ? harness.store.chatsById[harness.store.currentChatId].roleIds.map(roleId => harness.store.rolesById[roleId]) : [],
    runCommand: harness.runCommand,
    showError: message => harness.errors.push(message),
    showSuccess: message => harness.successes.push(message),
    loadX6: async () => ({ Graph: MockGraph }),
  })
}

describe('orchestration modal view', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('opens with an empty-stage hint and creates parallel stage nodes from people', () => {
    const harness = createHarness()
    const view = createView(harness)
    view.registerOrchestrationEvents()

    harness.refs.openOrchestrationEl.click()

    expect(harness.refs.orchestrationModalEl.hidden).toBe(false)
    expect(harness.refs.orchestrationHintEl.hidden).toBe(false)
    expect(harness.refs.orchestrationMaxRoundsEl.value).toBe('1')
    const buttons = [...harness.refs.orchestrationPeopleListEl.querySelectorAll('button')]
    buttons.find(button => button.textContent === '新阶段')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    buttons.find(button => button.textContent === '并行加入' && !button.hasAttribute('disabled'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(harness.refs.orchestrationHintEl.hidden).toBe(true)
    expect(harness.refs.orchestrationStageSettingsEl.textContent).toContain('产品')
  })

  it('validates max rounds and saves a stage draft through GROUP_ORCHESTRATION_FLOW_SAVE', async () => {
    const harness = createHarness()
    const view = createView(harness)
    view.registerOrchestrationEvents()
    harness.refs.openOrchestrationEl.click()
    const firstNewStage = [...harness.refs.orchestrationPeopleListEl.querySelectorAll('button')].find(button => button.textContent === '新阶段') as HTMLButtonElement
    firstNewStage.click()
    harness.refs.orchestrationMaxRoundsEl.value = '51'

    harness.refs.saveOrchestrationEl.click()
    await Promise.resolve()

    expect(harness.errors).toContain('最大轮数需在 1-50 之间')
    harness.refs.orchestrationMaxRoundsEl.value = '1'
    harness.refs.saveOrchestrationEl.click()
    await Promise.resolve()

    expect(harness.runCommand).toHaveBeenCalledWith('GROUP_ORCHESTRATION_FLOW_SAVE', expect.objectContaining({ chatId: 'chat-1', flow: expect.objectContaining({ maxRounds: 1 }) }))
  })

  it('validates run task and review settings before GROUP_ORCHESTRATION_RUN', async () => {
    const harness = createHarness()
    const view = createView(harness)
    view.registerOrchestrationEvents()
    harness.refs.openOrchestrationEl.click()
    const reviewButton = [...harness.refs.orchestrationPeopleListEl.querySelectorAll('button')].find(button => button.textContent === '设为审核') as HTMLButtonElement
    reviewButton.click()

    harness.refs.runOrchestrationEl.click()
    await Promise.resolve()
    expect(harness.errors).toContain('请输入编排任务')

    harness.refs.orchestrationTaskEl.value = '完成方案评审'
    harness.refs.runOrchestrationEl.click()
    await Promise.resolve()
    expect(harness.errors).toContain('审核阶段需要审核人员和审核标准')

    const criteria = harness.refs.orchestrationReviewSettingsEl.querySelector('textarea') as HTMLTextAreaElement
    criteria.value = '必须包含结论'
    criteria.dispatchEvent(new Event('input', { bubbles: true }))
    harness.refs.runOrchestrationEl.click()
    await Promise.resolve()

    expect(harness.runCommand).toHaveBeenCalledWith('GROUP_ORCHESTRATION_RUN', expect.objectContaining({ chatId: 'chat-1', task: '完成方案评审', flow: expect.any(Object) }))
  })
})
