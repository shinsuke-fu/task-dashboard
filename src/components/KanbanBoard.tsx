import { useState, useMemo } from 'react';
import type { Task, TaskStatus } from '../types/task';
import { TaskCard } from './TaskCard'; // 💡 新設したカードを統合

interface KanbanBoardProps {
  tasks: Task[];
  filterUser: string;
  filterCategory: string;
  onUpdateStatus: (id: string, newStatus: TaskStatus) => void;
  onProcessAction: (id: string, action: 'apply' | 'approve' | 'reject', reason?: string) => void;
  onTriggerReject: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onStartEdit: (task: Task) => void;
}

export default function KanbanBoard({ 
  tasks, 
  filterUser, 
  filterCategory, 
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

  // 💡 既存の完全リアルタイムフィルタリングロジック（そのまま完全死守）
  const displayTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.assignees) return filterUser === 'all';
      
      const matchesUser = filterUser === 'all' || task.assignees.some(a => {
        if (a === filterUser) return true;
        if (filterUser === 'u1' && a === '自分（作業者）') return true;
        if (filterUser === 'u2' && a === '山田（開発）') return true;
        if (filterUser === 'u3' && a === '佐藤（上司・レビュアー）') return true;
        return false;
      });

      const matchesCategory = filterCategory === 'all' || task.category === filterCategory;
      return matchesUser && matchesCategory;
    });
  }, [tasks, filterUser, filterCategory]);

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setActiveColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    // 💥 【書き換え場所】ここから下を、reviewからのドロップ検知ロジックに置き換え
    const draggedTask = tasks.find(t => t.id === taskId);
    
    if (draggedTask && draggedTask.status === 'review' && targetStatus === 'doing') {
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
                    onStartEdit={onStartEdit}
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
