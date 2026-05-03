import type { BackgroundToRoleMessage, HostToBackgroundMessage, RoleToBackgroundMessage, TeamRole, TeamRoomState } from '../team/types'
import { createConversationMonitor, type ConversationMonitor } from './conversationMonitor'
import { registerFrameRoleHandshake } from './frameHandshake'
import { isDirectEmbeddedFrame, isEmbeddedFrame } from './frameEnvironment'
import { createLegacyHostPanel } from './legacyHostPanel'
import { waitBeforePromptInput, PROMPT_INPUT_DELAY_MS } from './promptDelay'
import { createReplyObserver, type ReplyObserverController } from './replyObserver'
import { contentLog as log, sendRuntimeMessage, type ContentRuntimeMessage } from './runtimeClient'
import { createRoleSession } from './roleSession'
import { getActiveChatSiteAdapter } from './sites'

const OPEN_TEAM_LOADED_KEY = '__OPENTEAM_LOADED__'

const siteAdapter = getActiveChatSiteAdapter()

let replyObserver: ReplyObserverController | undefined
let conversationMonitor: ConversationMonitor | undefined

const roleSession = createRoleSession({
  siteAdapter,
  log,
  onAssigned() {
    replyObserver?.resetForAssignedRole()
    conversationMonitor?.reportConversationUpdate(true)
  },
})

const legacyPanel = createLegacyHostPanel({
  log,
  sendRuntimeMessage: message => sendBackgroundMessage(message),
})

conversationMonitor = createConversationMonitor({
  siteAdapter,
  roleSession,
  log,
  sendRuntimeMessage: message => sendBackgroundMessage(message),
})

replyObserver = createReplyObserver({
  siteAdapter,
  roleSession,
  log,
  sendRuntimeMessage: message => sendBackgroundMessage(message),
  reportRoleError,
})

function collectPromptDiagnostics(): Record<string, unknown> {
  return {
    site: siteAdapter.id,
    assignedRole: roleSession.getAssignedRole(),
    ...siteAdapter.collectPromptDiagnostics(),
  }
}

function sendBackgroundMessage<T>(message: HostToBackgroundMessage | RoleToBackgroundMessage): Promise<T> {
  return sendRuntimeMessage<T>(message, log)
}

async function fillAndSend(content: string, autoSend = true): Promise<void> {
  log.info('fill-send:start', { site: siteAdapter.id, contentLength: content.length, autoSend, diagnostics: collectPromptDiagnostics() })
  await siteAdapter.fillAndSend(content, autoSend)
  log.info('fill-send:done', { site: siteAdapter.id, contentLength: content.trim().length, autoSend })
}

function reportRoleError(
  messageId: string | undefined,
  reason: string,
  chatId = roleSession.getAssignedChatId(),
  roleId = roleSession.getAssignedRole()?.roleId || '',
  replyAttemptId = roleSession.getActiveReplyAttemptId(),
): void {
  const assignedRole = roleSession.getAssignedRole()
  if (!chatId || !roleId) {
    log.warn('role-error:skipped-missing-identity', { messageId, reason, assignedRole })
    return
  }

  log.warn('role-error:report', { chatId, roleId, messageId, reason, diagnostics: collectPromptDiagnostics() })
  sendBackgroundMessage({
    type: 'TEAM_ROLE_ERROR',
    chatId,
    roleId,
    messageId,
    replyAttemptId,
    reason,
  }).catch(error => log.warn('role-error:failed', { error: error instanceof Error ? error.message : String(error) }))
}

function assignLegacyRole(message: Extract<BackgroundToRoleMessage, { type: 'TEAM_ASSIGN_ROLE' }>): void {
  roleSession.assignRole({
    chatId: message.chatId || message.roomId,
    roleId: message.roleId,
    roleName: message.roleName,
    roomId: message.roomId,
  })
}

function registerMessageHandlers(): void {
  chrome.runtime.onMessage.addListener((message: ContentRuntimeMessage, _sender, sendResponse) => {
    if (message?.type === 'TEAM_ASSIGN_ROLE') {
      log.info('message:assign-role', { chatId: message.chatId, roleId: message.roleId, roleName: message.roleName, roomId: message.roomId })
      assignLegacyRole(message)
      sendResponse({ ok: true })
      return false
    }

    if (message?.type === 'TEAM_STATE_UPDATED') {
      log.debug('message:state-updated', { roles: message.state.roles.length, messages: message.state.messages.length })
      legacyPanel.ensureHostPanel(message.state)
      sendResponse({ ok: true })
      return false
    }

    if (message?.type === 'TEAM_ERROR') {
      log.warn('message:team-error', { message: message.message })
      sendResponse({ ok: true })
      return false
    }

    if (message?.type !== 'TEAM_SEND_PROMPT') return false

    handleSendPromptMessage(message, sendResponse)
    return true
  })
}

