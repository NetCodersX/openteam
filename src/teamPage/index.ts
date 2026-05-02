import type { GroupChat, GroupMessage, GroupRole, MessageReference, OpenTeamStore, RoleStatus, RoleTemplate, RoomMode } from '../group/types'
import { createDefaultStore } from '../group/store'
import { parseGroupMentions } from '../group/mentionParser'
import { createIframeHost } from './iframeHost'
import { getAvatarInitial, getVisibleThinkingRoles, shouldConfirmMentionWithEnter, shouldSendMessageWithEnter, THINKING_TIMEOUT_MS } from './chatExperience'
import { renderMarkdown } from './markdown'

interface RuntimeResponse<T = unknown> {
  ok?: boolean
  error?: string
  store?: OpenTeamStore
  data?: T
}

type StorePushMessage =
  | { type: 'GROUP_STORE_UPDATED'; store: OpenTeamStore }
  | { type: 'GROUP_ROLE_STATUS_UPDATED'; store?: OpenTeamStore }
  | { type: 'GROUP_MESSAGE_DELIVERED'; store?: OpenTeamStore }
  | { type: 'GROUP_MESSAGE_RECEIVED'; store?: OpenTeamStore }
  | { type: 'GROUP_DELIVERY_ERROR'; store?: OpenTeamStore; error?: string }
  | { type: 'TEAM_FRAME_ROLE_READY'; chatId: string; roleId: string; store?: OpenTeamStore }

type TemplateDraft = Pick<RoleTemplate, 'name' | 'description' | 'systemPrompt'>
type RolePatch = Pick<GroupRole, 'name' | 'description'>

const GEMINI_URL = 'https://gemini.google.com/'

let store: OpenTeamStore = createDefaultStore()
let selectedChatId: string | undefined
let selectedRoleId: string | undefined
let selectedTemplateId: string | undefined
let selectedReference: MessageReference | undefined
let hostTabId: number | undefined
let mentionIndex = 0
let peopleDrawerOpen = false
let chatMenuChatId: string | undefined
let thinkingTimeoutTimers: ReturnType<typeof window.setTimeout>[] = []
const loggedThinkingTimeoutRoleIds = new Set<string>()

const appShellEl = requireElement<HTMLElement>('#app')
const floatingDragHandleEl = requireElement<HTMLElement>('#floating-drag-handle')
const toggleWindowSizeEl = requireElement<HTMLButtonElement>('#toggle-window-size')
const storeSummaryEl = requireElement<HTMLElement>('#store-summary')
const chatListEl = requireElement<HTMLElement>('#chat-list')
const chatTitleEl = requireElement<HTMLElement>('#chat-title')
const chatSubtitleEl = requireElement<HTMLElement>('#chat-subtitle')
const chatStatusEl = requireElement<HTMLElement>('#chat-status')
const messagesEl = requireElement<HTMLElement>('#messages')
const roleSummaryEl = requireElement<HTMLElement>('#role-summary')
const roleListEl = requireElement<HTMLElement>('#role-list')
const roleTemplateSelectEl = requireElement<HTMLSelectElement>('#role-template-select')
const templateListEl = requireElement<HTMLElement>('#template-list')
const targetPreviewEl = requireElement<HTMLElement>('#target-preview')
const busyPreviewEl = requireElement<HTMLElement>('#busy-preview')
const sendButtonEl = requireElement<HTMLButtonElement>('#send-message')
const messageInputEl = requireElement<HTMLTextAreaElement>('#message-input')
const referenceDraftEl = requireElement<HTMLElement>('#reference-draft')
const mentionPanelEl = requireElement<HTMLElement>('#mention-panel')
const errorEl = requireElement<HTMLElement>('#error')
const newChatNameEl = requireElement<HTMLInputElement>('#new-chat-name')
const createChatFormEl = requireElement<HTMLFormElement>('#create-chat-form')
const quickCreateChatEl = requireElement<HTMLButtonElement>('#quick-create-chat')
const newRoleNameEl = requireElement<HTMLInputElement>('#new-role-name')
const editRoleNameEl = requireElement<HTMLInputElement>('#edit-role-name')
const editRoleDescriptionEl = requireElement<HTMLTextAreaElement>('#edit-role-description')
const editRolePromptEl = requireElement<HTMLTextAreaElement>('#edit-role-prompt')
const templateNameEl = requireElement<HTMLInputElement>('#template-name')
const templateDescriptionEl = requireElement<HTMLTextAreaElement>('#template-description')
const templatePromptEl = requireElement<HTMLTextAreaElement>('#template-prompt')
const templateFormTitleEl = requireElement<HTMLElement>('#template-form-title')
const deleteTemplateEl = requireElement<HTMLButtonElement>('#delete-template')
const settingsButtonEl = requireElement<HTMLButtonElement>('#settings-button')
const settingsMenuEl = requireElement<HTMLElement>('#settings-menu')
const peopleLibraryModalEl = requireElement<HTMLElement>('#people-library-modal')
const addPersonModalEl = requireElement<HTMLElement>('#add-person-modal')
const peopleLibrarySummaryEl = requireElement<HTMLElement>('#people-library-summary')
const peopleLibraryListEl = requireElement<HTMLElement>('#people-library-list')
const addLibraryPeopleListEl = requireElement<HTMLElement>('#add-library-people-list')
const temporaryPersonNameEl = requireElement<HTMLInputElement>('#temporary-person-name')
const temporaryPersonDescriptionEl = requireElement<HTMLTextAreaElement>('#temporary-person-description')
const temporaryPersonPromptEl = requireElement<HTMLTextAreaElement>('#temporary-person-prompt')
const togglePeopleDrawerEl = requireElement<HTMLButtonElement>('#toggle-people-drawer')
const rolePanelEl = requireElement<HTMLElement>('.role-panel')
const windowLauncherEl = requireElement<HTMLButtonElement>('#window-launcher')
const log = {
  debug(event: string, details?: Record<string, unknown>): void {
    console.debug('[OpenTeam][team-page]', event, details || {})
  },
  info(event: string, details?: Record<string, unknown>): void {
    console.info('[OpenTeam][team-page]', event, details || {})
  },
  warn(event: string, details?: Record<string, unknown>): void {
    console.warn('[OpenTeam][team-page]', event, details || {})
  },
}

