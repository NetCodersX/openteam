import type { HostToBackgroundMessage, TeamMessage, TeamRole, TeamRoomState } from '../team/types'
import type { ContentLogger } from './runtimeClient'

const PANEL_ID = '__openteam_team_panel__'

export interface LegacyHostPanelController {
  ensureHostPanel(state: TeamRoomState): void
  getCurrentState(): TeamRoomState | null
}

export function createLegacyHostPanel(options: {
  log: ContentLogger
  sendRuntimeMessage<T>(message: HostToBackgroundMessage): Promise<T>
}): LegacyHostPanelController {
  let currentState: TeamRoomState | null = null
  let panelApi: ReturnType<typeof createTeamPanel> | null = null

  function teamStatusLabel(role: TeamRole): string {
    if (role.status === 'opening') return '打开中'
    if (role.status === 'online') return '在线'
    if (role.status === 'sending') return '发送中'
    if (role.status === 'generating') return '生成中'
    if (role.status === 'idle') return '空闲'
    if (role.status === 'offline') return '离线'
    return '异常'
  }

  function messageTitle(message: TeamMessage): string {
    if (message.from === 'user') {
      if (message.target === 'all') return '你 -> all'
      if (message.target === 'role') return `你 -> ${message.targetRoleName || '人员'}`
      return '你'
    }

    if (message.from === 'role') return message.roleName || '人员'
    return '系统'
  }

  function createTeamPanel(initialState: TeamRoomState) {
    options.log.debug('legacy-panel:create', { roles: initialState.roles.length, messages: initialState.messages.length })
    const host = document.createElement('div')
    host.id = PANEL_ID
    const shadow = host.attachShadow({ mode: 'open' })
    let expanded = true
    currentState = initialState

    shadow.innerHTML = `
      <style>
        :host {
          color-scheme: light;
          font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .launcher {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 2147483647;
          width: 52px;
          height: 52px;
          border: 0;
          border-radius: 50%;
          background: #101820;
          color: #f7f1df;
          box-shadow: 0 14px 34px rgba(16, 24, 32, 0.28);
          font-size: 20px;
          font-weight: 800;
          cursor: pointer;
        }

        .panel {
          position: fixed;
          right: 22px;
          bottom: 86px;
          z-index: 2147483647;
          width: min(390px, calc(100vw - 28px));
          height: min(620px, calc(100vh - 112px));
          display: grid;
          grid-template-rows: auto auto 1fr auto;
          overflow: hidden;
          border: 1px solid rgba(16, 24, 32, 0.12);
          border-radius: 8px;
          background: #fffdf6;
          box-shadow: 0 22px 70px rgba(16, 24, 32, 0.24);
        }

        .panel[hidden] {
          display: none;
        }

        .top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 14px 12px;
          border-bottom: 1px solid rgba(16, 24, 32, 0.1);
          background: #f7f1df;
        }

        .title {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .title strong {
          color: #101820;
          font-size: 14px;
          line-height: 1.2;
        }

        .title span {
          color: #59646e;
          font-size: 12px;
          line-height: 1.2;
        }

        .icon-button,
        .add,
        .send {
          border: 1px solid rgba(16, 24, 32, 0.14);
          border-radius: 8px;
          background: #ffffff;
          color: #101820;
          cursor: pointer;
          font: inherit;
        }

        .icon-button {
          width: 30px;
          height: 30px;
          line-height: 28px;
        }

        .roles {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 10px 12px;
          border-bottom: 1px solid rgba(16, 24, 32, 0.08);
        }

        .role {
          display: grid;
          grid-template-columns: auto auto;
          align-items: center;
          gap: 3px 8px;
          min-width: 118px;
          padding: 8px;
          border: 1px solid rgba(16, 24, 32, 0.1);
          border-radius: 8px;
          background: #ffffff;
        }

        .role-name {
          overflow: hidden;
          color: #101820;
          font-size: 13px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .role-status {
          color: #64707a;
          font-size: 11px;
        }

        .role-remove {
          grid-row: span 2;
          width: 24px;
          height: 24px;
          border: 0;
          border-radius: 6px;
          background: #f1e7d0;
          color: #6e1f18;
          cursor: pointer;
        }

        .add {
          min-width: 86px;
          padding: 0 12px;
          background: #101820;
          color: #f7f1df;
          font-size: 12px;
          font-weight: 700;
        }

        .messages {
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
          padding: 14px 12px;
          background: linear-gradient(180deg, #fffdf6, #f9fbff);
        }

        .empty {
          margin: auto;
          color: #73808b;
          font-size: 13px;
        }

        .message {
          max-width: 88%;
          padding: 9px 10px;
          border: 1px solid rgba(16, 24, 32, 0.1);
          border-radius: 8px;
          background: #ffffff;
          color: #17222b;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .message.user {
          align-self: flex-end;
          background: #e8f2ff;
        }

        .message.system {
          align-self: center;
          background: #fff0ec;
          color: #7a261f;
        }

        .message-title {
          margin-bottom: 4px;
          color: #53606a;
          font-size: 11px;
          font-weight: 800;
        }

        .composer {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          padding: 12px;
          border-top: 1px solid rgba(16, 24, 32, 0.1);
          background: #ffffff;
        }

        textarea {
          min-height: 44px;
          max-height: 110px;
          resize: vertical;
          border: 1px solid rgba(16, 24, 32, 0.16);
          border-radius: 8px;
          padding: 9px 10px;
          color: #101820;
          font: inherit;
          font-size: 13px;
          outline: none;
        }

        textarea:focus {
          border-color: #2f6fed;
          box-shadow: 0 0 0 3px rgba(47, 111, 237, 0.12);
        }

        .send {
          width: 58px;
          background: #2f6fed;
          color: #ffffff;
          font-size: 13px;
          font-weight: 800;
        }
      </style>
      <button class="launcher" title="OpenTeam">OT</button>
      <section class="panel">
        <div class="top">
          <div class="title">
            <strong>OpenTeam</strong>
            <span class="summary"></span>
          </div>
          <button class="icon-button collapse" title="收起">×</button>
        </div>
        <div class="roles"></div>
        <div class="messages"></div>
        <form class="composer">
          <textarea placeholder="@A 分析这个方案"></textarea>
          <button class="send" type="submit">发送</button>
        </form>
      </section>
    `

    document.documentElement.append(host)

    const launcher = shadow.querySelector<HTMLButtonElement>('.launcher')
    const panel = shadow.querySelector<HTMLElement>('.panel')
    const collapse = shadow.querySelector<HTMLButtonElement>('.collapse')
    const rolesEl = shadow.querySelector<HTMLElement>('.roles')
    const messagesEl = shadow.querySelector<HTMLElement>('.messages')
    const summaryEl = shadow.querySelector<HTMLElement>('.summary')
    const form = shadow.querySelector<HTMLFormElement>('.composer')
    const textarea = shadow.querySelector<HTMLTextAreaElement>('textarea')

    function setExpanded(next: boolean): void {
      expanded = next
      if (panel) panel.hidden = !expanded
    }

    function renderRoles(state: TeamRoomState): void {
      if (!rolesEl) return

      rolesEl.replaceChildren()
      const add = document.createElement('button')
      add.className = 'add'
      add.type = 'button'
      add.textContent = '+ 人员'
      add.addEventListener('click', () => {
        const name = window.prompt('人员名')
        if (!name?.trim()) return
        options.sendRuntimeMessage({ type: 'TEAM_CREATE_ROLE', name }).catch(error => console.warn('[OpenTeam] create role failed', error))
      })
      rolesEl.append(add)

      for (const role of state.roles) {
        const item = document.createElement('div')
        item.className = 'role'
        item.innerHTML = `
          <div class="role-name"></div>
          <button class="role-remove" title="移除">×</button>
          <div class="role-status"></div>
        `
        item.querySelector('.role-name')!.textContent = role.name
        item.querySelector('.role-status')!.textContent = role.lastError || teamStatusLabel(role)
        item.querySelector<HTMLButtonElement>('.role-remove')!.addEventListener('click', () => {
          options.sendRuntimeMessage({ type: 'TEAM_REMOVE_ROLE', roleId: role.id }).catch(error => console.warn('[OpenTeam] remove role failed', error))
        })
        rolesEl.append(item)
      }
    }

    function renderMessages(state: TeamRoomState): void {
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
        const item = document.createElement('div')
        item.className = `message ${message.from}`
        const title = document.createElement('div')
        title.className = 'message-title'
        title.textContent = messageTitle(message)
        const content = document.createElement('div')
        content.textContent = message.content
        item.append(title, content)
        messagesEl.append(item)
      }
      messagesEl.scrollTop = messagesEl.scrollHeight
    }

    function render(state: TeamRoomState): void {
      currentState = state
      if (summaryEl) summaryEl.textContent = `${state.roles.length} 个人员 · ${state.messages.length} 条消息`
      renderRoles(state)
      renderMessages(state)
    }

    launcher?.addEventListener('click', () => setExpanded(!expanded))
    collapse?.addEventListener('click', () => setExpanded(false))
    form?.addEventListener('submit', event => {
      event.preventDefault()
      const raw = textarea?.value.trim() || ''
      if (!raw) return

      if (textarea) textarea.value = ''
      options.sendRuntimeMessage({ type: 'TEAM_SEND_MESSAGE', raw }).catch(error => console.warn('[OpenTeam] send message failed', error))
    })

    render(initialState)

    return { render }
  }

  function ensureHostPanel(state: TeamRoomState): void {
    options.log.debug('legacy-panel:ensure', { roles: state.roles.length, messages: state.messages.length })
    const existing = document.getElementById(PANEL_ID)
    if (existing && panelApi) {
      panelApi.render(state)
      return
    }

    if (existing) existing.remove()
    panelApi = createTeamPanel(state)
  }

  return {
    ensureHostPanel,
    getCurrentState: () => currentState,
  }
}
