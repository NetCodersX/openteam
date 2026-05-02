// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { createReplyTracker } from './replyTracker'
import { findLatestCompensationReply } from './replyCompensation'

describe('findLatestCompensationReply', () => {
  it('returns the latest unreported reply while ignoring restored DOM history', () => {
    document.body.innerHTML = `
      <message-content id="old">初始化时的旧回复</message-content>
      <message-content id="new">针对新消息的补偿回复</message-content>
    `
    const tracker = createReplyTracker()
    tracker.seedGlobal(['初始化时的旧回复'])

    const result = findLatestCompensationReply({
      containers: [...document.querySelectorAll('message-content')],
      readText: element => element.textContent ?? '',
      isBaseline: () => false,
      consume: text => tracker.consumeIfNewForMessage('conv-a', text, 'msg-1'),
    })

    expect(result?.text).toBe('针对新消息的补偿回复')
    expect(result?.element.id).toBe('new')
  })

  it('returns nothing when every visible reply is baseline or already reported', () => {
    document.body.innerHTML = `
      <message-content id="baseline">发送前已有回复</message-content>
      <message-content id="old">初始化时的旧回复</message-content>
    `
    const tracker = createReplyTracker()
    tracker.seedGlobal(['初始化时的旧回复'])

    const result = findLatestCompensationReply({
      containers: [...document.querySelectorAll('message-content')],
      readText: element => element.textContent ?? '',
      isBaseline: (_text, element) => element.id === 'baseline',
      consume: text => tracker.consumeIfNewForMessage('conv-a', text, 'msg-1'),
    })

    expect(result).toBeUndefined()
  })
})
