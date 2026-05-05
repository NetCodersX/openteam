import { createInviteActivation, isInviteActivationActive, isInviteCodeAllowed, type InviteActivationRecord } from './inviteCode'

export const INVITE_ACTIVATION_STORE_KEY = 'openteam:inviteActivation'

interface InviteStorageArea {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

interface InviteGateOptions {
  storage?: InviteStorageArea
  now?: () => number
  validateInviteCode?: (input: string) => Promise<boolean>
  createActivation?: (input: string, now: number) => Promise<InviteActivationRecord>
}

interface InviteGateElements {
  appEl: HTMLElement
  gateEl: HTMLElement
  formEl: HTMLFormElement
  inputEl: HTMLInputElement
  statusEl: HTMLElement
  submitEl: HTMLButtonElement
}

function defaultStorage(): InviteStorageArea {
  return chrome.storage.local
}

function readElements(): InviteGateElements | undefined {
  const appEl = document.querySelector<HTMLElement>('#app')
  const gateEl = document.querySelector<HTMLElement>('#invite-gate')
  const formEl = document.querySelector<HTMLFormElement>('#invite-code-form')
  const inputEl = document.querySelector<HTMLInputElement>('#invite-code-input')
  const statusEl = document.querySelector<HTMLElement>('#invite-code-status')
  const submitEl = document.querySelector<HTMLButtonElement>('#activate-invite-code')
  if (!appEl || !gateEl || !formEl || !inputEl || !statusEl || !submitEl) return undefined
  return { appEl, gateEl, formEl, inputEl, statusEl, submitEl }
}

function activationFromStorage(value: unknown): InviteActivationRecord | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Partial<InviteActivationRecord>
  if (typeof record.codeHash !== 'string' || typeof record.activatedAt !== 'number' || typeof record.expiresAt !== 'number') return undefined
  return {
    codeHash: record.codeHash,
    activatedAt: record.activatedAt,
    expiresAt: record.expiresAt,
  }
}

function unlock(elements: InviteGateElements): void {
  document.body.classList.remove('access-locked')
  elements.appEl.hidden = false
  elements.gateEl.hidden = true
}

function lock(elements: InviteGateElements): void {
  document.body.classList.add('access-locked')
  elements.appEl.hidden = true
  elements.gateEl.hidden = false
}

export async function ensureInviteGate(options: InviteGateOptions = {}): Promise<void> {
  const elements = readElements()
  if (!elements) return

  const storage = options.storage ?? defaultStorage()
  const now = options.now ?? Date.now
  const validateInviteCode = options.validateInviteCode ?? isInviteCodeAllowed
  const createActivation = options.createActivation ?? createInviteActivation
  lock(elements)

  const activationPromise = new Promise<void>(resolve => {
    elements.formEl.addEventListener('submit', event => {
      event.preventDefault()
      void submitInviteCode({ elements, storage, now, validateInviteCode, createActivation, resolve })
    })
  })

  const stored = await storage.get(INVITE_ACTIVATION_STORE_KEY)
  const activation = activationFromStorage(stored[INVITE_ACTIVATION_STORE_KEY])
  if (isInviteActivationActive(activation, now())) {
    unlock(elements)
    return
  }

  return activationPromise
}

async function submitInviteCode({
  elements,
  storage,
  now,
  validateInviteCode,
  createActivation,
  resolve,
}: {
  elements: InviteGateElements
  storage: InviteStorageArea
  now: () => number
  validateInviteCode: (input: string) => Promise<boolean>
  createActivation: (input: string, now: number) => Promise<InviteActivationRecord>
  resolve: () => void
}): Promise<void> {
  const inviteCode = elements.inputEl.value
  elements.submitEl.disabled = true
  elements.statusEl.textContent = '正在验证内测码...'

  try {
    if (!(await validateInviteCode(inviteCode))) {
      elements.statusEl.textContent = '内测码无效，请检查后重试。'
      return
    }

    const activation = await createActivation(inviteCode, now())
    await storage.set({ [INVITE_ACTIVATION_STORE_KEY]: activation })
    elements.statusEl.textContent = '已激活，欢迎进入 OpenTeam。'
    unlock(elements)
    resolve()
  } catch (error) {
    elements.statusEl.textContent = error instanceof Error ? error.message : '验证失败，请重试。'
  } finally {
    elements.submitEl.disabled = false
  }
}
