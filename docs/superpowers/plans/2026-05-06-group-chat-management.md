# Group Chat Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add current-chat member removal with preserved history, free floating-window resize, and Markdown chat export.

**Architecture:** Reuse existing runtime routes where possible. Keep role removal in the background route, keep export formatting in a focused team-page module, and extend the existing floating-window controller for resize behavior.

**Tech Stack:** TypeScript, DOM APIs, Chrome extension runtime messaging, Vitest with jsdom.

---

### Task 1: Kick Person From Group Chat

**Files:**
- Modify: `src/background/roleHandlers.ts`
- Modify: `src/background/roleHandlers.test.ts`
- Modify: `src/group/roleTemplates.test.ts`
- Modify: `src/teamPage/rolePanelView.ts`
- Modify: `src/teamPage/rolePanelView.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that prove:

```ts
expect(chat.roleIds).not.toContain('role-1')
expect(store.messagesById['msg-1']).toBeDefined()
expect(runtimeFrames.removeRole).toHaveBeenCalledWith('chat-1', 'role-1')
expect(rolePanelSource).toContain("kick.textContent = '踢出群聊'")
expect(rolePanelSource).toContain("runCommand('GROUP_ROLE_DELETE'")
```

- [ ] **Step 2: Verify red**

Run:

```bash
npm test -- src/group/roleTemplates.test.ts src/background/roleHandlers.test.ts src/teamPage/rolePanelView.test.ts
```

Expected: the new assertions fail because iframe closing and UI kick action are missing.

- [ ] **Step 3: Implement minimal behavior**

Update `GROUP_ROLE_DELETE` to remove the runtime frame after store mutation. Add a destructive role menu action that confirms removal and sends `GROUP_ROLE_DELETE`.

- [ ] **Step 4: Verify green**

Run the same focused test command. Expected: pass.

### Task 2: Export Chat Record

**Files:**
- Create: `src/teamPage/chatExport.ts`
- Create: `src/teamPage/chatExport.test.ts`
- Modify: `src/teamPage/chatListView.ts`
- Modify: `src/teamPage/teamHtml.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that prove:

```ts
expect(formatChatExportMarkdown(store, chat)).toContain('# 产品方案')
expect(formatChatExportMarkdown(store, chat)).toContain('工程师')
expect(formatChatExportMarkdown(store, chat)).toContain('旧成员')
expect(safeChatExportFilename('产品/方案', new Date('2026-05-06T12:34:56'))).toBe('openteam-产品-方案-20260506-123456.md')
expect(chatListSource).toContain("exportRecord.textContent = '导出记录'")
```

- [ ] **Step 2: Verify red**

Run:

```bash
npm test -- src/teamPage/chatExport.test.ts src/teamPage/teamHtml.test.ts
```

Expected: fails because the formatter and menu action do not exist.

- [ ] **Step 3: Implement minimal behavior**

Create Markdown formatter and filename helper. Add `导出记录` to the chat action menu and download via Blob/object URL.

- [ ] **Step 4: Verify green**

Run the same focused test command. Expected: pass.

### Task 3: Free Resize Floating Window

**Files:**
- Modify: `src/teamPage/floatingWindow.ts`
- Modify: `src/teamPage/floatingWindow.test.ts`
- Modify: `public/team.html`
- Modify: `public/team.css`
- Modify: `src/teamPage/teamHtml.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that prove:

```ts
expect(viewSource).toContain('function resizeShellTo(width: number, height: number): void')
expect(appShellEl.style.width).toBe('760px')
expect(appShellEl.style.height).toBe('520px')
expect(html).toContain('id="window-resize-handle"')
expect(html).toContain('.window-resize-handle')
```

- [ ] **Step 2: Verify red**

Run:

```bash
npm test -- src/teamPage/floatingWindow.test.ts src/teamPage/teamHtml.test.ts
```

Expected: fails because resize behavior and handle markup are missing.

- [ ] **Step 3: Implement minimal behavior**

Add the resize handle DOM ref, pointer handling, constrained width/height updates, and CSS affordance.

- [ ] **Step 4: Verify green**

Run the same focused test command. Expected: pass.

### Task 4: Final Verification

- [ ] **Step 1: Run typecheck**

```bash
npm run typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 2: Run focused regression tests**

```bash
npm test -- src/group/roleTemplates.test.ts src/background/roleHandlers.test.ts src/teamPage/rolePanelView.test.ts src/teamPage/chatExport.test.ts src/teamPage/chatListView.test.ts src/teamPage/floatingWindow.test.ts src/teamPage/teamHtml.test.ts
```

Expected: all pass.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: Vite build completes.

