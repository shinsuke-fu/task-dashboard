import { useState } from 'react';
import type { Task, TaskStatus } from '../types/task';

interface KanbanBoardProps {
  tasks: Task[];
  onUpdateStatus: (id: string, newStatus: TaskStatus) => void; // 💡 復活
  onProcessAction: (id: string, action: 'apply' | 'approve' | 'reject', reason?: string) => void;
  onDeleteTask: (id: string) => void;
  onStartEdit: (task: Task) => void;
}

export default function KanbanBoard({ tasks, onUpdateStatus, onProcessAction, onDeleteTask, onStartEdit }: KanbanBoardProps) {
  const [activeColumn, setActiveColumn] = useState<TaskStatus | null>(null);

  const columns: { id: TaskStatus; title: string; dotBg: string }[] = [
    { id: 'todo', title: '未着手', dotBg: 'bg-text-sub/40' },
    { id: 'doing', title: '進行中', dotBg: 'bg-accent' },
    { id: 'review', title: '査読・承認待ち', dotBg: 'bg-amber-400' },
    { id: 'done', title: '完了', dotBg: 'bg-emerald-500' },
  ];

  const getPriorityStyle = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold';
      case 'medium': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold';
      case 'low': return 'bg-text-sub/10 text-text-sub border border-border-card/50';
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 💡 不具合修正：ドラッグ＆ドロップ時はすべての列（TODOへの逆戻り含め）に直感的に100%移動できる
  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setActiveColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onUpdateStatus(taskId, targetStatus); // 自由な移動ロジックに一本化
    }
  };

  return (
    <div className="flex md:grid md:grid-cols-4 gap-4 overflow-x-auto pb-4 md:overflow-visible select-none">
      {columns.map((column) => {
        const filteredTasks = tasks.filter((task) => task.status === column.id);
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
                filteredTasks.map((task) => {
                  const isRejected = task.status === 'doing' && task.returnReason;
                  return (
                    <div 
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => onStartEdit(task)}
                      className={`bg-card rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-150 group cursor-grab active:cursor-grabbing border ${
                        isRejected ? 'border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.05)]' : 'border-border-card hover:border-accent/40'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-base text-text-sub border border-border-card">{task.category}</span>
                        <span className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded ${task.priority === 'high' ? 'bg-rose-500/10 text-rose-400' : 'bg-text-sub/10 text-text-sub'}`}>{task.priority.toUpperCase()}</span>
                      </div>

                      <h4 className="font-bold text-xs text-text-main group-hover:text-accent transition-colors leading-snug">{task.title}</h4>
                      {task.description && <p className="text-[11px] text-text-sub mt-1.5 line-clamp-2">{task.description}</p>}

                      {/* 差し戻し理由 */}
                      {isRejected && (
                        <div className="mt-2.5 p-2 bg-rose-500/5 rounded-lg border border-rose-500/10 text-[10px] text-rose-400 font-medium leading-relaxed">
                          ⚠️ 差し戻し理由: {task.returnReason}
                        </div>
                      )}

                      {/* ボタン操作（ホバーで浮き出る仕様） */}
                      <div className="mt-4 pt-2 border-t border-border-card/40 flex justify-between items-center text-[10px]" onClick={e => e.stopPropagation()}>
                        <span className="text-text-sub font-mono">期日: {task.endDate}</span>
                        
                        <div className="flex gap-1.5">
                          {task.status === 'doing' && (
                            <button onClick={() => onProcessAction(task.id, 'apply')} className="px-2 py-0.5 bg-accent/10 hover:bg-accent text-accent hover:text-slate-950 font-bold rounded text-[9px] cursor-pointer transition">
                              承認申請
                            </button>
                          )}
                          {task.status === 'review' && (
                            <>
                              <button onClick={() => onProcessAction(task.id, 'reject', '内容をもう少し具体的に書いてください。')} className="px-2 py-0.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white font-bold rounded text-[9px] cursor-pointer transition">
                                差し戻し
                              </button>
                              <button onClick={() => onProcessAction(task.id, 'approve')} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-bold rounded text-[9px] cursor-pointer transition">
                                承認完了
                              </button>
                            </>
                          )}
                          <button onClick={() => onDeleteTask(task.id)} className="text-text-sub hover:text-rose-400 px-1 py-0.5 transition opacity-0 group-hover:opacity-100 cursor-pointer">
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
