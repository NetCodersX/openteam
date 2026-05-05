// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

class MemoryStorageArea {
  private values: Record<string, unknown>

  constructor(values: Record<string, unknown> = {}) {
    this.values = values
  }

  async get(key: string): Promise<Record<string, unknown>> {
    return { [key]: this.values[key] }
  }

  async set(items: Record<string, unknown>): Promise<void> {
    this.values = { ...this.values, ...items }
  }
}

function buildGateDom(): { app: HTMLElement; form: HTMLFormElement; input: HTMLInputElement; status: HTMLElement } {
  document.body.className = 'access-locked'
  document.body.innerHTML = `
    <section id="invite-gate">
      <form id="invite-code-form">
        <input id="invite-code-input" />
        <p id="invite-code-status"></p>
        <button id="activate-invite-code" type="submit"></button>
      </form>
    </section>
    <main id="app" hidden></main>
  `

  return {
    app: document.querySelector<HTMLElement>('#app')!,
    form: document.querySelector<HTMLFormElement>('#invite-code-form')!,
    input: document.querySelector<HTMLInputElement>('#invite-code-input')!,
    status: document.querySelector<HTMLElement>('#invite-code-status')!,
  }
}

async function waitForAsyncValidation(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('invite gate', () => {
  it('unlocks immediately when a stored activation has not expired', async () => {
    const { ensureInviteGate } = await import('./inviteGate')
    const storage = new MemoryStorageArea({
      'openteam:inviteActivation': {
        codeHash: 'hash',
        activatedAt: 1,
        expiresAt: Date.now() + 1000,
      },
    })
    const { app } = buildGateDom()

    await ensureInviteGate({ storage })

    expect(document.body.classList.contains('access-locked')).toBe(false)
    expect(app.hidden).toBe(false)
  })

  it('keeps the app locked and shows an error when the invite code is invalid', async () => {
    const { ensureInviteGate } = await import('./inviteGate')
    const storage = new MemoryStorageArea()
    const { app, form, input, status } = buildGateDom()

    const activated = ensureInviteGate({ storage })
    input.value = 'OT-0000-0000-0000'
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await waitForAsyncValidation()

    expect(document.body.classList.contains('access-locked')).toBe(true)
    expect(app.hidden).toBe(true)
    expect(status.textContent).toContain('内测码无效')
    expect(await Promise.race([activated.then(() => 'resolved'), Promise.resolve('pending')])).toBe('pending')
  })

  it('stores a thirty day activation and unlocks after a valid invite code is submitted', async () => {
    const { ensureInviteGate, INVITE_ACTIVATION_STORE_KEY } = await import('./inviteGate')
    const storage = new MemoryStorageArea()
    const now = Date.UTC(2026, 4, 5, 12, 0, 0)
    const clock = vi.fn(() => now)
    const validateInviteCode = vi.fn(async () => true)
    const createActivation = vi.fn(async () => ({
      codeHash: 'test-code-hash',
      activatedAt: now,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    }))
    const { app, form, input } = buildGateDom()

    const activated = ensureInviteGate({ storage, now: clock, validateInviteCode, createActivation })
    input.value = 'OT-TEST-CODE-0001'
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await activated

    const stored = await storage.get(INVITE_ACTIVATION_STORE_KEY)
    expect(stored[INVITE_ACTIVATION_STORE_KEY]).toMatchObject({
      codeHash: 'test-code-hash',
      activatedAt: now,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    })
    expect(validateInviteCode).toHaveBeenCalledWith('OT-TEST-CODE-0001')
    expect(createActivation).toHaveBeenCalledWith('OT-TEST-CODE-0001', now)
    expect(document.body.classList.contains('access-locked')).toBe(false)
    expect(app.hidden).toBe(false)
  })
})
