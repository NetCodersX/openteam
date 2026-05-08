# Agent Orchestration Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OpenTeam Agent 编排模式：普通群聊不 @ 不触发 AI，用户可以用 AntV X6 编排人员节点、并行阶段和审查节点，并由 background 可恢复地执行流程。

**Architecture:** Keep the runtime deterministic: X6 is only the visual editor, normalized `OrchestrationStage[]` is the executable model, background owns run progression, and `chrome.storage.local` owns recovery. Reuse the existing site iframe and external model delivery paths instead of creating a separate execution stack.

**Tech Stack:** TypeScript, Vite, Chrome extension runtime/storage, AntV X6, Vitest, jsdom.

---

## References

- Product spec: `docs/prd/2026-05-07-agent-orchestration-mode-prd.md`
- Technical design: `docs/technical/2026-05-07-agent-orchestration-mode-technical-design.md`
- Concept image: `docs/assets/agent-orchestration-mode-concept.png`
- Existing message send route: `src/background/messageHandlers.ts`
- Existing mention parser: `src/group/mentionParser.ts`
- Existing prompt builders: `src/group/promptBuilder.ts`, `src/group/externalModelContext.ts`
- Existing team page entry: `src/teamPage/index.ts`

## File Structure

- Modify `package.json` and `package-lock.json`: add `@antv/x6`.
- Modify `src/group/types.ts`: add orchestration flow/run/message metadata types.
- Modify `src/group/store.ts`: bump store version and normalize orchestration records.
- Modify `src/group/mentionParser.ts`: support `defaultTarget: 'none'` and `@所有人`.
- Modify `src/background/messageHandlers.ts`: allow no-target user messages and hook role replies into orchestration advancement.
- Modify `src/background/index.ts`: register orchestration handlers.
- Create `src/group/orchestrationGraph.ts`: validate X6 graph snapshots and normalize them into stages.
- Create `src/group/orchestrationPrompts.ts`: build role-stage and review-stage prompts.
- Create `src/group/orchestrationReview.ts`: extract and validate review JSON.
- Create `src/background/orchestrationHandlers.ts`: route save/run/stop/retry/skip commands.
- Create `src/background/orchestrationRuntime.ts`: execute stages, advance runs, and enforce max rounds.
- Create `src/teamPage/orchestrationModalView.ts`: modal shell, task input, settings, save/run wiring.
- Create `src/teamPage/orchestrationCanvas.ts`: AntV X6 graph setup, node registration, Dnd, validation.
- Create `src/teamPage/orchestrationStatusView.ts`: active run status strip.
- Modify `src/teamPage/appState.ts`: add orchestration modal/canvas state.
- Modify `src/teamPage/domRefs.ts` and `public/team.html`: add orchestration button/modal containers.
- Modify `src/teamPage/composerView.ts`: change no-@ preview and send behavior.
- Modify `src/teamPage/messagesView.ts`: render orchestration message metadata.
- Modify `public/team.css`: orchestration modal, canvas, nodes, status strip, message labels.
- Add/extend tests in:
  - `src/group/mentionParser.test.ts`
  - `src/group/store.test.ts`
  - `src/group/orchestrationGraph.test.ts`
  - `src/group/orchestrationPrompts.test.ts`
  - `src/group/orchestrationReview.test.ts`
  - `src/background/groupExperience.test.ts`
  - `src/background/orchestrationRuntime.test.ts`
  - `src/background/orchestrationHandlers.test.ts`
  - `src/teamPage/orchestrationModalView.test.ts`
  - `src/teamPage/orchestrationCanvas.test.ts`
  - `src/teamPage/messagesView.test.ts`
  - `src/teamPage/domRefs.test.ts`
  - `src/teamPage/teamHtml.test.ts`

## Task 1: Ordinary Chat Trigger Rule

**Files:**
- Modify: `src/group/mentionParser.ts`
- Modify: `src/background/messageHandlers.ts`
- Modify: `src/teamPage/composerView.ts`
- Modify: `public/team.html`
- Test: `src/group/mentionParser.test.ts`
- Test: `src/background/groupExperience.test.ts`
- Test: `src/teamPage/composerView.test.ts`
- Test: `src/teamPage/teamHtml.test.ts`

