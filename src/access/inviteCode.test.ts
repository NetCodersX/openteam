import { describe, expect, it } from 'vitest'

describe('invite code validation', () => {
  it('normalizes casing, spaces, and separator variants before hashing', async () => {
    const { hashInviteCode, normalizeInviteCode } = await import('./inviteCode')

    expect(normalizeInviteCode(' ot-test code-0001 ')).toBe('OT-TEST-CODE-0001')
    await expect(hashInviteCode(' ot-test code-0001 ')).resolves.toBe('cbf38e55c12ddbf19202e71e8152680d921cc1620e3fedd157c78bd870087cba')
  })

  it('accepts invite codes by SHA-256 whitelist only', async () => {
    const { isInviteCodeAllowed } = await import('./inviteCode')
    const allowedHashes = new Set(['cbf38e55c12ddbf19202e71e8152680d921cc1620e3fedd157c78bd870087cba'])

    await expect(isInviteCodeAllowed('OT-TEST-CODE-0001', allowedHashes)).resolves.toBe(true)
    await expect(isInviteCodeAllowed('OT-0000-0000-0000', allowedHashes)).resolves.toBe(false)
  })

  it('creates a thirty day activation window from the activation time', async () => {
    const { createInviteActivation } = await import('./inviteCode')
    const now = Date.UTC(2026, 4, 5, 12, 0, 0)

    await expect(createInviteActivation('ot-test-code-0001', now)).resolves.toEqual({
      codeHash: 'cbf38e55c12ddbf19202e71e8152680d921cc1620e3fedd157c78bd870087cba',
      activatedAt: now,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    })
  })

  it('treats missing or expired activation records as inactive', async () => {
    const { isInviteActivationActive } = await import('./inviteCode')
    const now = Date.UTC(2026, 4, 5, 12, 0, 0)

    expect(isInviteActivationActive(undefined, now)).toBe(false)
    expect(isInviteActivationActive({ codeHash: 'hash', activatedAt: now - 1, expiresAt: now }, now)).toBe(false)
    expect(isInviteActivationActive({ codeHash: 'hash', activatedAt: now, expiresAt: now + 1 }, now)).toBe(true)
  })
})
