import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useMemo, useState } from 'react'
import { useMoveTask, useReorderStatuses } from '../../lib/queries'
import type { Status, Task } from '../../lib/types'
import { TaskCard } from './TaskCard'

type Containers = Record<string, string[]>
type DragType = 'task' | 'column'

function groupTasks(statuses: Status[], tasks: Task[]): Containers {
  const containers: Containers = {}
  for (const s of statuses) containers[s.id] = []
  for (const t of tasks) {
    if (!containers[t.status_id]) containers[t.status_id] = []
    containers[t.status_id].push(t.id)
  }
  return containers
}

function SortableTaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: 'task' } })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-40' : ''}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onClick={onClick} />
    </div>
  )
}

function ColumnHeader({ status, count }: { status: Status; count: number }) {
  return (
    <>
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
      <h3 className="text-sm font-semibold text-slate-700">{status.name}</h3>
      <span className="ml-auto text-xs text-slate-400">{count}</span>
    </>
  )
}

function Column({
  status,
  taskIds,
  tasksById,
  onTaskClick,
}: {
  status: Status
  taskIds: string[]
  tasksById: Record<string, Task>
  onTaskClick: (task: Task) => void
}) {
  // The column is itself sortable (horizontal reorder) AND a droppable target
  // for task cards. Drag listeners live on the header handle only, so grabbing
  // a card drags the card while grabbing the header drags the whole column.
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: status.id, data: { type: 'column' } })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex w-72 shrink-0 flex-col rounded-xl bg-slate-100 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex cursor-grab items-center gap-2 px-3 py-2 active:cursor-grabbing"
      >
        <ColumnHeader status={status} count={taskIds.length} />
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[60px] flex-col gap-2 p-2">
          {taskIds.map((id) => {
            const task = tasksById[id]
            if (!task) return null
            return (
              <SortableTaskCard key={id} task={task} onClick={() => onTaskClick(task)} />
            )
          })}
        </div>
      </SortableContext>
    </div>
  )
}

export function KanbanBoard({
  statuses,
  tasks,
  onTaskClick,
}: {
  statuses: Status[]
  tasks: Task[]
  onTaskClick: (task: Task) => void
}) {
  const projectId = statuses[0]?.project_id ?? ''
  const moveTask = useMoveTask(projectId)
  const reorderStatuses = useReorderStatuses(projectId)

  const tasksById = useMemo(
    () => Object.fromEntries(tasks.map((t) => [t.id, t])),
    [tasks],
  )
  const statusById = useMemo(
    () => Object.fromEntries(statuses.map((s) => [s.id, s])),
    [statuses],
  )

  const [containers, setContainers] = useState<Containers>(() =>
    groupTasks(statuses, tasks),
  )
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    statuses.map((s) => s.id),
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<DragType | null>(null)

  // Re-sync local state from the server whenever we are not mid-drag.
  useEffect(() => {
    if (activeId === null) {
      setContainers(groupTasks(statuses, tasks))
      setColumnOrder(statuses.map((s) => s.id))
    }
  }, [statuses, tasks, activeId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function findContainer(id: string): string | undefined {
    if (containers[id]) return id // id is a column
    return Object.keys(containers).find((key) => containers[key].includes(id))
  }

  function onDragStart(e: DragStartEvent) {
    setActiveType((e.active.data.current?.type as DragType) ?? 'task')
    setActiveId(String(e.active.id))
  }

  function onDragOver(e: DragOverEvent) {
    if (activeType === 'column') return // columns animate via SortableContext
    const { active, over } = e
    if (!over) return
    const activeContainer = findContainer(String(active.id))
    const overContainer = findContainer(String(over.id))
    if (!activeContainer || !overContainer || activeContainer === overContainer) return

    setContainers((prev) => {
      const activeItems = prev[activeContainer]
      const overItems = prev[overContainer]
      const overIndex = overItems.indexOf(String(over.id))
      const insertAt = overIndex >= 0 ? overIndex : overItems.length
      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== String(active.id)),
        [overContainer]: [
          ...overItems.slice(0, insertAt),
          String(active.id),
          ...overItems.slice(insertAt),
        ],
      }
    })
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    const activeIdStr = String(active.id)
    const type = activeType
    setActiveId(null)
    setActiveType(null)
    if (!over) return

    // --- Column reorder ---
    if (type === 'column') {
      const overColumn = findContainer(String(over.id))
      const oldIndex = columnOrder.indexOf(activeIdStr)
      const newIndex = overColumn ? columnOrder.indexOf(overColumn) : -1
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const finalOrder = arrayMove(columnOrder, oldIndex, newIndex)
        setColumnOrder(finalOrder)
        reorderStatuses.mutate(finalOrder)
      }
      return
    }

    // --- Task move / reorder ---
    const overContainer = findContainer(String(over.id))
    const activeContainer = findContainer(activeIdStr)
    if (!activeContainer || !overContainer) return

    const finalContainers = { ...containers }
    if (activeContainer === overContainer) {
      const items = finalContainers[overContainer]
      const from = items.indexOf(activeIdStr)
      const to = items.indexOf(String(over.id))
      if (from !== to && to !== -1) {
        finalContainers[overContainer] = arrayMove(items, from, to)
        setContainers(finalContainers)
      }
    }

    // Persist positions for the target column so ordering is durable.
    const targetIds = finalContainers[overContainer]
    await Promise.all(
      targetIds.map((taskId, index) => {
        const task = tasksById[taskId]
        if (task && (task.status_id !== overContainer || task.position !== index)) {
          return moveTask.mutateAsync({
            id: taskId,
            status_id: overContainer,
            position: index,
          })
        }
        return Promise.resolve()
      }),
    )
  }

  const activeTask = activeType === 'task' && activeId ? tasksById[activeId] : null
  const activeColumn =
    activeType === 'column' && activeId ? statusById[activeId] : null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columnOrder.map((cid) => {
            const status = statusById[cid]
            if (!status) return null
            return (
              <Column
                key={cid}
                status={status}
                taskIds={containers[cid] ?? []}
                tasksById={tasksById}
                onTaskClick={onTaskClick}
              />
            )
          })}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeColumn ? (
          <div className="flex w-72 items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 shadow-lg">
            <ColumnHeader
              status={activeColumn}
              count={containers[activeColumn.id]?.length ?? 0}
            />
          </div>
        ) : activeTask ? (
          <TaskCard task={activeTask} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