- [ ] **Step 1: Write failing parser tests**

Add tests that verify:

```ts
parseGroupMentions('记录一下这个背景', roles, { defaultTarget: 'none' })
// => targetRoleIds: [], mentionedRoleIds: []

parseGroupMentions('@所有人 帮我评审', roles, { defaultTarget: 'none' })
// => targetRoleIds: all role ids

parseGroupMentions('@all 帮我评审', roles, { defaultTarget: 'none' })
// => targetRoleIds: all role ids
```

- [ ] **Step 2: Run parser tests red**

Run: `npx vitest run src/group/mentionParser.test.ts`

Expected: FAIL because `defaultTarget` and `@所有人` are not implemented.

- [ ] **Step 3: Implement parser option**

Add a parser options type that extends the existing label options:

```ts
export interface ParseGroupMentionsOptions extends RoleMentionLabelOptions {
  defaultTarget?: 'all' | 'none'
}
```

Update no-mention handling:

```ts
if (!trimmed.includes('@')) {
  return {
    ok: true,
    content: trimmed,
    targetRoleIds: options.defaultTarget === 'none' ? [] : allRoleIds,
    mentionedRoleIds: [],
  }
}
```

Support both `@all` and `@所有人` as all-target aliases.

- [ ] **Step 4: Run parser tests green**

Run: `npx vitest run src/group/mentionParser.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing background tests for no-target messages**

In `src/background/groupExperience.test.ts`, add a test that sends `GROUP_MESSAGE_SEND` with no @ and expects:

- one user message stored
- `targetRoleIds` is `[]`
- `deliveryStatus` is `{}`
- message status is `received`
- no `TEAM_SEND_PROMPT` call
- no role status changes to `thinking`

- [ ] **Step 6: Implement no-target message storage**

In `handleMessageSend`, call:

```ts
parseGroupMentions(raw, roles, {
  ...roleMentionLabelOptionsFromSettings(store.settings),
  defaultTarget: 'none',
})
```

When parsed targets are empty, create the user message and return with empty deliveries instead of throwing.

- [ ] **Step 7: Update composer behavior**

Change placeholder and preview copy:

```text
输入消息，@人员可指定回复；不 @ 只记录到群聊。
```

No-@ messages should not check role availability. Mentioned targets should continue using the current ready/reconnect/thinking checks.

- [ ] **Step 8: Run focused tests**

Run:

```bash
npx vitest run src/group/mentionParser.test.ts src/background/groupExperience.test.ts src/teamPage/composerView.test.ts src/teamPage/teamHtml.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/group/mentionParser.ts src/background/messageHandlers.ts src/teamPage/composerView.ts public/team.html src/group/mentionParser.test.ts src/background/groupExperience.test.ts src/teamPage/composerView.test.ts src/teamPage/teamHtml.test.ts
git commit -m "feat: require mentions to trigger chat replies"
```

## Task 2: Orchestration Types And Store Persistence

**Files:**
- Modify: `src/group/types.ts`
- Modify: `src/group/store.ts`
- Test: `src/group/store.test.ts`

- [ ] **Step 1: Write failing store normalization tests**

Add tests that:

- `createDefaultStore()` includes empty orchestration records.
- `normalizeStore` fills missing orchestration records for older stores.
- `saveStore` and `loadStore` preserve one flow, one run, and active run map.

- [ ] **Step 2: Run store tests red**

Run: `npx vitest run src/group/store.test.ts`

Expected: FAIL because orchestration fields and version `5` do not exist.

- [ ] **Step 3: Add orchestration types**

Add exported types for:

```ts
OrchestrationStage
OrchestrationFlow
OrchestrationRun
OrchestrationStageRun
OrchestrationRoleRun
OrchestrationReviewConfig
OrchestrationReviewResult
ReviewDecision
```

Also extend `GroupMessage` with:

```ts
orchestrationRunId?: string
orchestrationRound?: number
orchestrationStageId?: string
orchestrationStageIndex?: number
orchestrationKind?: 'task' | 'role' | 'review' | 'status'
```

- [ ] **Step 4: Add store fields**

Add to `OpenTeamStore`:

```ts
orchestrationFlowsById?: Record<string, OrchestrationFlow>
orchestrationFlowOrderByChatId?: Record<string, string[]>
orchestrationRunsById?: Record<string, OrchestrationRun>
activeOrchestrationRunIdByChatId?: Record<string, string>
```

Bump `CURRENT_STORE_VERSION` to `5`, update defaults, meta store, build storage items, and normalizers.

- [ ] **Step 5: Run store tests green**

Run: `npx vitest run src/group/store.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/group/types.ts src/group/store.ts src/group/store.test.ts
git commit -m "feat: persist orchestration flows and runs"
```

## Task 3: Graph Normalization And Review JSON

**Files:**
- Create: `src/group/orchestrationGraph.ts`
- Create: `src/group/orchestrationReview.ts`
- Test: `src/group/orchestrationGraph.test.ts`
- Test: `src/group/orchestrationReview.test.ts`

- [ ] **Step 1: Write graph tests**

Cover:

- `A -> B -> C` becomes three stages.
- `A -> B`, `A -> C`, `B -> D`, `C -> D` becomes `A`, `B+C`, `D`.
- self loops fail.
- review followed by role fails.
- two review nodes fail.
- graph with unknown role IDs fails.

- [ ] **Step 2: Write review parser tests**

Cover:

- plain JSON parses.
- fenced ` ```json ` content parses.
- invalid JSON fails.
- invalid `decision` fails.
- `continue` with empty `nextRoundInstruction` fails.

