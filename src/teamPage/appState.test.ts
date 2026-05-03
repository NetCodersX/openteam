import { describe, expect, it } from 'vitest'

describe('team page app state', () => {
  it('initializes mutable UI state with a default store and empty selections', async () => {
    const { createTeamPageState } = await import('./appState')
    const state = createTeamPageState()

    expect(state.store.version).toBeGreaterThan(0)
    expect(state.selectedChatId).toBeUndefined()
    expect(state.selectedReference).toBeUndefined()
    expect(state.mentionIndex).toBe(0)
    expect(state.peopleDrawerOpen).toBe(false)
    expect(state.messageNodeCache.size).toBe(0)
    expect(state.temporaryPersonDrafts).toEqual([])
  })
})