function handleSendPromptMessage(message: Extract<BackgroundToRoleMessage, { type: 'TEAM_SEND_PROMPT' }>, sendResponse: (response?: unknown) => void): void {
  const promptChatId = message.chatId || roleSession.getAssignedChatId()
  const promptRoleId = message.roleId || roleSession.getAssignedRole()?.roleId || ''
  log.info('message:send-prompt', {
    chatId: promptChatId,
    roleId: promptRoleId,
    messageId: message.messageId,
    contentLength: message.content.length,
    autoSend: message.autoSend,
  })

  replyObserver?.capturePromptReplyBaseline(message.messageId)
  roleSession.startPrompt(message.messageId, message.replyAttemptId)
  sendBackgroundMessage({ type: 'TEAM_ROLE_STATUS', status: 'sending' })
    .then(() => {
      log.info('message:send-prompt:delay-before-input', { messageId: message.messageId, delayMs: PROMPT_INPUT_DELAY_MS })
      return waitBeforePromptInput()
    })
    .then(() => fillAndSend(message.content, message.autoSend !== false))
    .then(() => {
      conversationMonitor?.reportConversationUpdate()
      if (promptChatId && promptRoleId) {
        sendBackgroundMessage({ type: 'TEAM_SEND_ACK', chatId: promptChatId, roleId: promptRoleId, messageId: message.messageId }).catch(error =>
          log.warn('message:send-prompt:ack-failed', { messageId: message.messageId, error: error instanceof Error ? error.message : String(error) }),
        )
      }
    })
    .then(() => sendBackgroundMessage({ type: 'TEAM_ROLE_STATUS', status: 'generating' }))
    .then(() => {
      replyObserver?.startReplyPolling(message.messageId, message.replyAttemptId)
      log.info('message:send-prompt:ok', { messageId: message.messageId })
      sendResponse({ ok: true, messageId: message.messageId })
    })
    .catch(error => {
      const reason = error instanceof Error ? error.message : String(error)
      log.warn('message:send-prompt:failed', { messageId: message.messageId, error: reason, diagnostics: collectPromptDiagnostics() })
      roleSession.clearActivePrompt(message.messageId)
      replyObserver?.clearPromptReplyBaseline()
      replyObserver?.clearReplyPolling()
      reportRoleError(message.messageId, reason, promptChatId, promptRoleId, message.replyAttemptId)
      sendBackgroundMessage({ type: 'TEAM_ROLE_STATUS', status: 'error', error: reason }).catch(() => undefined)
      sendResponse({ ok: false, messageId: message.messageId, error: reason })
    })
}

async function identifyPage(): Promise<void> {
  const response = await sendBackgroundMessage<{
    ok: boolean
    mode?: 'host' | 'role'
    state?: TeamRoomState
    role?: TeamRole
    error?: string
  }>({
    type: 'TEAM_CONTENT_READY',
    conversationId: siteAdapter.getConversationId(),
  })

  if (!response.ok) {
    log.warn('identify:failed', { error: response.error })
    return
  }

  if (response.mode === 'role' && response.role) {
    log.info('identify:role', { roleId: response.role.id, roleName: response.role.name, tabId: response.role.tabId })
    roleSession.assignRole({
      chatId: legacyPanel.getCurrentState()?.roomId || '',
      roleId: response.role.id,
      roleName: response.role.name,
      roomId: legacyPanel.getCurrentState()?.roomId || '',
    })
    return
  }

  if (response.mode === 'host' && response.state) {
    log.info('identify:host', { roles: response.state.roles.length, messages: response.state.messages.length })
    legacyPanel.ensureHostPanel(response.state)
    sendBackgroundMessage({ type: 'TEAM_HOST_READY' }).catch(error =>
      log.warn('host-ready:failed', { error: error instanceof Error ? error.message : String(error) }),
    )
  }
}

function startOpenTeam(): void {
  const embedded = isEmbeddedFrame()
  const directEmbedded = isDirectEmbeddedFrame()
  log.info('boot', { href: location.href, conversationId: siteAdapter.getConversationId(), embedded, directEmbedded })
  registerMessageHandlers()

  if (embedded) {
    if (directEmbedded) {
      conversationMonitor?.start()
      replyObserver?.startReplyReporting()
      registerFrameRoleHandshake({
        siteAdapter,
        roleSession,
        log,
        getCurrentState: legacyPanel.getCurrentState,
        seedStoredRoleReplies: replies => replyObserver?.seedStoredRoleReplies(replies),
        sendRuntimeMessage: message => sendBackgroundMessage(message),
      })
    }
    return
  }

  conversationMonitor?.start()
  replyObserver?.startReplyReporting()
  identifyPage().catch(error => log.warn('boot:failed', { error: error instanceof Error ? error.message : String(error) }))
}

function bootWhenReady(): void {
  if (document.body) {
    startOpenTeam()
    return
  }

  document.addEventListener('DOMContentLoaded', startOpenTeam, { once: true })
}

if (!(window as unknown as Record<string, boolean>)[OPEN_TEAM_LOADED_KEY]) {
  ;(window as unknown as Record<string, boolean>)[OPEN_TEAM_LOADED_KEY] = true
  bootWhenReady()
}
