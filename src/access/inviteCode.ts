import inviteCodeHashes from './inviteCodeHashes.json'

export const INVITE_ACTIVATION_DAYS = 30
export const INVITE_ACTIVATION_MS = INVITE_ACTIVATION_DAYS * 24 * 60 * 60 * 1000

export interface InviteActivationRecord {
  codeHash: string
  activatedAt: number
  expiresAt: number
}

const INVITE_CODE_HASHES = new Set<string>(inviteCodeHashes)

export function normalizeInviteCode(input: string): string {
  const compact = input.trim().toUpperCase().replace(/[\s-]+/g, '')
  const withoutPrefix = compact.startsWith('OT') ? compact.slice(2) : compact
  if (/^[A-Z0-9]{12}$/.test(withoutPrefix)) {
    return `OT-${withoutPrefix.slice(0, 4)}-${withoutPrefix.slice(4, 8)}-${withoutPrefix.slice(8, 12)}`
  }
  return compact
}

export async function hashInviteCode(input: string): Promise<string> {
  const normalized = normalizeInviteCode(input)
  const bytes = new TextEncoder().encode(normalized)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function isInviteCodeAllowed(input: string, allowedHashes: ReadonlySet<string> = INVITE_CODE_HASHES): Promise<boolean> {
  const hash = await hashInviteCode(input)
  return allowedHashes.has(hash)
}

export async function createInviteActivation(input: string, now = Date.now()): Promise<InviteActivationRecord> {
  return {
    codeHash: await hashInviteCode(input),
    activatedAt: now,
    expiresAt: now + INVITE_ACTIVATION_MS,
  }
}

export function isInviteActivationActive(record: InviteActivationRecord | undefined, now = Date.now()): boolean {
  return Boolean(record && Number.isFinite(record.expiresAt) && record.expiresAt > now)
}
