import type { GroupRole, OpenTeamSettings } from './types'

export type ParsedGroupMention =
  | {
      ok: true
      content: string
      targetRoleIds: string[]
      mentionedRoleIds: string[]
      mentionsAll?: true
      orchestrationTarget?: 'default' | { name: string }
    }
  | {
      ok: false
      error: string
    }

export interface RoleMentionLabelOptions {
  defaultChatSite?: GroupRole['chatSite']
  externalModelNamesById?: Record<string, string>
}

export interface ParseGroupMentionsOptions extends RoleMentionLabelOptions {
  defaultTarget?: 'all' | 'none'
}

export function parseGroupMentions(raw: string, roles: GroupRole[], options: ParseGroupMentionsOptions = {}): ParsedGroupMention {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: '消息内容不能为空' }

  const allRoleIds = roles.map(role => role.id)
  if (!trimmed.includes('@')) {
    return { ok: true, content: trimmed, targetRoleIds: defaultTargetRoleIds(allRoleIds, options), mentionedRoleIds: [] }
  }

  const mentionTargets = roles.flatMap(role => [
    { role, label: roleMentionLabel(role, options) },
    { role, label: role.name },
  ]).sort((left, right) => right.label.length - left.label.length)
  const targetRoleIds = new Set<string>()
  let targetsAll = false
  let orchestrationTarget: 'default' | { name: string } | undefined = undefined
  let content = ''
  let index = 0

  while (index < trimmed.length) {
    if (trimmed[index] !== '@') {
      content += trimmed[index]
      index += 1
      continue
    }

    // 1. Check for Orchestration triggers (@编排 or @编排:name)
    if (trimmed.startsWith('@编排', index)) {
      const afterPrefix = trimmed.slice(index + 3) // length of '@编排' is 3
      if (afterPrefix.startsWith(':')) {
        // Named orchestration: @编排:name
        const match = afterPrefix.slice(1).match(/^([^\s，。！？,.!?;；:：]+)/)
        if (match) {
          orchestrationTarget = { name: match[1] }
          index += 3 + 1 + match[1].length
          continue
        }
      } else if (afterPrefix.length === 0 || /\s|[，。！？,.!?;；:：]/.test(afterPrefix[0])) {
        // Default orchestration: @编排
        orchestrationTarget = 'default'
        index += 3
        continue
      }
    }

    const allMentionLabel = ['all', '所有人'].find(label => mentionMatches(trimmed, index, label))
    if (allMentionLabel) {
      targetsAll = true
      index += allMentionLabel.length + 1
      continue
    }

    const target = mentionTargets.find(candidate => mentionMatches(trimmed, index, candidate.label))
    if (!target) {
      content += trimmed[index]
      index += 1
      continue
    }

    targetRoleIds.add(target.role.id)
    index += target.label.length + 1
  }

  const parsedContent = compactContent(content)
  if (!parsedContent) return { ok: false, error: '消息内容不能为空' }

  return {
    ok: true,
    content: parsedContent,
    targetRoleIds: targetsAll ? allRoleIds : targetRoleIds.size > 0 ? [...targetRoleIds] : defaultTargetRoleIds(allRoleIds, options),
    mentionedRoleIds: [...targetRoleIds],
    ...(targetsAll ? { mentionsAll: true as const } : {}),
    ...(orchestrationTarget ? { orchestrationTarget } : {}),
  }
}

export function roleMentionLabel(role: GroupRole, options: RoleMentionLabelOptions = {}): string {
  return `${role.name}（${roleModelLabel(role, options)}）`
}

export function roleModelLabel(role: GroupRole, options: RoleMentionLabelOptions = {}): string {
  if (role.modelSource === 'external') {
    const externalName = role.externalModelId ? options.externalModelNamesById?.[role.externalModelId]?.trim() : undefined
    return externalName || 'API'
  }
  return siteLabel(role.chatSite ?? options.defaultChatSite)
}

export function roleMentionLabelOptionsFromSettings(settings: Pick<OpenTeamSettings, 'defaultChatSite' | 'externalModelsById'>): RoleMentionLabelOptions {
  return {
    defaultChatSite: settings.defaultChatSite,
    externalModelNamesById: Object.fromEntries(Object.entries(settings.externalModelsById).map(([modelId, model]) => [modelId, model.name])),
  }
}

function siteLabel(site: GroupRole['chatSite']): string {
  if (site === 'chatgpt') return 'ChatGPT'
  if (site === 'claude') return 'Claude'
  if (site === 'deepseek') return 'DeepSeek'
  if (site === 'grok') return 'Grok'
  return 'Gemini'
}

function mentionMatches(raw: string, atIndex: number, target: string): boolean {
  if (!raw.startsWith(`@${target}`, atIndex)) return false
  const next = raw[atIndex + target.length + 1]
  return next === undefined || /\s|[，。！？,.!?;；:：]/.test(next)
}

function defaultTargetRoleIds(allRoleIds: string[], options: ParseGroupMentionsOptions): string[] {
  return options.defaultTarget === 'none' ? [] : allRoleIds
}

function compactContent(raw: string): string {
  return raw.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}
