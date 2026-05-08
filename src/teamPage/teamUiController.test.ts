// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import type { GroupChat, GroupRole } from '../group/types'
import { createTeamPageState } from './appState'
import { createTeamUiController } from './teamUiController'

describe('createTeamUiController', () => {
  it('does not recover roles whose existing iframe is already assigned', () => {
    const chat = makeChat('chat-1', ['role-1', 'role-2'])
    const roles = [
      makeRole(chat.id, 'role-1'),
      makeRole(chat.id, 'role-2'),
    ]
    const runCommand = vi.fn(async () => undefined)
    const restoreChat = vi.fn(() => roles.map(role => ({
      chatId: chat.id,
      roleId: role.id,
      src: 'https://gemini.google.com/',
      active: true,
      status: 'assigned' as const,
      assignmentAttempts: 1,
    })))

    createTeamUiController({
      state: createTeamPageState(),
      settingsButtonEl: document.querySelector<HTMLButtonElement>('#settings-button')!,
      settingsMenuEl: document.querySelector<HTMLElement>('#settings-menu')!,
      quickCreateChatEl: document.querySelector<HTMLButtonElement>('#quick-create-chat')!,
      createChatFormEl: document.querySelector<HTMLFormElement>('#create-chat-form')!,
      newChatNameEl: document.querySelector<HTMLInputElement>('#new-chat-name')!,
      togglePeopleDrawerEl: document.querySelector<HTMLButtonElement>('#toggle-people-drawer')!,
      rolePanelEl: document.querySelector<HTMLElement>('#role-panel')!,
      iframeHost: { restoreChat },
      getCurrentChat: () => chat,
      getCurrentRoles: () => roles,
      getSelectedLoginSite: () => 'gemini',
      render: vi.fn(),
      renderChatList: vi.fn(),
      renderRolePanel: vi.fn(),
      renderAddPersonDialog: vi.fn(),
      closePeopleModals: vi.fn(),
      closeExternalModels: vi.fn(),
      registerComposerEvents: vi.fn(),
      registerPeopleLibraryEvents: vi.fn(),
      registerExternalModelsEvents: vi.fn(),
      runCommand,
      showError: vi.fn(),
      log: { debug: vi.fn(), info: vi.fn() },
    }).registerUi()

    document.querySelector<HTMLButtonElement>('#restore-chat')!.click()

    expect(restoreChat).toHaveBeenCalledWith({ ...chat, roleIds: roles.map(role => role.id) }, roles)
    expect(runCommand).not.toHaveBeenCalledWith('GROUP_ROLE_RECOVER', expect.anything())
  })
})

function makeChat(id: string, roleIds: string[]): GroupChat {
  return {
    id,
    name: '群聊',
    mode: 'independent',
    roleIds,
    messageIds: [],
    nextMessageSeq: 1,
    status: 'ready',
    createdAt: 1,
    updatedAt: 1,
  }
}

function makeRole(chatId: string, id: string): GroupRole {
  return {
    id,
    chatId,
    name: id,
    status: 'ready',
    contextCursor: 0,
    createdAt: 1,
    updatedAt: 1,
  }
}

document.body.innerHTML = `
  <button id="settings-button"></button>
  <div id="settings-menu" hidden></div>
  <button id="quick-create-chat"></button>
  <form id="create-chat-form" hidden>
    <input id="new-chat-name" />
    <input name="new-chat-mode" value="independent" checked />
  </form>
  <button id="toggle-people-drawer"></button>
  <aside id="role-panel"></aside>
  <button id="close-people-drawer"></button>
  <button id="close-window"></button>
  <button id="cancel-create-chat"></button>
  <button id="restore-chat"></button>
  <button id="open-gemini-login"></button>
`
