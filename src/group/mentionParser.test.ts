import { describe, expect, it } from 'vitest'
import { parseGroupMentions } from './mentionParser'
import type { GroupRole } from './types'

describe('parseGroupMentions', () => {
  it('does not target anyone when defaultTarget is none and the message has no mentions', () => {
    expect(parseGroupMentions('记录一个背景', roles, { defaultTarget: 'none' })).toEqual({
      ok: true,
      content: '记录一个背景',
      targetRoleIds: [],
      mentionedRoleIds: [],
    })
  })

  it('targets all roles for @all and @所有人 without marking explicit role mentions', () => {
    expect(parseGroupMentions('@all 请一起看', roles, { defaultTarget: 'none' })).toEqual({
      ok: true,
      content: '请一起看',
      targetRoleIds: ['role-eng', 'role-pm'],
      mentionedRoleIds: [],
      mentionsAll: true,
    })
    expect(parseGroupMentions('@所有人 请一起看', roles, { defaultTarget: 'none' })).toEqual({
      ok: true,
      content: '请一起看',
      targetRoleIds: ['role-eng', 'role-pm'],
      mentionedRoleIds: [],
      mentionsAll: true,
    })
  })

  it('targets one or more mentioned roles and strips mention labels from content', () => {
    expect(parseGroupMentions('@工程师 @产品经理 请评估', roles, { defaultTarget: 'none' })).toEqual({
      ok: true,
      content: '请评估',
      targetRoleIds: ['role-eng', 'role-pm'],
      mentionedRoleIds: ['role-eng', 'role-pm'],
    })
  })
})

const roles: GroupRole[] = [
  makeRole('role-eng', '工程师'),
  makeRole('role-pm', '产品经理'),
]

function makeRole(id: string, name: string): GroupRole {
  return {
    id,
    chatId: 'chat-1',
    name,
    systemPrompt: `${name}人设`,
    status: 'ready',
    contextCursor: 0,
    createdAt: 1,
    updatedAt: 1,
  }
}
