import { useState, useMemo } from 'react'; // 💡 useMemo を追加
import type { Task, TaskStatus } from '../types/task';

interface KanbanBoardProps {
  tasks: Task[]; // 大元の生のタスク配列が直接届きます
  filterUser: string; // 💡 追加
  filterCategory: string; // 💡 追加
  onUpdateStatus: (id: string, newStatus: TaskStatus) => void;
  onProcessAction: (id: string, action: 'apply' | 'approve' | 'reject', reason?: string) => void;
  onDeleteTask: (id: string) => void;
  onStartEdit: (task: Task) => void;
}

export default function KanbanBoard({ 
  tasks, 
  filterUser, 
  filterCategory, 
  onUpdateStatus, 
  onProcessAction, 
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

  // 💡 【デグレ完全撲滅】親から届いた生の tasks とフィルター条件から、ここで最新のコピーをリアルタイムに評価生成します
  const displayTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.assignees) return filterUser === 'all';
      
      const matchesUser = filterUser === 'all' || task.assignees.some(a => {
        if (a === filterUser) return true; // IDマッチ ('u1' === 'u1')
        if (filterUser === 'u1' && a === '自分（作業者）') return true;
        if (filterUser === 'u2' && a === '山田（開発）') return true;
        if (filterUser === 'u3' && a === '佐藤（上司・レビュアー）') return true;
        return false;
      });

      const matchesCategory = filterCategory === 'all' || task.category === filterCategory;
      return matchesUser && matchesCategory;
    });
  }, [tasks, filterUser, filterCategory]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setActiveColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onUpdateStatus(taskId, targetStatus);
    }
  };

  return (
    <div className="flex md:grid md:grid-cols-4 gap-4 overflow-x-auto pb-4 md:overflow-visible select-none">
      {columns.map((column) => {
        // 💡 フィルタリング済みの displayTasks から、各列のステータスに合うものを抽出
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
                filteredTasks.map((task) => {
                  // --- 💡 【フェーズ3】デッドライン自動検知（2026年8月10日 JST基準） ---
                  const CURRENT_DATE_STR = '2026-08-10';
                  const currentTimestamp = new Date(CURRENT_DATE_STR).getTime();
                  const targetTimestamp = new Date(task.endDate).getTime();
                  
                  // 不要な計算のブレを無くした、元の安定した Math.ceil 切り上げ計算
                  const diffDays = Math.ceil((targetTimestamp - currentTimestamp) / (1000 * 60 * 60 * 24));

                  const isOverdue = diffDays < 0 && task.status !== 'done';
                  const isUrgent = diffDays >= 0 && diffDays <= 3 && task.status !== 'done';
                  const isRejected = task.status === 'doing' && task.returnReason;

                  // --- 🎨 条件に応じたマットダーク用境界線＆影スタイル ---
                  let borderStyleClass = 'border-border-card hover:border-accent/40';
                  let pulseAnimationClass = '';

                  if (isRejected) {
                    borderStyleClass = 'border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.05)]';
                  } else if (isOverdue) {
                    borderStyleClass = 'border-rose-600/80 shadow-[0_0_12px_rgba(225,29,72,0.1)]';
                  } else if (isUrgent) {
                    borderStyleClass = 'border-amber-500/80 shadow-[0_0_14px_rgba(245,158,11,0.25)]';
                    pulseAnimationClass = 'animate-pulse';
                  }

                  return (
                    <div 
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => onStartEdit(task)}
                      className={`bg-card rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-150 group cursor-grab active:cursor-grabbing border ${borderStyleClass}`}
                    >
                      {/* タスクカード上部行：カテゴリ ＆ アラートバッジ */}
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-base text-text-sub border border-border-card">
                          {task.category}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          {/* 🌟 絵文字を完全撤去した極細カスタムラインSVGアラート */}
                          {isUrgent && (
                            <span className="flex items-center gap-1 text-amber-400 text-[9px] font-extrabold tracking-wider bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              <svg className={`w-2.5 h-2.5 stroke-[2.5] ${pulseAnimationClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              残り {diffDays} 日
                            </span>
                          )}
                          {isOverdue && (
                            <span className="flex items-center gap-1 text-rose-400 text-[9px] font-extrabold tracking-wider bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                              <svg className="w-2.5 h-2.5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              遅延
                            </span>
                          )}
                          <span className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded ${task.priority === 'high' ? 'bg-rose-500/10 text-rose-400' : 'bg-text-sub/10 text-text-sub'}`}>
                            {task.priority.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* タスクタイトル ＆ ディスクリプション */}
                      <h4 className="font-bold text-xs text-text-main group-hover:text-accent transition-colors leading-snug">
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-[11px] text-text-sub mt-1.5 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      {/* 差し戻し理由（⚠️絵文字を美しいSVGアイコンに置換） */}
                      {isRejected && (
                        <div className="mt-2.5 p-2 bg-rose-500/5 rounded-lg border border-rose-500/10 text-[10px] text-rose-400 font-medium leading-relaxed flex items-start gap-1.5">
                          <svg className="w-3 h-3 text-rose-400 flex-shrink-0 mt-0.5 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>差し戻し理由: {task.returnReason}</span>
                        </div>
                      )}

                      {/* アクションエリア */}
                      <div className="mt-4 pt-2 border-t border-border-card/40 flex justify-between items-center text-[10px]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 text-text-sub font-mono">
                          <svg className="w-3 h-3 stroke-[1.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{task.endDate}</span>
                        </div>
                        
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