const iframeHost = createIframeHost({
  visibleHost: requireElement<HTMLElement>('#iframe-host'),
  onEvent(event) {
    log.debug(`iframe-host:${event.type}`, event)
  },
})

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing element: ${selector}`)
  return element
}

function sendRuntimeMessage<T>(type: string, payload: Record<string, unknown> = {}): Promise<RuntimeResponse<T>> {
  return new Promise((resolve, reject) => {
    const message: Record<string, unknown> = { type, ...payload }
    if (hostTabId !== undefined && typeof message.hostTabId !== 'number') message.hostTabId = hostTabId
    log.debug('runtime-send:start', { type, hostTabId: message.hostTabId })

    chrome.runtime.sendMessage(message, response => {
      const lastError = chrome.runtime.lastError
      if (lastError) {
        log.warn('runtime-send:failed', { type, error: lastError.message })
        reject(new Error(lastError.message))
        return
      }

      log.debug('runtime-send:response', { type, ok: response?.ok, error: response?.error })
      resolve((response ?? {}) as RuntimeResponse<T>)
    })
  })
}

async function runCommand(type: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await sendRuntimeMessage(type, payload)
  if (response.ok === false) throw new Error(response.error || `${type} failed`)
  if (response.store) applyStore(response.store)
  await refreshStore(false)
}

async function resolveHostTabId(): Promise<void> {
  const tab = await chrome.tabs.getCurrent()
  hostTabId = tab?.id
  log.info('host-tab:resolved', { hostTabId, url: tab?.url })
  iframeHost.setHostTabId(hostTabId)
}

async function refreshStore(showFailure = true): Promise<void> {
  try {
    const response = await sendRuntimeMessage('GROUP_STORE_GET')
    if (response.ok === false) throw new Error(response.error || '读取群聊数据失败')
    applyStore(response.store ?? createDefaultStore())
  } catch (error) {
    applyStore(createDefaultStore())
    if (showFailure) showError(error instanceof Error ? error.message : String(error))
  }
}

function applyStore(nextStore: OpenTeamStore): void {
  store = nextStore
  selectedChatId = pickCurrentChatId()
  const roles = getCurrentRoles()
  if (!selectedRoleId || !roles.some(role => role.id === selectedRoleId)) selectedRoleId = roles[0]?.id
  if (selectedReference && selectedReference.messageId && !getCurrentMessages().some(message => message.id === selectedReference?.messageId)) {
    selectedReference = undefined
  }
  syncIframeHost()
  render()
}

function pickCurrentChatId(): string | undefined {
  if (selectedChatId && store.chatsById[selectedChatId]) return selectedChatId
  if (store.currentChatId && store.chatsById[store.currentChatId]) return store.currentChatId
  return [...store.chatOrder]
    .sort((left, right) => (store.chatsById[right]?.updatedAt ?? 0) - (store.chatsById[left]?.updatedAt ?? 0))
    .find(chatId => Boolean(store.chatsById[chatId]))
}

function getCurrentChat(): GroupChat | undefined {
  return selectedChatId ? store.chatsById[selectedChatId] : undefined
}

function getCurrentRoles(): GroupRole[] {
  const chat = getCurrentChat()
  if (!chat) return []
  return chat.roleIds.map(roleId => store.rolesById[roleId]).filter((role): role is GroupRole => Boolean(role))
}

function getCurrentMessages(): GroupMessage[] {
  const chat = getCurrentChat()
  if (!chat) return []
  return chat.messageIds.map(messageId => store.messagesById[messageId]).filter((message): message is GroupMessage => Boolean(message))
}

function getTemplates(): RoleTemplate[] {
  return store.roleTemplateOrder.map(templateId => store.roleTemplatesById[templateId]).filter((template): template is RoleTemplate => Boolean(template))
}

function syncIframeHost(): void {
  const chat = getCurrentChat()
  if (!chat) return
  const roles = getCurrentRoles()
  log.debug('iframe-sync:activate-chat', {
    chatId: chat.id,
    roleIds: roles.map(role => role.id),
    roleStatuses: roles.map(role => ({ id: role.id, name: role.name, status: role.status, conversationUrl: role.geminiConversationUrl })),
  })
  iframeHost.activateChat(chat, roles)
}

function render(): void {
  renderChatList()
  renderChatHeader()
  renderMessages()
  renderComposerState()
  renderRolePanel()
  renderTemplates()
  renderAddPersonDialog()
}

function renderChatList(): void {
  const chats = store.chatOrder.map(chatId => store.chatsById[chatId]).filter((chat): chat is GroupChat => Boolean(chat))
  storeSummaryEl.textContent = `${chats.length} 个群聊 · ${getTemplates().length} 个人员库人员`
  chatListEl.replaceChildren()

  if (chats.length === 0) {
    chatListEl.append(emptyCard('还没有群聊', '在上方创建一个群聊，然后从人员库添加人员。'))
    return
  }

  for (const chat of chats) {
    const item = document.createElement('section')
    const hasActivity = chat.id !== selectedChatId && Boolean(store.viewState?.chatHasNewMessageById?.[chat.id])
    item.className = `chat-item${chat.id === selectedChatId ? ' active' : ''}${hasActivity ? ' has-activity' : ''}`

    const row = document.createElement('div')
    row.className = 'chat-row'
    const name = document.createElement('button')
    name.type = 'button'
    name.className = 'chat-name btn btn-ghost'
    name.textContent = chat.name
    name.addEventListener('click', () => switchChat(chat.id))
    const menuButton = document.createElement('button')
    menuButton.type = 'button'
    menuButton.className = 'icon-btn chat-menu-btn'
    menuButton.setAttribute('aria-label', `打开 ${chat.name} 的群聊菜单`)
    menuButton.textContent = '⋯'
    menuButton.addEventListener('click', event => {
      event.stopPropagation()
      chatMenuChatId = chatMenuChatId === chat.id ? undefined : chat.id
      renderChatList()
    })
    row.append(name, menuButton)

    const summary = document.createElement('div')
    summary.className = 'summary-line'
    summary.textContent = getChatRecentSummary(chat)

    const meta = document.createElement('div')
    meta.className = 'chat-row tiny'
    meta.append(statusPill(chat.status, chatStatusLabel(chat.status)), textNode(`${chat.roleIds.length} 人员 · ${formatTime(chat.updatedAt)}`))
    item.append(row, summary, meta)
    if (chatMenuChatId === chat.id) item.append(chatActionMenu(chat))
    chatListEl.append(item)
  }
}

function chatActionMenu(chat: GroupChat): HTMLElement {
  const menu = document.createElement('div')
  menu.className = 'chat-action-menu'
  const rename = document.createElement('button')
  rename.type = 'button'
  rename.className = 'btn btn-ghost'
  rename.textContent = '编辑名称'
  rename.addEventListener('click', () => {
    const nextName = window.prompt('编辑群聊名称', chat.name)?.trim()
    chatMenuChatId = undefined
    if (!nextName) {
      renderChatList()
      return
    }
    runCommand('GROUP_CHAT_UPDATE', { chatId: chat.id, patch: { name: nextName } }).catch(error => showError(error.message))
  })
  menu.append(rename)
  return menu
}

function renderChatHeader(): void {
  const chat = getCurrentChat()
  const roles = getCurrentRoles()
  const messages = getCurrentMessages()
  if (!chat) {
    chatTitleEl.textContent = '未选择群聊'
    chatSubtitleEl.textContent = '创建或选择一个群聊开始协作'
    chatStatusEl.className = 'status-pill'
    chatStatusEl.textContent = '空'
    togglePeopleDrawerEl.textContent = '群聊人员 0 人'
    togglePeopleDrawerEl.disabled = true
    return
  }

  const thinkingCount = getVisibleThinkingRoles(roles).length
  chatTitleEl.textContent = chat.name
  chatSubtitleEl.textContent = `${modeLabel(chat.mode)} · ${roles.length} 人员 · ${messages.length} 条消息`
  chatStatusEl.className = `status-pill status-${chat.status}`
  chatStatusEl.textContent = chatStatusLabel(chat.status)
  togglePeopleDrawerEl.disabled = false
  togglePeopleDrawerEl.textContent = `群聊人员 ${roles.length} 人${thinkingCount ? ` · ${thinkingCount} 人回复中` : ''} ${peopleDrawerOpen ? '▴' : '▾'}`
  togglePeopleDrawerEl.setAttribute('aria-expanded', String(peopleDrawerOpen))
}

function renderMessages(): void {
  const messages = getCurrentMessages()
  messagesEl.replaceChildren()

  if (!getCurrentChat()) {
    messagesEl.append(emptyCard('选择一个群聊', '左侧群聊列表会显示最近摘要、状态和更新时间。'))
    return
  }

  if (messages.length === 0) {
    messagesEl.append(emptyCard('等待第一条消息', '唤醒人员后，在下方输入任务；无 @ 默认发送给全部人员。'))
  }

  for (const message of messages) {
    const article = document.createElement('article')
    article.className = `message ${message.type}`

    const meta = document.createElement('div')
    meta.className = 'message-meta tiny'
    meta.append(textNode(messageTitle(message)), textNode(formatTime(message.createdAt)))

    const body = document.createElement('div')
    body.className = 'message-body markdown-body'
    body.append(renderMarkdown(message.content))

    if (message.type === 'system') {
      article.append(meta, body)
      messagesEl.append(article)
      continue
    }

    const avatar = document.createElement('div')
    avatar.className = `message-avatar ${messageToneClass(message)}`
    avatar.textContent = messageAvatarLabel(message)

    const content = document.createElement('div')
    content.className = 'message-content'
    content.append(meta, body)
    if (message.references?.length) content.append(referenceBox(message.references[0]))

    if (message.type === 'assistant') {
      const tools = document.createElement('div')
      tools.className = 'message-tools'
      const quote = document.createElement('button')
      quote.type = 'button'
      quote.className = 'btn btn-ghost'
      quote.textContent = '引用'
      quote.addEventListener('click', () => setReference(message))
      tools.append(quote)
      content.append(tools)
    }

    article.append(avatar, content)
    messagesEl.append(article)
  }

  for (const role of getVisibleThinkingRoles(getCurrentRoles())) {
    messagesEl.append(thinkingBubble(role))
  }
  scheduleThinkingTimeouts()
  messagesEl.scrollTop = messagesEl.scrollHeight
}

function scheduleThinkingTimeouts(): void {
  for (const timer of thinkingTimeoutTimers) window.clearTimeout(timer)
  thinkingTimeoutTimers = []

  const now = Date.now()
  for (const role of getCurrentRoles()) {
    if (role.status !== 'thinking') continue
    const remaining = THINKING_TIMEOUT_MS - (now - role.updatedAt)
    if (remaining <= 0) {
      if (!loggedThinkingTimeoutRoleIds.has(role.id)) {
        loggedThinkingTimeoutRoleIds.add(role.id)
        log.warn('ui:thinking-bubble:timeout', { chatId: role.chatId, roleId: role.id, timeoutMs: THINKING_TIMEOUT_MS })
        runCommand('TEAM_ROLE_ERROR', {
          chatId: role.chatId,
          roleId: role.id,
          messageId: role.lastPromptMessageId,
          reason: `等待 ${role.name} 回复超时（${Math.round(THINKING_TIMEOUT_MS / 1000)} 秒）`,
        }).catch(error => showError(error instanceof Error ? error.message : String(error)))
      }
      continue
    }
    loggedThinkingTimeoutRoleIds.delete(role.id)
    thinkingTimeoutTimers.push(window.setTimeout(render, remaining + 1))
  }
}

function thinkingBubble(role: GroupRole): HTMLElement {
  const article = document.createElement('article')
  article.className = 'message assistant thinking'
  const avatar = document.createElement('div')
  avatar.className = `message-avatar ${roleToneClass(role.name)}`
  avatar.textContent = roleAvatarLabel(role.name)
  const content = document.createElement('div')
  content.className = 'message-content'
  const meta = document.createElement('div')
  meta.className = 'message-meta tiny'
  meta.append(textNode(role.name), textNode('回复中'))
  const body = document.createElement('div')
  body.className = 'message-body thinking-dots'
  body.textContent = `${role.name} 正在回复中 `
  content.append(meta, body)
  article.append(avatar, content)
  return article
}

function renderComposerState(): void {
  renderReferenceDraft()
  renderMentionPanel()

  const chat = getCurrentChat()
  const roles = getCurrentRoles()
  const raw = messageInputEl.value.trim()
  const parsed = parseGroupMentions(raw || 'x', roles)
  const targetRoleIds = raw && parsed.ok ? parsed.targetRoleIds : roles.map(role => role.id)
  const targets = roles.filter(role => targetRoleIds.includes(role.id))
  const unavailable = targets.filter(role => role.status !== 'ready')
  const thinking = getVisibleThinkingRoles(roles)

  if (!chat) {
    targetPreviewEl.textContent = '选择群聊后可发送'
    sendButtonEl.disabled = true
  } else if (roles.length === 0) {
    targetPreviewEl.textContent = '当前群聊还没有人员'
    sendButtonEl.disabled = true
  } else if (!raw) {
    targetPreviewEl.textContent = '输入消息后可发送；无 @ 默认全员'
    sendButtonEl.disabled = true
  } else if (!parsed.ok) {
    targetPreviewEl.textContent = parsed.error
    sendButtonEl.disabled = true
  } else if (unavailable.length > 0) {
    targetPreviewEl.textContent = `不可发送：${unavailable.map(role => role.name).join('、')} 未 ready`
    sendButtonEl.disabled = true
  } else {
    targetPreviewEl.textContent = `将发送给：${targets.map(role => role.name).join('、') || '全部人员'}`
    sendButtonEl.disabled = false
  }

  busyPreviewEl.textContent = thinking.length > 0 ? `正在回复：${thinking.map(role => role.name).join('、')}` : ''
}

function renderReferenceDraft(): void {
  referenceDraftEl.replaceChildren()
  if (!selectedReference) {
    referenceDraftEl.hidden = true
    return
  }

  referenceDraftEl.hidden = false
  const content = document.createElement('div')
  const title = document.createElement('div')
  title.className = 'tiny'
  title.textContent = `引用 ${selectedReference.roleName || '人员'} 的观点`
  const body = document.createElement('div')
  body.className = 'summary-line'
  body.textContent = selectedReference.contentSnapshot
  content.append(title, body)

  const cancel = document.createElement('button')
  cancel.type = 'button'
  cancel.className = 'btn btn-ghost'
  cancel.textContent = '取消引用'
  cancel.addEventListener('click', () => {
    selectedReference = undefined
    renderComposerState()
  })
  referenceDraftEl.append(content, cancel)
}

function renderMentionPanel(): void {
  const roles = getCurrentRoles()
  const show = shouldShowMentionPanel(messageInputEl.value) && roles.length > 0
  mentionPanelEl.hidden = !show
  mentionPanelEl.replaceChildren()
  if (!show) return

  roles.forEach((role, index) => {
    const option = document.createElement('button')
    option.type = 'button'
    option.className = `mention-option${index === mentionIndex ? ' active' : ''}`
    const avatar = document.createElement('span')
    avatar.className = `mention-avatar ${roleToneClass(role.name)}`
    avatar.textContent = roleAvatarLabel(role.name)
    const name = document.createElement('span')
    name.textContent = role.name
    option.addEventListener('click', () => insertMention(role))
    option.append(avatar, name)
    mentionPanelEl.append(option)
  })
}

function renderRolePanel(): void {
  const roles = getCurrentRoles()
  const selectedRole = selectedRoleId ? store.rolesById[selectedRoleId] : undefined
  rolePanelEl.classList.toggle('open', peopleDrawerOpen)
  roleSummaryEl.textContent = `${roles.length} 人员${selectedRole ? ` · 当前：${selectedRole.name}` : ''}`
  roleListEl.replaceChildren()

  if (!getCurrentChat()) {
    roleListEl.append(emptyCard('未选择群聊', '选择群聊后可添加、查看、恢复和唤醒人员。'))
  } else if (roles.length === 0) {
    roleListEl.append(emptyCard('暂无人员', '点击添加人员，可从人员库批量加入或临时添加。'))
  } else {
    for (const role of roles) roleListEl.append(roleCard(role))
  }

  editRoleNameEl.value = selectedRole?.name ?? ''
  editRoleDescriptionEl.value = selectedRole?.description ?? ''
  editRolePromptEl.value = selectedRole?.systemPrompt ?? ''
  editRoleNameEl.disabled = true
  editRoleDescriptionEl.disabled = true
  editRolePromptEl.disabled = true
}

function renderTemplates(): void {
  const templates = getTemplates()
  peopleLibrarySummaryEl.textContent = `${templates.length} 人`
  roleTemplateSelectEl.replaceChildren(new Option('不使用人员库，手动创建', ''))
  for (const template of templates) roleTemplateSelectEl.append(new Option(template.name, template.id))

  templateListEl.replaceChildren()
  peopleLibraryListEl.replaceChildren()
  if (templates.length === 0) {
    peopleLibraryListEl.append(emptyCard('暂无人员', '新建人员后，可在添加人员时复用。'))
  } else {
    for (const template of templates) {
      const card = templateCard(template)
      templateListEl.append(card.cloneNode(true))
      peopleLibraryListEl.append(card)
    }
  }

  const selectedTemplate = selectedTemplateId ? store.roleTemplatesById[selectedTemplateId] : undefined
  templateFormTitleEl.textContent = selectedTemplate ? `编辑人员：${selectedTemplate.name}` : '新建人员'
  const used = selectedTemplate ? isTemplateUsed(selectedTemplate.id) : false
  deleteTemplateEl.disabled = !selectedTemplate || used
  deleteTemplateEl.title = used ? '该人员已被群聊使用，不能删除' : ''
  if (selectedTemplate) {
    templateNameEl.value = selectedTemplate.name
    templateDescriptionEl.value = selectedTemplate.description ?? ''
    templatePromptEl.value = selectedTemplate.systemPrompt
  } else {
    templateNameEl.value = ''
    templateDescriptionEl.value = ''
    templatePromptEl.value = ''
  }
}

function roleCard(role: GroupRole): HTMLElement {
  const card = document.createElement('section')
  card.className = `role-card${role.id === selectedRoleId ? ' active' : ''}`
  card.addEventListener('click', () => {
    selectedRoleId = role.id
    renderRolePanel()
  })

  const avatar = document.createElement('div')
  avatar.className = `role-avatar ${roleToneClass(role.name)}`
  avatar.textContent = roleAvatarLabel(role.name)

  const main = document.createElement('div')
  main.className = 'role-card-main'

  const row = document.createElement('div')
  row.className = 'role-row'
  const name = document.createElement('div')
  name.className = 'role-name'
  name.textContent = role.name
  row.append(name, statusPill(role.status, roleStatusLabel(role.status)))

  const description = document.createElement('div')
  description.className = 'role-description'
  description.textContent = role.description || '未填写人员描述'

  const meta = document.createElement('div')
  meta.className = 'chat-row tiny'
  meta.append(textNode(`cursor ${role.contextCursor}`), textNode(role.geminiConversationUrl ? '已有会话' : '未绑定会话'))
  main.append(row, description, meta)

  const more = document.createElement('div')
  more.className = 'role-more'
  more.textContent = '···'
  card.append(avatar, main, more)

  if (role.status === 'error') {
    const error = document.createElement('div')
    error.className = 'reference-box'
    error.textContent = '人员异常。若 Gemini 未登录，请打开登录页后点击恢复人员。'
    main.append(error)
  }
  return card
}

function isTemplateUsed(templateId: string): boolean {
  return Object.values(store.rolesById).some(role => role.templateId === templateId)
}

function templateCard(template: RoleTemplate): HTMLElement {
  const card = document.createElement('section')
  card.className = `template-card${template.id === selectedTemplateId ? ' active' : ''}`
  card.addEventListener('click', () => {
    selectedTemplateId = template.id
    renderTemplates()
  })

  const row = document.createElement('div')
  row.className = 'role-row'
  const name = document.createElement('div')
  name.className = 'role-name'
  name.textContent = template.name
  const used = document.createElement('span')
  used.className = 'tiny'
  used.textContent = isTemplateUsed(template.id) ? '已被群聊使用' : '可删除'
  row.append(name, used)

  const description = document.createElement('div')
  description.className = 'template-description'
  description.textContent = template.description || '未填写人员库描述'
  card.append(row, description)
  return card
}

function renderAddPersonDialog(): void {
  const templates = getTemplates()
  addLibraryPeopleListEl.replaceChildren()
  if (templates.length === 0) {
    addLibraryPeopleListEl.append(emptyCard('人员库为空', '先在人员库中创建人员，或使用右侧临时添加。'))
    return
  }

  for (const template of templates) {
    const label = document.createElement('label')
    label.className = 'select-row'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.value = template.id
    const content = document.createElement('span')
    const name = document.createElement('strong')
    name.textContent = template.name
    const description = document.createElement('div')
    description.className = 'template-description'
    description.textContent = template.description || '未填写描述'
    content.append(name, description)
    label.append(checkbox, content)
    addLibraryPeopleListEl.append(label)
  }
}

function referenceBox(reference: MessageReference): HTMLElement {
  const box = document.createElement('div')
  box.className = 'reference-box'
  box.textContent = `引用 ${reference.roleName || '人员'}：${truncate(reference.contentSnapshot, 160)}`
  return box
}

function emptyCard(title: string, body: string): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'empty-state'
  const card = document.createElement('div')
  card.className = 'empty-card'
  const heading = document.createElement('h3')
  heading.textContent = title
  const paragraph = document.createElement('p')
  paragraph.className = 'muted'
  paragraph.textContent = body
  card.append(heading, paragraph)
  wrapper.append(card)
  return wrapper
}

function statusPill(status: string, label: string): HTMLElement {
  const pill = document.createElement('span')
  pill.className = `status-pill status-${status}`
  pill.textContent = label
  return pill
}

function roleToneClass(seed: string | undefined): string {
  const source = seed || 'OpenTeam'
  let hash = 0
  for (let index = 0; index < source.length; index += 1) hash = (hash + source.charCodeAt(index) * (index + 1)) % 6
  return `role-tone-${hash}`
}

function roleAvatarLabel(name: string | undefined): string {
  return getAvatarInitial(name)
}

function messageAvatarLabel(message: GroupMessage): string {
  if (message.type === 'user') return '你'
  return roleAvatarLabel(message.roleName)
}

function messageToneClass(message: GroupMessage): string {
  if (message.type === 'user') return 'role-tone-5'
  return roleToneClass(message.roleName)
}

function textNode(content: string): Text {
  return document.createTextNode(content)
}

function switchChat(chatId: string): void {
  selectedChatId = chatId
  selectedRoleId = undefined
  selectedReference = undefined
  peopleDrawerOpen = false
  chatMenuChatId = undefined
  render()
  runCommand('GROUP_CHAT_SWITCH', { chatId })
    .then(() => runCommand('GROUP_CHAT_MARK_READ', { chatId }))
    .catch(error => showError(error.message))
}

function setReference(message: GroupMessage): void {
  selectedReference = {
    messageId: message.id,
    roleId: message.roleId,
    roleName: message.roleName,
    contentSnapshot: message.content,
  }
  messageInputEl.focus()
  renderComposerState()
}

function shouldShowMentionPanel(value: string): boolean {
  const cursor = messageInputEl.selectionStart ?? value.length
  const beforeCursor = value.slice(0, cursor)
  const atIndex = beforeCursor.lastIndexOf('@')
  if (atIndex < 0) return false
  const mentionText = beforeCursor.slice(atIndex + 1)
  return !/\s/.test(mentionText)
}

function insertMention(role: GroupRole): void {
  const value = messageInputEl.value
  const cursor = messageInputEl.selectionStart ?? value.length
  const beforeCursor = value.slice(0, cursor)
  const atIndex = beforeCursor.lastIndexOf('@')
  const prefix = atIndex >= 0 ? value.slice(0, atIndex) : value.slice(0, cursor)
  const suffix = value.slice(cursor)
  const inserted = `${prefix}@${role.name} ${suffix}`
  messageInputEl.value = inserted
  const nextCursor = prefix.length + role.name.length + 2
  messageInputEl.setSelectionRange(nextCursor, nextCursor)
  messageInputEl.focus()
  mentionPanelEl.hidden = true
  renderComposerState()
}

function getChatRecentSummary(chat: GroupChat): string {
  const lastMessageId = chat.messageIds[chat.messageIds.length - 1]
  const message = lastMessageId ? store.messagesById[lastMessageId] : undefined
  if (!message) return '暂无消息。可恢复聊天、添加人员或发送第一条任务。'
  return `${messageTitle(message)}：${truncate(message.content, 72)}`
}

function messageTitle(message: GroupMessage): string {
  if (message.type === 'user') return message.targetRoleIds?.length ? `你 -> ${roleNames(message.targetRoleIds)}` : '你 -> 全部人员'
  if (message.type === 'assistant') return message.roleName || 'AI 人员'
  return '系统'
}

function roleNames(roleIds: string[]): string {
  const names = roleIds.map(roleId => store.rolesById[roleId]?.name).filter((name): name is string => Boolean(name))
  return names.length > 0 ? names.join('、') : '全部人员'
}

function modeLabel(mode: RoomMode): string {
  return mode === 'collaborative' ? '协作群聊模式' : '独立专家模式'
}

function chatStatusLabel(status: GroupChat['status']): string {
  const labels: Record<GroupChat['status'], string> = {
    draft: '草稿',
    initializing: '初始化中',
    ready: '进行中',
    running: '运行中',
    error: '异常',
  }
  return labels[status]
}

function roleStatusLabel(status: RoleStatus): string {
  const labels: Record<RoleStatus, string> = {
    pending: '待唤醒',
    loading: '加载中',
    ready: '就绪',
    thinking: '回复中',
    error: '异常',
  }
  return labels[status]
}

function formatTime(timestamp: number): string {
  if (!timestamp) return '-'
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(timestamp)
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
}

function readTemplateDraft(): TemplateDraft {
  return {
    name: templateNameEl.value.trim(),
    description: templateDescriptionEl.value.trim(),
    systemPrompt: templatePromptEl.value.trim(),
  }
}

function validatePersonDraft(draft: TemplateDraft): string | undefined {
  if (!draft.name) return '人员名称不能为空'
  if (Array.from(draft.name).length > 10) return '人员名称最多 10 个字'
  if (!draft.systemPrompt.trim()) return '人设不能为空'
  return undefined
}

function selectedLibraryTemplateIds(): string[] {
  return Array.from(addLibraryPeopleListEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')).map(input => input.value)
}

async function addPeopleToCurrentChat(items: Record<string, unknown>[]): Promise<void> {
  const chat = getCurrentChat()
  if (!chat) return
  if (items.length === 0) throw new Error('请选择或填写要添加的人员')
  await runCommand('GROUP_ROLES_CREATE_BATCH', { chatId: chat.id, items })
}

function readRolePatch(): RolePatch {
  return {
    name: editRoleNameEl.value.trim(),
    description: editRoleDescriptionEl.value.trim(),
  }
}

function resetTemplateForm(): void {
  selectedTemplateId = undefined
  templateNameEl.value = ''
  templateDescriptionEl.value = ''
  templatePromptEl.value = ''
  renderTemplates()
}

function readNewChatMode(): RoomMode {
  const selected = document.querySelector<HTMLInputElement>('input[name="new-chat-mode"]:checked')
  return selected?.value === 'collaborative' ? 'collaborative' : 'independent'
}

function setChatCreatePopoverVisible(visible: boolean): void {
  createChatFormEl.hidden = !visible
  quickCreateChatEl.setAttribute('aria-expanded', String(visible))
  if (visible) newChatNameEl.focus()
}

function showError(message: string): void {
  errorEl.textContent = message
  errorEl.hidden = false
  window.setTimeout(() => {
    errorEl.hidden = true
  }, 5200)
}

function registerRuntimePush(): void {
  chrome.runtime.onMessage.addListener((message: StorePushMessage) => {
    if (!message || typeof message.type !== 'string') return false
    if (message.type === 'TEAM_FRAME_ROLE_READY') iframeHost.markRoleReady(message.chatId, message.roleId)
    if (message.store) applyStore(message.store)
    if (message.type === 'GROUP_DELIVERY_ERROR' && message.error) showError(message.error)
    return false
  })
}

function ensureShellPositioned(): DOMRect {
  const rect = appShellEl.getBoundingClientRect()
  appShellEl.style.left = `${rect.left}px`
  appShellEl.style.top = `${rect.top}px`
  appShellEl.style.transform = 'none'
  return rect
}

function moveShellTo(left: number, top: number): void {
  const margin = 8
  const rect = appShellEl.getBoundingClientRect()
  const maxLeft = Math.max(margin, window.innerWidth - Math.min(rect.width, window.innerWidth - margin * 2) - margin)
  const maxTop = Math.max(margin, window.innerHeight - Math.min(rect.height, window.innerHeight - margin * 2) - margin)
  appShellEl.style.left = `${Math.min(Math.max(margin, left), maxLeft)}px`
  appShellEl.style.top = `${Math.min(Math.max(margin, top), maxTop)}px`
  appShellEl.style.transform = 'none'
}

function clampShellPosition(): void {
  if (appShellEl.style.transform !== 'none') return

  const rect = appShellEl.getBoundingClientRect()
  moveShellTo(rect.left, rect.top)
}

function setWindowMinimized(minimized: boolean): void {
  if (!minimized && appShellEl.style.transform !== 'none') ensureShellPositioned()
  appShellEl.classList.toggle('minimized', minimized)
  windowLauncherEl.hidden = !minimized
  toggleWindowSizeEl.textContent = minimized ? '□' : '−'
  toggleWindowSizeEl.setAttribute('aria-expanded', String(!minimized))
  if (!minimized) window.requestAnimationFrame(clampShellPosition)
}

function registerFloatingWindowControls(): void {
  let dragOffsetX = 0
  let dragOffsetY = 0
  let activePointerId: number | undefined

  floatingDragHandleEl.addEventListener('pointerdown', event => {
    if (event.button !== 0) return

    const rect = ensureShellPositioned()
    dragOffsetX = event.clientX - rect.left
    dragOffsetY = event.clientY - rect.top
    activePointerId = event.pointerId
    appShellEl.classList.add('dragging')
    floatingDragHandleEl.setPointerCapture(event.pointerId)
    event.preventDefault()
  })

  floatingDragHandleEl.addEventListener('pointermove', event => {
    if (activePointerId !== event.pointerId) return
    moveShellTo(event.clientX - dragOffsetX, event.clientY - dragOffsetY)
  })

  function stopDragging(event: PointerEvent): void {
    if (activePointerId !== event.pointerId) return
    activePointerId = undefined
    appShellEl.classList.remove('dragging')
    if (floatingDragHandleEl.hasPointerCapture(event.pointerId)) floatingDragHandleEl.releasePointerCapture(event.pointerId)
  }

  floatingDragHandleEl.addEventListener('pointerup', stopDragging)
  floatingDragHandleEl.addEventListener('pointercancel', stopDragging)
  toggleWindowSizeEl.addEventListener('click', () => setWindowMinimized(!appShellEl.classList.contains('minimized')))
  windowLauncherEl.addEventListener('click', () => setWindowMinimized(false))
  window.addEventListener('resize', clampShellPosition)
}

function registerUi(): void {
  requireElement<HTMLButtonElement>('#refresh-store').addEventListener('click', () => {
    refreshStore().catch(error => showError(error instanceof Error ? error.message : String(error)))
  })

  quickCreateChatEl.addEventListener('click', () => {
    setChatCreatePopoverVisible(createChatFormEl.hidden)
  })

  settingsButtonEl.addEventListener('click', event => {
    event.stopPropagation()
    const visible = settingsMenuEl.hidden
    settingsMenuEl.hidden = !visible
    settingsButtonEl.setAttribute('aria-expanded', String(visible))
    log.debug('ui:settings-menu:open')
  })

  requireElement<HTMLButtonElement>('#open-people-library').addEventListener('click', () => {
    settingsMenuEl.hidden = true
    settingsButtonEl.setAttribute('aria-expanded', 'false')
    peopleLibraryModalEl.hidden = false
    log.info('ui:people-library:open', { templateCount: getTemplates().length })
    renderTemplates()
  })

  requireElement<HTMLButtonElement>('#close-people-library').addEventListener('click', () => {
    peopleLibraryModalEl.hidden = true
  })

  requireElement<HTMLButtonElement>('#close-add-person').addEventListener('click', () => {
    addPersonModalEl.hidden = true
  })

  togglePeopleDrawerEl.addEventListener('click', () => {
    peopleDrawerOpen = !peopleDrawerOpen
    render()
  })

  requireElement<HTMLButtonElement>('#close-people-drawer').addEventListener('click', () => {
    peopleDrawerOpen = false
    render()
  })

  document.addEventListener('click', event => {
    if (!settingsMenuEl.hidden && !settingsMenuEl.contains(event.target as Node) && event.target !== settingsButtonEl) {
      settingsMenuEl.hidden = true
      settingsButtonEl.setAttribute('aria-expanded', 'false')
    }
  })

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return
    settingsMenuEl.hidden = true
    settingsButtonEl.setAttribute('aria-expanded', 'false')
    peopleLibraryModalEl.hidden = true
    addPersonModalEl.hidden = true
    chatMenuChatId = undefined
    renderChatList()
  })

  requireElement<HTMLButtonElement>('#close-window').addEventListener('click', () => {
    window.close()
  })

  requireElement<HTMLButtonElement>('#cancel-create-chat').addEventListener('click', () => {
    setChatCreatePopoverVisible(false)
  })

  createChatFormEl.addEventListener('submit', event => {
    event.preventDefault()
    const name = newChatNameEl.value.trim() || '新群聊'
    const mode = readNewChatMode()
    newChatNameEl.value = ''
    setChatCreatePopoverVisible(false)
    runCommand('GROUP_CHAT_CREATE', { name, mode, roles: [] }).catch(error => showError(error.message))
  })

  requireElement<HTMLButtonElement>('#restore-chat').addEventListener('click', () => {
    const chat = getCurrentChat()
    if (!chat) return
    const roles = getCurrentRoles()
    log.info('ui:restore-chat', { chatId: chat.id, roleIds: roles.map(role => role.id) })
    iframeHost.restoreChat(chat, roles)
    Promise.all(roles.map(role => runCommand('GROUP_ROLE_RECOVER', { chatId: chat.id, roleId: role.id }))).catch(error => showError(error.message))
  })

  requireElement<HTMLFormElement>('#composer').addEventListener('submit', event => {
    event.preventDefault()
    const chat = getCurrentChat()
    const raw = messageInputEl.value.trim()
    if (!chat || !raw || sendButtonEl.disabled) return
    const reference = selectedReference
    messageInputEl.value = ''
    selectedReference = undefined
    renderComposerState()
    runCommand('GROUP_MESSAGE_SEND', { chatId: chat.id, raw, reference }).catch(error => showError(error.message))
  })

  messageInputEl.addEventListener('input', () => {
    mentionIndex = 0
    renderComposerState()
  })
  messageInputEl.addEventListener('keyup', () => renderComposerState())
  messageInputEl.addEventListener('keydown', event => {
    const roles = getCurrentRoles()
    if (!mentionPanelEl.hidden) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        mentionIndex = (mentionIndex + 1) % roles.length
        renderMentionPanel()
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        mentionIndex = (mentionIndex - 1 + roles.length) % roles.length
        renderMentionPanel()
      } else if (shouldConfirmMentionWithEnter(event)) {
        event.preventDefault()
        const role = roles[mentionIndex]
        if (role) insertMention(role)
      } else if (event.key === 'Escape') {
        mentionPanelEl.hidden = true
      }
      return
    }

    if (shouldSendMessageWithEnter(event)) {
      event.preventDefault()
      requireElement<HTMLFormElement>('#composer').requestSubmit()
    }
  })

  requireElement<HTMLFormElement>('#add-role-form').addEventListener('submit', event => {
    event.preventDefault()
    if (!getCurrentChat()) return
    addPersonModalEl.hidden = false
    log.info('ui:person-add-dialog:open', { chatId: getCurrentChat()?.id, source: 'mixed' })
    renderAddPersonDialog()
  })

  requireElement<HTMLFormElement>('#add-library-people-form').addEventListener('submit', event => {
    event.preventDefault()
    const templateIds = selectedLibraryTemplateIds()
    addPeopleToCurrentChat(templateIds.map(roleTemplateId => ({ source: 'library', roleTemplateId })))
      .then(() => {
        addPersonModalEl.hidden = true
      })
      .catch(error => showError(error.message))
  })

  requireElement<HTMLFormElement>('#add-temporary-person-form').addEventListener('submit', event => {
    event.preventDefault()
    const draft = {
      name: temporaryPersonNameEl.value.trim(),
      description: temporaryPersonDescriptionEl.value.trim(),
      systemPrompt: temporaryPersonPromptEl.value.trim(),
    }
    const validationError = validatePersonDraft(draft)
    if (validationError) {
      showError(validationError)
      return
    }
    addPeopleToCurrentChat([{ source: 'temporary', ...draft }])
      .then(() => {
        temporaryPersonNameEl.value = ''
        temporaryPersonDescriptionEl.value = ''
        temporaryPersonPromptEl.value = ''
        addPersonModalEl.hidden = true
      })
      .catch(error => showError(error.message))
  })

  requireElement<HTMLFormElement>('#role-editor').addEventListener('submit', event => {
    event.preventDefault()
    const chat = getCurrentChat()
    const role = selectedRoleId ? store.rolesById[selectedRoleId] : undefined
    if (!chat || !role) return
    runCommand('GROUP_ROLE_UPDATE', { chatId: chat.id, roleId: role.id, patch: readRolePatch() }).catch(error => showError(error.message))
  })

  requireElement<HTMLButtonElement>('#recover-role').addEventListener('click', () => {
    const chat = getCurrentChat()
    const role = selectedRoleId ? store.rolesById[selectedRoleId] : undefined
    if (!chat || !role) return
    log.info('ui:recover-role', { chatId: chat.id, roleId: role.id, roleName: role.name, conversationUrl: role.geminiConversationUrl })
    iframeHost.recoverRole(role)
    runCommand('GROUP_ROLE_RECOVER', { chatId: chat.id, roleId: role.id }).catch(error => showError(error.message))
  })

  requireElement<HTMLButtonElement>('#initialize-role').addEventListener('click', () => {
    const chat = getCurrentChat()
    if (!chat || !selectedRoleId) return
    const role = store.rolesById[selectedRoleId]
    log.info('ui:reinitialize-role', { chatId: chat.id, roleId: selectedRoleId, roleName: role?.name, roleStatus: role?.status })
    runCommand('GROUP_ROLE_REINITIALIZE', { chatId: chat.id, roleId: selectedRoleId }).catch(error => showError(error.message))
  })

  requireElement<HTMLFormElement>('#people-library-form').addEventListener('submit', event => {
    event.preventDefault()
    const draft = readTemplateDraft()
    const validationError = validatePersonDraft(draft)
    if (validationError) {
      showError(validationError)
      return
    }
    const type = selectedTemplateId ? 'ROLE_TEMPLATE_UPDATE' : 'ROLE_TEMPLATE_CREATE'
    const payload = selectedTemplateId ? { templateId: selectedTemplateId, ...draft } : draft
    runCommand(type, payload).catch(error => showError(error.message))
  })

  requireElement<HTMLButtonElement>('#reset-template-form').addEventListener('click', resetTemplateForm)
  deleteTemplateEl.addEventListener('click', () => {
    if (!selectedTemplateId) return
    if (isTemplateUsed(selectedTemplateId)) {
      showError('该人员已被群聊使用，不能删除')
      return
    }
    const templateId = selectedTemplateId
    resetTemplateForm()
    runCommand('ROLE_TEMPLATE_DELETE', { templateId }).catch(error => showError(error.message))
  })

  requireElement<HTMLButtonElement>('#open-gemini-login').addEventListener('click', () => {
    chrome.tabs.create({ url: GEMINI_URL }).catch(error => showError(error instanceof Error ? error.message : String(error)))
  })
}

async function boot(): Promise<void> {
  await resolveHostTabId()
  registerRuntimePush()
  registerFloatingWindowControls()
  registerUi()
  render()
  await refreshStore(false)
}

boot().catch(error => showError(error instanceof Error ? error.message : String(error)))
