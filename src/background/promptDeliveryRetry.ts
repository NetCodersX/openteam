import type { PromptDelivery, PromptSender } from './promptDelivery'

export const DEFAULT_PROMPT_DELIVERY_RETRY_DELAYS_MS = [2_000, 2_000, 4_000, 8_000, 15_000] as const

export interface LatestPromptBinding {
  ready?: boolean
  tabId: number
  frameId: number
}

export interface PromptDeliveryRetryDependencies {
  log: {
    warn(event: string, details?: Record<string, unknown>): void
  }
  sendPrompt: PromptSender
  getLatestBinding(chatId: string, roleId: string): LatestPromptBinding | undefined
  isDeliveryStillActive(chatId: string, roleId: string, messageId: string, replyAttemptId: string | undefined): Promise<boolean>
  markDeliveryError(chatId: string, roleId: string, messageId: string, reason: string): Promise<void>
  requestRoleRecovery?(chatId: string, roleId: string, reason: string): Promise<boolean>
  waitForRetry?(ms: number): Promise<void>
}

export async function sendPromptDeliveryWithRetry(
  deps: PromptDeliveryRetryDependencies,
  input: {
    chatId: string
    messageId: string
    delivery: PromptDelivery
    retryDelaysMs?: readonly number[]
  },
): Promise<boolean> {
  const retryDelays = input.retryDelaysMs ?? DEFAULT_PROMPT_DELIVERY_RETRY_DELAYS_MS
  let lastReason = '发送失败'

  for (let attemptIndex = 0; attemptIndex <= retryDelays.length; attemptIndex += 1) {
    const latestBinding = deps.getLatestBinding(input.chatId, input.delivery.roleId)
    const promptDelivery = latestBinding?.ready
      ? { ...input.delivery, tabId: latestBinding.tabId, frameId: latestBinding.frameId }
      : input.delivery
    deps.log.warn('orchestration-diagnostic:delivery-attempt', {
      chatId: input.chatId,
      roleId: input.delivery.roleId,
      chatSite: input.delivery.chatSite,
      messageId: input.messageId,
      attempt: attemptIndex + 1,
      maxAttempts: retryDelays.length + 1,
      deliveryTabId: promptDelivery.tabId,
      deliveryFrameId: promptDelivery.frameId,
      latestBinding,
      payloadChatId: promptDelivery.message.chatId,
      payloadRoleId: promptDelivery.message.roleId,
      payloadReplyAttemptId: promptDelivery.message.replyAttemptId,
    })
    try {
      await deps.sendPrompt(promptDelivery)
      return true
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error)
      const canRetry = attemptIndex < retryDelays.length && await deps.isDeliveryStillActive(
        input.chatId,
        input.delivery.roleId,
        input.messageId,
        input.delivery.message.replyAttemptId,
      )
      if (!canRetry) break

      const delayMs = retryDelays[attemptIndex] ?? 0
      deps.log.warn('delivery:retry-scheduled', {
        chatId: input.chatId,
        roleId: input.delivery.roleId,
        messageId: input.messageId,
        retryCount: attemptIndex + 1,
        delayMs,
        reason: lastReason,
      })
      const recovered = await deps.requestRoleRecovery?.(input.chatId, input.delivery.roleId, lastReason).catch(error => {
        deps.log.warn('orchestration-diagnostic:delivery-recovery-request-failed', {
          chatId: input.chatId,
          roleId: input.delivery.roleId,
          messageId: input.messageId,
          reason: lastReason,
          error: error instanceof Error ? error.message : String(error),
        })
        return false
      })
      deps.log.warn('orchestration-diagnostic:delivery-recovery-requested', {
        chatId: input.chatId,
        roleId: input.delivery.roleId,
        messageId: input.messageId,
        recovered: recovered ?? false,
        reason: lastReason,
      })
      await waitForRetryDelay(deps, delayMs)
    }
  }

  deps.log.warn('orchestration-diagnostic:delivery-final-failure', {
    chatId: input.chatId,
    roleId: input.delivery.roleId,
    chatSite: input.delivery.chatSite,
    messageId: input.messageId,
    reason: lastReason,
  })
  await deps.markDeliveryError(input.chatId, input.delivery.roleId, input.messageId, lastReason)
  return false
}

export function withLatestPromptBinding(
  deps: Pick<PromptDeliveryRetryDependencies, 'getLatestBinding'>,
  chatId: string,
  delivery: PromptDelivery,
): PromptDelivery {
  const binding = deps.getLatestBinding(chatId, delivery.roleId)
  if (!binding?.ready) return delivery
  return { ...delivery, tabId: binding.tabId, frameId: binding.frameId }
}

async function waitForRetryDelay(deps: Pick<PromptDeliveryRetryDependencies, 'waitForRetry'>, delayMs: number): Promise<void> {
  if (delayMs <= 0) return
  if (deps.waitForRetry) {
    await deps.waitForRetry(delayMs)
    return
  }
  await new Promise<void>(resolve => setTimeout(resolve, delayMs))
}
