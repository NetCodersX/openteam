import type { BackgroundToRoleMessage, RoleToBackgroundMessage } from '../group/runtimeProtocol'

export type ContentRuntimeMessage = BackgroundToRoleMessage

export interface ContentLogger {
  debug(event: string, details?: Record<string, unknown>): void
  info(event: string, details?: Record<string, unknown>): void
  warn(event: string, details?: Record<string, unknown>): void
}

export const contentLog: ContentLogger = {
  debug(event: string, details?: Record<string, unknown>): void {
    console.debug('[OpenTeam][content]', event, details || {})
  },
  info(event: string, details?: Record<string, unknown>): void {
    console.info('[OpenTeam][content]', event, details || {})
  },
  warn(event: string, details?: Record<string, unknown>): void {
    console.warn('[OpenTeam][content]', event, details || {})
  },
}

export async function sendRuntimeMessage<T>(
  message: RoleToBackgroundMessage,
  log: ContentLogger = contentLog,
): Promise<T> {
  return new Promise((resolve, reject) => {
    log.debug('runtime-send:start', { type: message.type })
    chrome.runtime.sendMessage(message, response => {
      const error = chrome.runtime.lastError
      if (error) {
        log.warn('runtime-send:failed', { type: message.type, error: error.message })
        reject(new Error(error.message))
        return
      }

      log.debug('runtime-send:response', { type: message.type, response })
      resolve(response as T)
    })
  })
}
