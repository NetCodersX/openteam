import type { BackgroundToHostMessage, HostToBackgroundMessage, TeamMessage, TeamRole, TeamRoomState } from '../team/types'

type BackgroundResponse<T = unknown> = T & { ok: boolean; error?: string }
type HostPushMessage = { type: 'OPENTEAM_HOST_PUSH'; payload: BackgroundToHostMessage }

const GEMINI_IFRAME_URL = 'https://gemini.google.com/'
const FRAME_ASSIGN_MESSAGE = 'OPENTEAM_ASSIGN_FRAME_ROLE'

let currentState: TeamRoomState | null = null
let currentTabId: number | undefined
const iframeByRoleId = new Map<string, HTMLIFrameElement>()
const cardByRoleId = new Map<string, HTMLElement>()
const assignTimersByRoleId = new Map<string, number>()

function sendRuntimeMessage<T>(message: HostToBackgroundMessage): Promise<BackgroundResponse<T>> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(response as BackgroundResponse<T>)
    })
  })
}

function messageTitle(message: TeamMessage): string {
  if (message.from === 'user') {
    if (message.target === 'all') return '你 -> all'
    if (message.target === 'role') return `你 -> ${message.targetRoleName || '角色'}`
    return '你'
  }

  if (message.from === 'role') return message.roleName || '角色'
  return '系统'
}

function roleStatusLabel(role: TeamRole): string {
  if (role.status === 'opening') return '打开中'
  if (role.status === 'online') return '在线'
  if (role.status === 'sending') return '发送中'
  if (role.status === 'generating') return '生成中'
  if (role.status === 'idle') return '空闲'
  if (role.status === 'offline') return '离线'
  return '异常'
}

function assignRoleToFrame(role: TeamRole, iframe: HTMLIFrameElement): void {
  iframe.contentWindow?.postMessage({
    type: FRAME_ASSIGN_MESSAGE,
    roleId: role.id,
    roleName: role.name,
  }, '*')
}

function startAssignLoop(role: TeamRole, iframe: HTMLIFrameElement): void {
  stopAssignLoop(role.id)
  assignRoleToFrame(role, iframe)

  const timer = window.setInterval(() => {
    const latestRole = currentState?.roles.find(item => item.id === role.id)
    if (!latestRole || latestRole.status !== 'opening') {
      stopAssignLoop(role.id)
      return
    }

    assignRoleToFrame(latestRole, iframe)
  }, 1000)
  assignTimersByRoleId.set(role.id, timer)
}

function stopAssignLoop(roleId: string): void {
  const timer = assignTimersByRoleId.get(roleId)
  if (timer === undefined) return

  window.clearInterval(timer)
  assignTimersByRoleId.delete(roleId)
}

