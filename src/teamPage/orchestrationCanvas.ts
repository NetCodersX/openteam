import type { GroupRole, OrchestrationStage } from '../group/types'

interface X6GraphNode {
  id?: string
  shape?: string
  x?: number
  y?: number
  width?: number
  height?: number
  label?: string
  data?: Record<string, unknown>
  attrs?: Record<string, unknown>
}

interface X6GraphEdge {
  source: string
  target: string
  attrs?: Record<string, unknown>
}

interface X6Graph {
  clearCells(): void
  addNode(node: X6GraphNode): unknown
  addEdge(edge: X6GraphEdge): unknown
  on(eventName: string, handler: (args: { node?: { getData(): Record<string, unknown> } }) => void): void
  dispose(): void
}

interface X6Module {
  Graph: new (options: Record<string, unknown>) => X6Graph
}

export type LoadX6 = () => Promise<X6Module>

export interface OrchestrationCanvasDependencies {
  rootEl: HTMLElement
  getRoleName(roleId: string): string
  onStageSelected(stageId: string): void
  onRoleDropped(roleId: string, targetStageId?: string): void
  loadX6?: LoadX6
}

export interface OrchestrationCanvas {
  mount(stages: OrchestrationStage[], selectedStageId?: string): Promise<void>
  render(stages: OrchestrationStage[], selectedStageId?: string): void
  destroy(): void
}

export function createOrchestrationCanvas(deps: OrchestrationCanvasDependencies): OrchestrationCanvas {
  let graph: X6Graph | undefined
  let destroyed = false
  const loadX6 = deps.loadX6 ?? (async () => await import('@antv/x6') as X6Module)

  const handleDragOver = (event: DragEvent): void => {
    if (!event.dataTransfer?.types.includes('application/x-openteam-role-id')) return
    event.preventDefault()
  }

  const handleDrop = (event: DragEvent): void => {
    const roleId = event.dataTransfer?.getData('application/x-openteam-role-id')
    if (!roleId) return
    event.preventDefault()
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-stage-id]') : undefined
    deps.onRoleDropped(roleId, target?.dataset.stageId)
  }

  async function mount(stages: OrchestrationStage[], selectedStageId?: string): Promise<void> {
    destroyed = false
    deps.rootEl.addEventListener('dragover', handleDragOver)
    deps.rootEl.addEventListener('drop', handleDrop)
    const { Graph } = await loadX6()
    if (destroyed) return
    graph = new Graph({
      container: deps.rootEl,
      autoResize: true,
      grid: true,
      panning: true,
      mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'] },
    })
    graph.on('node:click', ({ node }) => {
      const stageId = node?.getData().stageId
      if (typeof stageId === 'string') deps.onStageSelected(stageId)
    })
    render(stages, selectedStageId)
  }

  function render(stages: OrchestrationStage[], selectedStageId?: string): void {
    if (!graph) return
    graph.clearCells()
    stages.forEach((stage, index) => {
      const roleLabel = stage.roleIds.map(deps.getRoleName).join(' + ') || '未选择人员'
      const isReview = stage.kind === 'review'
      const selected = selectedStageId === stage.id
      graph?.addNode({
        id: stage.id,
        shape: 'rect',
        x: 36 + index * 220,
        y: isReview ? 112 : 56,
        width: 172,
        height: 82,
        label: `${isReview ? '审核' : `阶段 ${index + 1}`}\n${stage.name}\n${roleLabel}`,
        data: { stageId: stage.id },
        attrs: {
          body: {
            fill: isReview ? '#221936' : '#101d2b',
            stroke: selected ? '#57d8dd' : isReview ? '#b18cff' : '#35536a',
            strokeWidth: selected ? 3 : 1,
            rx: 12,
            ry: 12,
          },
          label: { fill: '#edf5f7', fontSize: 12, lineHeight: 18 },
        },
      })
      if (index > 0) {
        graph?.addEdge({
          source: stages[index - 1].id,
          target: stage.id,
          attrs: { line: { stroke: '#57d8dd', strokeWidth: 2, targetMarker: 'block' } },
        })
      }
    })
  }

  function destroy(): void {
    destroyed = true
    deps.rootEl.removeEventListener('dragover', handleDragOver)
    deps.rootEl.removeEventListener('drop', handleDrop)
    graph?.dispose()
    graph = undefined
    deps.rootEl.replaceChildren()
  }

  return { mount, render, destroy }
}

export function stageRoleLabel(stage: OrchestrationStage, rolesById: Record<string, GroupRole>): string {
  return stage.roleIds.map(roleId => rolesById[roleId]?.name ?? '未知人员').join(' + ')
}