- [ ] **Step 3: Run tests red**

Run:

```bash
npx vitest run src/group/orchestrationGraph.test.ts src/group/orchestrationReview.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement graph normalization**

Export:

```ts
validateOrchestrationGraph(input): OrchestrationGraphValidationResult
normalizeOrchestrationGraph(input): OrchestrationStage[]
```

Use topology layers as the first implementation. Return precise user-facing errors such as:

```text
审查节点必须位于流程末尾
流程不能包含循环
流程中包含不属于当前群聊的人员
```

- [ ] **Step 5: Implement review parser**

Export:

```ts
parseReviewDecision(raw: string): { ok: true; result: ParsedReviewDecision } | { ok: false; error: string }
```

The parser should extract fenced JSON when present, then validate fields.

- [ ] **Step 6: Run tests green**

Run:

```bash
npx vitest run src/group/orchestrationGraph.test.ts src/group/orchestrationReview.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/group/orchestrationGraph.ts src/group/orchestrationReview.ts src/group/orchestrationGraph.test.ts src/group/orchestrationReview.test.ts
git commit -m "feat: validate orchestration graphs and reviews"
```

## Task 4: Orchestration Prompt Builders

**Files:**
- Create: `src/group/orchestrationPrompts.ts`
- Test: `src/group/orchestrationPrompts.test.ts`

- [ ] **Step 1: Write prompt tests**

Assert role prompt includes:

- user task
- current round and max rounds
- flow stages
- prior stage messages
- previous review instruction when present
- role name and persona when `includePersona` is true

Assert review prompt includes:

- review criteria
- JSON schema
- `decision` enum values
- current round and max rounds
- instruction to output only JSON

- [ ] **Step 2: Run prompt tests red**

Run: `npx vitest run src/group/orchestrationPrompts.test.ts`

Expected: FAIL because prompt builders do not exist.

- [ ] **Step 3: Implement prompt builders**

Export:

```ts
buildOrchestrationRolePrompt(input: BuildOrchestrationRolePromptInput): string
buildOrchestrationReviewPrompt(input: BuildOrchestrationReviewPromptInput): string
```

Use `store.settings.maxContextChars` semantics from the existing context builders: preserve task, current round, previous review, and latest prior stage messages first.

- [ ] **Step 4: Run prompt tests green**

Run: `npx vitest run src/group/orchestrationPrompts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/group/orchestrationPrompts.ts src/group/orchestrationPrompts.test.ts
git commit -m "feat: build orchestration prompts"
```

## Task 5: Background Runtime Skeleton

**Files:**
- Create: `src/background/orchestrationHandlers.ts`
- Create: `src/background/orchestrationRuntime.ts`
- Modify: `src/background/index.ts`
- Test: `src/background/orchestrationHandlers.test.ts`
- Test: `src/background/orchestrationRuntime.test.ts`

- [ ] **Step 1: Write route tests**

Assert routes exist for:

```text
GROUP_ORCHESTRATION_FLOW_SAVE
GROUP_ORCHESTRATION_FLOW_DELETE
GROUP_ORCHESTRATION_RUN
GROUP_ORCHESTRATION_STOP
GROUP_ORCHESTRATION_RETRY_STAGE
GROUP_ORCHESTRATION_SKIP_STAGE
GROUP_ORCHESTRATION_RETRY_REVIEW
```

- [ ] **Step 2: Write runtime creation tests**

`GROUP_ORCHESTRATION_RUN` should:

- reject empty task
- reject missing chat
- reject active run in same chat
- create task message
- create run
- set active run map
- broadcast store

- [ ] **Step 3: Run tests red**

Run:

```bash
npx vitest run src/background/orchestrationHandlers.test.ts src/background/orchestrationRuntime.test.ts
```

Expected: FAIL because routes/runtime do not exist.

- [ ] **Step 4: Implement save/delete/run/stop route shell**

Implement flow save/delete and run creation first. Stop should mark run `stopped` and clear active run.

- [ ] **Step 5: Register handlers**

In `src/background/index.ts`, add `createOrchestrationHandlers(...)` to the route list with dependencies:

```ts
broadcastStoreUpdated
externalModelClient
getChatStatusFromRoles
log
newId
now
runtimeFrames
sendError
sendPrompt
sendRoleMessage
```

- [ ] **Step 6: Run route/runtime tests green**

Run:

```bash
npx vitest run src/background/orchestrationHandlers.test.ts src/background/orchestrationRuntime.test.ts
```

Expected: PASS for save/delete/run/stop shell.

- [ ] **Step 7: Commit**

```bash
git add src/background/orchestrationHandlers.ts src/background/orchestrationRuntime.ts src/background/index.ts src/background/orchestrationHandlers.test.ts src/background/orchestrationRuntime.test.ts
git commit -m "feat: add orchestration runtime routes"
```

## Task 6: Execute Role Stages

**Files:**
- Modify: `src/background/orchestrationRuntime.ts`
- Modify: `src/background/messageHandlers.ts`
- Test: `src/background/orchestrationRuntime.test.ts`
- Test: `src/background/groupExperience.test.ts`

- [ ] **Step 1: Write role-stage execution tests**

Cover:

- first stage sends prompt to one role
- parallel stage sends prompt to two roles
- role status becomes `thinking`
- `stageRun` and `roleRuns` are created
- site iframe delivery uses `TEAM_SEND_PROMPT`
- external model delivery uses external model client

- [ ] **Step 2: Run tests red**

Run:

```bash
npx vitest run src/background/orchestrationRuntime.test.ts src/background/groupExperience.test.ts
```

Expected: FAIL because stage execution is not implemented.

- [ ] **Step 3: Extract reusable delivery helpers**

Move shared role delivery preparation out of `handleMessageSend` enough for orchestration runtime to reuse site iframe and external model paths without duplicating logic.

- [ ] **Step 4: Implement executeNextStage**

Implement:

```ts
executeNextStage(deps, runId): Promise<OpenTeamStore>
```

For role stages, build orchestration prompts, create prompt anchors, send deliveries, and persist stage run status.

- [ ] **Step 5: Hook replies into advancement**

After normal assistant reply is stored in `handleRoleReply` and after external model response storage, call:

```ts
maybeAdvanceOrchestrationRun(deps, {
  chatId,
  roleId,
  promptMessageId,
  replyMessageId,
})
```

- [ ] **Step 6: Run tests green**

Run:

```bash
npx vitest run src/background/orchestrationRuntime.test.ts src/background/groupExperience.test.ts
```

Expected: PASS for role-stage execution and advancement.

- [ ] **Step 7: Commit**

```bash
git add src/background/orchestrationRuntime.ts src/background/messageHandlers.ts src/background/orchestrationRuntime.test.ts src/background/groupExperience.test.ts
git commit -m "feat: execute orchestration role stages"
```

## Task 7: Review Stage And Multi-Round Control

**Files:**
- Modify: `src/background/orchestrationRuntime.ts`
- Modify: `src/group/orchestrationPrompts.ts`
- Modify: `src/group/orchestrationReview.ts`
- Test: `src/background/orchestrationRuntime.test.ts`
- Test: `src/background/groupExperience.test.ts`
- Test: `src/group/orchestrationReview.test.ts`

- [ ] **Step 1: Write review runtime tests**

Cover:

- review stage sends review prompt to reviewer role
- valid `pass` completes run and clears active map
- valid `continue` starts next round when below max rounds
- valid `continue` completes run when max rounds reached
- valid `stop` stops run and clears active map
- invalid JSON sets run and stage to `error`

- [ ] **Step 2: Run tests red**

Run:

```bash
npx vitest run src/background/orchestrationRuntime.test.ts src/background/groupExperience.test.ts
```

Expected: FAIL because review decisions do not drive runtime.

- [ ] **Step 3: Implement review stage execution**

Build review prompt, deliver to reviewer, store review message metadata, parse reply through `parseReviewDecision`, persist `OrchestrationReviewResult`.

- [ ] **Step 4: Implement round transition**

When decision is `continue`:

- if `currentRound < maxRounds`, increment round and execute stage 0
- if max reached, complete run and append system status message

- [ ] **Step 5: Run review tests green**

Run:

```bash
npx vitest run src/group/orchestrationReview.test.ts src/background/orchestrationRuntime.test.ts src/background/groupExperience.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/background/orchestrationRuntime.ts src/group/orchestrationPrompts.ts src/group/orchestrationReview.ts src/background/orchestrationRuntime.test.ts src/background/groupExperience.test.ts src/group/orchestrationReview.test.ts
git commit -m "feat: add orchestration review gates"
```

## Task 8: X6 Orchestration Modal

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `public/team.html`
- Modify: `public/team.css`
- Modify: `src/teamPage/appState.ts`
- Modify: `src/teamPage/domRefs.ts`
- Modify: `src/teamPage/index.ts`
- Create: `src/teamPage/orchestrationModalView.ts`
- Create: `src/teamPage/orchestrationCanvas.ts`
- Test: `src/teamPage/domRefs.test.ts`
- Test: `src/teamPage/teamHtml.test.ts`
- Test: `src/teamPage/orchestrationModalView.test.ts`
- Test: `src/teamPage/orchestrationCanvas.test.ts`

- [ ] **Step 1: Install X6**

Run:

```bash
npm install @antv/x6
```

Expected: `package.json` and `package-lock.json` include `@antv/x6`.

- [ ] **Step 2: Write UI tests**

Assert:

- 编排入口 button exists.
- modal container exists.
- task input exists.
- canvas container exists.
- review criteria field exists.
- save/run buttons exist.

- [ ] **Step 3: Run UI tests red**

Run:

```bash
npx vitest run src/teamPage/domRefs.test.ts src/teamPage/teamHtml.test.ts src/teamPage/orchestrationModalView.test.ts src/teamPage/orchestrationCanvas.test.ts
```

Expected: FAIL because UI modules and markup do not exist.

- [ ] **Step 4: Implement modal markup and refs**

Add a button near the chat header:

```text
编排任务
```

Add modal DOM with task input, people list, canvas root, review settings, and footer actions.

- [ ] **Step 5: Implement X6 canvas wrapper**

Use dynamic import so normal chat boot does not eagerly load X6:

```ts
const { Graph, Addon } = await import('@antv/x6')
```

Expose `mount`, `load`, `toDraft`, `validate`, and `destroy`.

- [ ] **Step 6: Wire save and run**

Save calls `GROUP_ORCHESTRATION_FLOW_SAVE`. Run calls `GROUP_ORCHESTRATION_RUN` with task and current draft.

- [ ] **Step 7: Style modal and graph nodes**

Match the current dark glass UI:

- modal overlay
- left people list
- canvas panel
- review settings panel
- role/review node styles
- cyan primary run button

- [ ] **Step 8: Run UI tests green**

Run:

```bash
npx vitest run src/teamPage/domRefs.test.ts src/teamPage/teamHtml.test.ts src/teamPage/orchestrationModalView.test.ts src/teamPage/orchestrationCanvas.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json public/team.html public/team.css src/teamPage/appState.ts src/teamPage/domRefs.ts src/teamPage/index.ts src/teamPage/orchestrationModalView.ts src/teamPage/orchestrationCanvas.ts src/teamPage/domRefs.test.ts src/teamPage/teamHtml.test.ts src/teamPage/orchestrationModalView.test.ts src/teamPage/orchestrationCanvas.test.ts
git commit -m "feat: add orchestration editor modal"
```

## Task 9: Runtime Status And Message Rendering

**Files:**
- Create: `src/teamPage/orchestrationStatusView.ts`
- Modify: `src/teamPage/messagesView.ts`
- Modify: `src/teamPage/index.ts`
- Modify: `public/team.css`
- Test: `src/teamPage/messagesView.test.ts`
- Test: `src/teamPage/orchestrationStatusView.test.ts`

- [ ] **Step 1: Write status rendering tests**

Assert active run displays:

```text
编排运行中 · 第 1 轮 · 第 2 步 / 共 4 步
当前：工程师、设计师正在发言
```

Assert completed/stopped/error states display distinct labels.

- [ ] **Step 2: Write message metadata tests**

Assert orchestration assistant messages display:

```text
编排 · 第 1 轮 · 第 2 步
```

Assert review messages display decision summary when review result metadata is present.

- [ ] **Step 3: Run tests red**

Run:

```bash
npx vitest run src/teamPage/messagesView.test.ts src/teamPage/orchestrationStatusView.test.ts
```

Expected: FAIL because status view and labels do not exist.

- [ ] **Step 4: Implement status view**

Derive current run from:

```ts
store.activeOrchestrationRunIdByChatId?.[currentChatId]
store.orchestrationRunsById?.[runId]
store.orchestrationFlowsById?.[run.flowId]
```

Render current round, current stage, running role names, waiting stage names, and action buttons.

- [ ] **Step 5: Implement message labels**

In `messagesView`, use `GroupMessage` orchestration metadata to render compact labels for task, role, review, and status messages.

- [ ] **Step 6: Run tests green**

Run:

```bash
npx vitest run src/teamPage/messagesView.test.ts src/teamPage/orchestrationStatusView.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/teamPage/orchestrationStatusView.ts src/teamPage/messagesView.ts src/teamPage/index.ts public/team.css src/teamPage/messagesView.test.ts src/teamPage/orchestrationStatusView.test.ts
git commit -m "feat: show orchestration run status"
```

## Task 10: Failure Controls

**Files:**
- Modify: `src/background/orchestrationHandlers.ts`
- Modify: `src/background/orchestrationRuntime.ts`
- Modify: `src/teamPage/orchestrationStatusView.ts`
- Test: `src/background/orchestrationRuntime.test.ts`
- Test: `src/background/orchestrationHandlers.test.ts`
- Test: `src/teamPage/orchestrationStatusView.test.ts`

- [ ] **Step 1: Write failure control tests**

Cover:

- stop clears active run and prevents further advancement
- skipped role lets stage complete when all remaining role runs are completed/skipped
- retry stage resends failed role prompts
- retry review resends review prompt
- late reply after stop stores message but does not advance run

- [ ] **Step 2: Run tests red**

Run:

```bash
npx vitest run src/background/orchestrationRuntime.test.ts src/background/orchestrationHandlers.test.ts src/teamPage/orchestrationStatusView.test.ts
```

Expected: FAIL because failure controls are incomplete.

- [ ] **Step 3: Implement stop**

Stop should:

- mark run `stopped`
- clear active map
- abort external model runs when possible
- send `TEAM_STOP_GENERATION` to currently running site roles when bindings are ready
- prevent `maybeAdvanceOrchestrationRun` from advancing stopped runs

- [ ] **Step 4: Implement skip and retry**

Skip should update role/stage run status and then call advancement logic. Retry should create new `replyAttemptId`, resend prompt, and keep the run active.

- [ ] **Step 5: Wire UI buttons**

Status view buttons send:

```text
GROUP_ORCHESTRATION_STOP
GROUP_ORCHESTRATION_RETRY_STAGE
GROUP_ORCHESTRATION_SKIP_STAGE
GROUP_ORCHESTRATION_RETRY_REVIEW
```

- [ ] **Step 6: Run tests green**

Run:

```bash
npx vitest run src/background/orchestrationRuntime.test.ts src/background/orchestrationHandlers.test.ts src/teamPage/orchestrationStatusView.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/background/orchestrationHandlers.ts src/background/orchestrationRuntime.ts src/teamPage/orchestrationStatusView.ts src/background/orchestrationRuntime.test.ts src/background/orchestrationHandlers.test.ts src/teamPage/orchestrationStatusView.test.ts
git commit -m "feat: control orchestration failures"
```

## Task 11: End-To-End Verification And Polish

**Files:**
- All modified files.
- Optional: `src/e2e/groupRuntime.e2e.ts`
- Optional: `docs/technical/2026-05-07-agent-orchestration-mode-technical-design.md`

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 2: Run unit tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run e2e tests**

Run: `npm run test:e2e`

Expected: PASS.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Inspect dependency impact**

Run:

```bash
npm ls @antv/x6
du -sh node_modules/@antv/x6
```

Expected: X6 is installed once. If build startup is noticeably slower, confirm dynamic import is used for the editor path.

- [ ] **Step 6: Manual browser smoke test**

Load the extension build, open `team.html`, and verify:

- no-@ message only records a user message
- `@所有人` triggers all roles
- 编排任务 modal opens
- role nodes can be placed and connected
- run starts and produces task message
- role replies advance to next stage
- review JSON can complete or continue a run
- stop prevents additional stages

- [ ] **Step 7: Update docs if implementation differs**

If implementation names, limitations, or route names differ from the plan, update:

```text
docs/prd/2026-05-07-agent-orchestration-mode-prd.md
docs/technical/2026-05-07-agent-orchestration-mode-technical-design.md
```

- [ ] **Step 8: Final diff review**

Run:

```bash
git diff --stat
git diff -- package.json src/group src/background src/teamPage public/team.html public/team.css docs
```

Expected: diff is limited to orchestration mode, ordinary chat trigger rule, tests, and docs.

- [ ] **Step 9: Commit final polish**

```bash
git add .
git commit -m "chore: verify orchestration mode implementation"
```

## Implementation Order Summary

1. Ordinary chat trigger rule.
2. Orchestration types and Store persistence.
3. Graph normalization and review JSON.
4. Prompt builders.
5. Background route/runtime skeleton.
6. Role-stage execution and advancement.
7. Review-stage and multi-round control.
8. X6 editor modal.
9. Runtime status and message rendering.
10. Failure controls.
11. Verification and polish.

## Acceptance Checklist

- [ ] 普通群聊无 @ 只记录消息，不触发 AI。
- [ ] 普通群聊 @ 单人、@ 多人、@所有人行为正确。
- [ ] X6 编排弹窗能打开、关闭、保存和运行。
- [ ] X6 graph 能归一化为线性 stages。
- [ ] 非法 graph 无法运行并提示原因。
- [ ] 编排 run 可持久化和恢复展示。
- [ ] 单人 stage 能投递并推进。
- [ ] 并行 stage 等全部 role 完成后推进。
- [ ] 后续 stage prompt 能看到前置 stage 输出。
- [ ] 审查节点能解析 JSON。
- [ ] `pass` 完成流程。
- [ ] `continue` 在未达到最大轮数时进入下一轮。
- [ ] 达到最大轮数时强制结束。
- [ ] `stop` 停止流程并阻止后续推进。
- [ ] 失败 role 支持重试、跳过、停止。
- [ ] `npm run typecheck` 通过。
- [ ] `npm test` 通过。
- [ ] `npm run test:e2e` 通过。
- [ ] `npm run build` 通过。
