import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('team.html chat creation UI', () => {
  it('offers an explicit chat mode choice before creating a chat from the plus button', () => {
    const html = readFileSync(resolve(process.cwd(), 'public/team.html'), 'utf8')

    expect(html).toContain('id="chat-create-popover"')
    expect(html).toContain('id="new-chat-mode-independent"')
    expect(html).toContain('id="new-chat-mode-collaborative"')
    expect(html).toContain('协作群聊')
  })

  it('includes the people-library workflows, right drawer, iframe host, and minimized launcher', () => {
    const html = readFileSync(resolve(process.cwd(), 'public/team.html'), 'utf8')

    expect(html).toContain('id="settings-button"')
    expect(html).toContain('id="settings-menu"')
    expect(html).toContain('id="open-people-library"')
    expect(html).toContain('id="people-library-modal"')
    expect(html).toContain('id="people-library-list"')
    expect(html).toContain('id="add-person-modal"')
    expect(html).toContain('id="add-library-people-form"')
    expect(html).toContain('id="add-temporary-person-form"')
    expect(html).toContain('id="toggle-people-drawer"')
    expect(html).toContain('class="panel role-panel"')
    expect(html).toContain('id="close-people-drawer"')
    expect(html).toContain('id="window-launcher"')
    expect(html).toContain('id="iframe-host"')
    expect(html).toContain('人员库')
    expect(html).toContain('人设')
    expect(html).not.toContain('System Prompt')
  })

  it('renders chat actions through a three-dot menu that updates chat names', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/teamPage/index.ts'), 'utf8')

    expect(source).toContain("menuButton.className = 'icon-btn chat-menu-btn'")
    expect(source).toContain("menuButton.textContent = '⋯'")
    expect(source).toContain("menu.className = 'chat-action-menu'")
    expect(source).toContain("rename.textContent = '编辑名称'")
    expect(source).toContain("runCommand('GROUP_CHAT_UPDATE'")
  })
})
