// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import type { OrchestrationStage } from '../group/types'
import { createOrchestrationCanvas } from './orchestrationCanvas'

class MockGraph {
  static instances: MockGraph[] = []
  nodes: unknown[] = []
  edges: unknown[] = []
  disposed = false
  handlers = new Map<string, (args: { node?: { getData(): Record<string, unknown> } }) => void>()

  constructor(public options: Record<string, unknown>) {
    MockGraph.instances.push(this)
  }

  clearCells(): void {
    this.nodes = []
    this.edges = []
  }

  addNode(node: unknown): unknown {
    this.nodes.push(node)
    return node
  }

  addEdge(edge: unknown): unknown {
    this.edges.push(edge)
    return edge
  }

  on(eventName: string, handler: (args: { node?: { getData(): Record<string, unknown> } }) => void): void {
    this.handlers.set(eventName, handler)
  }

  dispose(): void {
    this.disposed = true
  }
}

const stages: OrchestrationStage[] = [
  { id: 'stage-1', kind: 'roles', name: '分析', roleIds: ['role-1', 'role-2'] },
  { id: 'review-1', kind: 'review', name: '审核', roleIds: ['role-3'], review: { reviewerRoleIds: ['role-3'], instructions: '必须完整' } },
]

describe('orchestration canvas', () => {
  it('loads X6 through the injected dynamic loader and renders one node per stage', async () => {
    MockGraph.instances = []
    const rootEl = document.createElement('div')
    const loadX6 = vi.fn(async () => ({ Graph: MockGraph }))
    const onStageSelected = vi.fn()
    const canvas = createOrchestrationCanvas({
      rootEl,
      getRoleName: roleId => ({ 'role-1': '产品', 'role-2': '工程', 'role-3': '评审' })[roleId] ?? roleId,
      onStageSelected,
      onRoleDropped: vi.fn(),
      loadX6,
    })

    await canvas.mount(stages, 'stage-1')

    expect(loadX6).toHaveBeenCalledTimes(1)
    expect(MockGraph.instances[0].options.container).toBe(rootEl)
    expect(MockGraph.instances[0].nodes).toHaveLength(2)
    expect(MockGraph.instances[0].edges).toHaveLength(1)
    MockGraph.instances[0].handlers.get('node:click')?.({ node: { getData: () => ({ stageId: 'review-1' }) } })
    expect(onStageSelected).toHaveBeenCalledWith('review-1')
  })

  it('handles role drops and disposes X6 graph on destroy', async () => {
    MockGraph.instances = []
    const rootEl = document.createElement('div')
    const onRoleDropped = vi.fn()
    const canvas = createOrchestrationCanvas({
      rootEl,
      getRoleName: roleId => roleId,
      onStageSelected: vi.fn(),
      onRoleDropped,
      loadX6: async () => ({ Graph: MockGraph }),
    })
    await canvas.mount(stages)

    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', { value: { getData: () => 'role-4' } })
    rootEl.dispatchEvent(drop)

    expect(onRoleDropped).toHaveBeenCalledWith('role-4', undefined)
    canvas.destroy()
    expect(MockGraph.instances[0].disposed).toBe(true)
  })
})