function ensureRoleIframe(role: TeamRole): HTMLIFrameElement {
  const existing = iframeByRoleId.get(role.id)
  if (existing) return existing

  const iframe = document.createElement('iframe')
  iframe.className = 'role-frame'
  iframe.title = `${role.name} Gemini`
  iframe.src = GEMINI_IFRAME_URL
  iframe.allow = 'clipboard-read; clipboard-write; microphone; camera; geolocation; autoplay; fullscreen; picture-in-picture; storage-access; web-share'
  iframe.dataset.roleId = role.id
  iframe.setAttribute('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
  iframe.setAttribute('accept-language', 'zh-CN,zh;q=0.9,en;q=0.8')
  iframe.setAttribute('sec-ch-ua', '"Chromium";v="122", "Google Chrome";v="122"')
  iframe.setAttribute('sec-ch-ua-mobile', '?0')
  iframe.setAttribute('sec-ch-ua-platform', '"Macintosh"')
  iframe.addEventListener('load', () => startAssignLoop(role, iframe))
  iframeByRoleId.set(role.id, iframe)
  startAssignLoop(role, iframe)
  return iframe
}

function removeMissingIframes(state: TeamRoomState): void {
  const activeRoleIds = new Set(state.roles.filter(role => role.status !== 'offline').map(role => role.id))
  for (const [roleId, iframe] of iframeByRoleId) {
    if (activeRoleIds.has(roleId)) continue
    cardByRoleId.get(roleId)?.remove()
    iframeByRoleId.delete(roleId)
    cardByRoleId.delete(roleId)
    stopAssignLoop(roleId)
  }
}

function createRoleCard(role: TeamRole): HTMLElement {
  const card = document.createElement('section')
  card.className = 'role-card'
  card.dataset.roleId = role.id

  const header = document.createElement('div')
  header.className = 'role-header'
  header.innerHTML = `
      <div>
        <strong></strong>
        <span></span>
      </div>
      <button type="button" title="移除">x</button>
    `
  header.querySelector('button')!.addEventListener('click', () => {
    sendRuntimeMessage({ type: 'TEAM_REMOVE_ROLE', roleId: role.id }).catch(error => showError(error.message))
  })

  const iframe = ensureRoleIframe(role)
  card.append(header, iframe)
  cardByRoleId.set(role.id, card)
  return card
}

function updateRoleCard(role: TeamRole, card: HTMLElement): void {
  card.dataset.status = role.status
  card.querySelector('strong')!.textContent = role.name
  card.querySelector('span')!.textContent = role.lastError || roleStatusLabel(role)

  if (role.status !== 'opening') stopAssignLoop(role.id)
}

function renderRoles(state: TeamRoomState): void {
  const rolesEl = document.querySelector<HTMLElement>('#roles')
  if (!rolesEl) return

  for (const role of state.roles.filter(item => item.status !== 'offline')) {
    const card = cardByRoleId.get(role.id) ?? createRoleCard(role)
    updateRoleCard(role, card)

    if (card.parentElement !== rolesEl) {
      rolesEl.append(card)
    }
  }
}

function renderMessages(state: TeamRoomState): void {
  const messagesEl = document.querySelector<HTMLElement>('#messages')
  if (!messagesEl) return

  messagesEl.replaceChildren()
  if (state.messages.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty'
    empty.textContent = '还没有消息'
    messagesEl.append(empty)
    return
  }

  for (const message of state.messages) {
    const item = document.createElement('article')
    item.className = `message ${message.from}`
    const title = document.createElement('div')
    title.className = 'message-title'
    title.textContent = messageTitle(message)
    const body = document.createElement('div')
    body.textContent = message.content
    item.append(title, body)
    messagesEl.append(item)
  }
  messagesEl.scrollTop = messagesEl.scrollHeight
}

function render(state: TeamRoomState): void {
  currentState = state
  document.querySelector('#summary')!.textContent = `${state.roles.filter(role => role.status !== 'offline').length} 个角色 · ${state.messages.length} 条消息`
  removeMissingIframes(state)
  renderRoles(state)
  renderMessages(state)
}

function showError(message: string): void {
  const errorEl = document.querySelector<HTMLElement>('#error')
  if (!errorEl) return

  errorEl.textContent = message
  errorEl.hidden = false
  window.setTimeout(() => {
    errorEl.hidden = true
  }, 4500)
}

function registerRuntimePush(): void {
  chrome.runtime.onMessage.addListener((message: HostPushMessage) => {
    if (message?.type !== 'OPENTEAM_HOST_PUSH') return false

    if (message.payload.type === 'TEAM_STATE_UPDATED') {
      render(message.payload.state)
    } else if (message.payload.type === 'TEAM_ERROR') {
      showError(message.payload.message)
    }
    return false
  })
}

function registerUi(): void {
  document.querySelector<HTMLFormElement>('#add-role')?.addEventListener('submit', event => {
    event.preventDefault()
    const input = document.querySelector<HTMLInputElement>('#role-name')
    const name = input?.value.trim() || ''
    if (!name) return

    if (input) input.value = ''
    sendRuntimeMessage<{ role: TeamRole }>({ type: 'TEAM_CREATE_ROLE', name, container: 'iframe', hostTabId: currentTabId })
      .catch(error => showError(error.message))
  })

  document.querySelector<HTMLFormElement>('#composer')?.addEventListener('submit', event => {
    event.preventDefault()
    const textarea = document.querySelector<HTMLTextAreaElement>('#prompt')
    const raw = textarea?.value.trim() || ''
    if (!raw) return

    if (textarea) textarea.value = ''
    sendRuntimeMessage({ type: 'TEAM_SEND_MESSAGE', raw }).catch(error => showError(error.message))
  })
}

async function boot(): Promise<void> {
  registerRuntimePush()
  registerUi()

  const tab = await chrome.tabs.getCurrent()
  currentTabId = tab?.id

  const ready = await sendRuntimeMessage<{ state: TeamRoomState }>({ type: 'TEAM_HOST_READY', hostTabId: currentTabId })
  if (ready.ok && ready.state) {
    render(ready.state)
    return
  }

  const state = await sendRuntimeMessage<{ state: TeamRoomState }>({ type: 'TEAM_GET_STATE' })
  if (state.ok && state.state) render(state.state)
}

boot().catch(error => showError(error instanceof Error ? error.message : String(error)))
