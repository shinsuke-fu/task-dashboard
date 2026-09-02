/**
 * src/components/kanban/KanbanBoard.tsx
 * 「タスク一覧」ビュー本体。todo/doing/review/doneの4カラムにタスクをドラッグ＆
 * ドロップで移動できるカンバンボード。review状態からの移動はTaskCard.tsxのボタンと
 * 同じく確認者本人のみ許可する（D&Dが権限チェックの抜け道にならないようにする）。
 */
import { useState, useMemo } from 'react';
import type { Task, TaskStatus } from '../../types/task';
import { TaskCard } from './TaskCard';
import { filterTasks } from '../../utils/assignee';

interface KanbanBoardProps {
  tasks: Task[];
  currentUserId: string;
  filterUser: string;
  filterCategory: string;
  filterPriority: string;
  onUpdateStatus: (id: string, newStatus: TaskStatus) => void;
  onProcessAction: (id: string, action: 'apply' | 'approve' | 'reject', reason?: string) => void;
  onTriggerReject: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onStartEdit: (task: Task) => void;
}

export default function KanbanBoard({
  tasks,
  currentUserId,
  filterUser,
  filterCategory,
  filterPriority,
  onUpdateStatus,
  onProcessAction,
  onTriggerReject,
  onDeleteTask,
  onStartEdit
}: KanbanBoardProps) {
  const [activeColumn, setActiveColumn] = useState<TaskStatus | null>(null);

  const columns: { id: TaskStatus; title: string; dotBg: string }[] = [
    { id: 'todo', title: '未着手', dotBg: 'bg-text-sub/40' },
    { id: 'doing', title: '進行中', dotBg: 'bg-accent' },
    { id: 'review', title: '査読・承認待ち', dotBg: 'bg-amber-400' },
    { id: 'done', title: '完了', dotBg: 'bg-emerald-500' },
  ];

  const displayTasks = useMemo(
    () => filterTasks(tasks, filterUser, filterCategory, filterPriority),
    [tasks, filterUser, filterCategory, filterPriority]
  );

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setActiveColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const draggedTask = tasks.find(t => t.id === taskId);
    if (!draggedTask) return;

    if (draggedTask.status === 'review' && targetStatus !== 'review' && draggedTask.reviewerId !== currentUserId) {
      alert('このタスクは確認者のみ操作できます。');
      return;
    }

    if (draggedTask.status === 'review' && targetStatus === 'doing') {
      onTriggerReject(taskId);
    } else {
      onUpdateStatus(taskId, targetStatus);
    }
  };

  return (
    // `@min-[1040px]:`はコンテナクエリ（App.tsxの<main>の`@container`基準）で、実際に
    // このボードへ残っている横幅で判定する。ビューポート幅（md:）だと、サイドバーが
    // 開いていて実際の残り幅が狭いときにカラムが崩れるため使わない
    <div className="flex @min-[1040px]:grid @min-[1040px]:grid-cols-4 gap-4 overflow-x-auto pb-4 @min-[1040px]:overflow-visible select-none">
      {columns.map((column) => {
        const filteredTasks = displayTasks.filter((task) => task.status === column.id);
        const isHovered = activeColumn === column.id;

        return (
          <div
            key={column.id}
            onDragOver={(e) => { e.preventDefault(); setActiveColumn(column.id); }}
            onDragLeave={() => setActiveColumn(null)}
            onDrop={(e) => handleDrop(e, column.id)}
            className={`w-[290px] @min-[1040px]:w-auto flex-shrink-0 bg-surface backdrop-blur-md rounded-2xl border p-4 flex flex-col min-h-[550px] transition-all duration-200 ${
              isHovered ? 'border-accent bg-accent/5 scale-[1.01]' : 'border-border-card'
            }`}
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border-card/60">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${column.dotBg}`} />
                <h3 className="font-extrabold text-xs tracking-wider text-text-main">{column.title}</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-card text-text-sub">{filteredTasks.length}</span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {filteredTasks.length === 0 ? (
                <div className="h-28 border border-dashed border-border-card rounded-xl flex items-center justify-center text-xs text-text-sub font-medium tracking-wider">
                  ここにタスクをドロップ
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentUserId={currentUserId}
                    onStartEdit={onStartEdit}
                    onUpdateStatus={onUpdateStatus}
                    onProcessAction={onProcessAction}
                    onTriggerReject={onTriggerReject}
                    onDeleteTask={onDeleteTask}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
