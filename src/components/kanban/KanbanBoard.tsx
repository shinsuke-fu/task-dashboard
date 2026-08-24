/**
 * src/components/kanban/KanbanBoard.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   「タスク一覧」ビュー本体。todo/doing/review/done の4カラムに
 *   タスクをドラッグ＆ドロップで移動できるカンバンボード。
 *
 * 【主な処理】
 *   1. tasksを共通フィルター（filterTasks）で担当者・カテゴリ・優先度を絞り込み、
 *      さらにcolumn.id（ステータス）ごとに振り分けて表示
 *   2. ドラッグ＆ドロップでのステータス変更を処理。
 *      review → doing への移動だけは特別扱いし、差し戻し理由モーダルを起動する。
 *      また、review状態からの移動（差し戻し・承認完了に相当）は、TaskCard.tsxの
 *      ボタンと同じく確認者（reviewerId）本人にしか許可しない
 *      （ドラッグ＆ドロップがボタンの権限チェックを迂回する抜け道にならないようにする）
 * -----------------------------------------------------------------------
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

  // 既存の完全リアルタイムフィルタリングロジック（共通ユーティリティに一本化）
  const displayTasks = useMemo(
    () => filterTasks(tasks, filterUser, filterCategory, filterPriority),
    [tasks, filterUser, filterCategory, filterPriority]
  );

  // ドロップ時のハンドラー：review→doingの移動だけ差し戻しモーダル経由にし、それ以外は即時ステータス変更
  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setActiveColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const draggedTask = tasks.find(t => t.id === taskId);
    if (!draggedTask) return;

    // review状態からの移動（差し戻し・承認完了に相当）は確認者本人のみ許可。
    // ボタンでの操作と権限ルールを揃え、ドラッグ＆ドロップが抜け道にならないようにする
    if (draggedTask.status === 'review' && targetStatus !== 'review' && draggedTask.reviewerId !== currentUserId) {
      alert('このタスクは確認者のみ操作できます。');
      return;
    }

    if (draggedTask.status === 'review' && targetStatus === 'doing') {
      onTriggerReject(taskId); // 差し戻しモーダルを起動
    } else {
      onUpdateStatus(taskId, targetStatus); // 通常の移動
    }
  };

  return (
    <div className="flex md:grid md:grid-cols-4 gap-4 overflow-x-auto pb-4 md:overflow-visible select-none">
      {columns.map((column) => {
        const filteredTasks = displayTasks.filter((task) => task.status === column.id);
        const isHovered = activeColumn === column.id;

        return (
          <div 
            key={column.id} 
            onDragOver={(e) => { e.preventDefault(); setActiveColumn(column.id); }}
            onDragLeave={() => setActiveColumn(null)}
            onDrop={(e) => handleDrop(e, column.id)}
            className={`w-[290px] md:w-auto flex-shrink-0 bg-surface backdrop-blur-md rounded-2xl border p-4 flex flex-col min-h-[550px] transition-all duration-200 ${
              isHovered ? 'border-accent bg-accent/5 scale-[1.01]' : 'border-border-card'
            }`}
          >
            {/* カラムヘッダー */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border-card/60">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${column.dotBg}`} />
                <h3 className="font-extrabold text-xs tracking-wider text-text-main">{column.title}</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-card text-text-sub">{filteredTasks.length}</span>
            </div>

            {/* カードリスト */}
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
