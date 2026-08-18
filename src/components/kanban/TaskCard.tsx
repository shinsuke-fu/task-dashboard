/**
 * src/components/kanban/TaskCard.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   カンバンの各カラムに並ぶタスク1件分のカード。ドラッグ操作の起点で
 *   あり、期日に応じた強調表示（遅延／期日間近）や、ステータスに応じた
 *   アクションボタン（承認申請／差し戻し／承認完了／削除）を提供する。
 *
 * 【主な処理】
 *   1. 期日と今日の差分から isOverdue（遅延）／isUrgent（期日間近）を判定
 *   2. 規約③「遅延最優先ルール」に従い、遅延 > 期日間近 > 差し戻し中の
 *      優先順位で枠線・背景スタイルを決定（他状態のUIで上書きしない）
 *   3. ステータスに応じたアクションボタンを出し分け
 *      （doing→承認申請 / review→差し戻し・承認完了 / 常に削除）
 * -----------------------------------------------------------------------
 */
import React from 'react';
import type { Task } from '../../types/task';

interface TaskCardProps {
  task: Task;
  onStartEdit: (task: Task) => void;
  onProcessAction: (id: string, action: 'apply' | 'approve' | 'reject', reason?: string) => void;
  onTriggerReject: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onStartEdit,
  onProcessAction,
  onTriggerReject,
  onDeleteTask,
}) => {
  // --- 完了(done)以外は、承認待ち(review)であっても期日超過なら一律で遅延判定に変えます ---
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 今日の始まり
  
  const targetDate = new Date(task.endDate);
  targetDate.setHours(0, 0, 0, 0); // 期日の始まり
  
  // 端数の出ない純粋なミリ秒差分から、残り日数を正確に計算
  const diffDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // status !== 'done' の条件を最優先に据え、review状態のタスクも期日を過ぎていれば確実に遅延にします
  const isOverdue = diffDays < 0 && task.status !== 'done';
  const isUrgent = diffDays >= 0 && diffDays <= 3 && task.status !== 'done';
  
  // 差し戻しは「進行中(doing)かつ理由があるとき」のみ（遅延していない場合のみ適用、または遅延を最優先にするため、以下でスタイル順序を制御）
  const isRejected = task.status === 'doing' && task.returnReason;

  // ---  条件に応じたマットダーク用境界線＆影スタイル ---
  let borderStyleClass = 'border-border-card hover:border-accent/40';
  let pulseAnimationClass = '';

  //  遅延（isOverdue）を一番上に持ってくることで、承認待ちや差し戻し状態よりも「遅延赤枠」を最優先で適用させます
  if (isOverdue) {
    borderStyleClass = 'border-rose-600/80 shadow-[0_0_12px_rgba(225,29,72,0.1)] bg-rose-950/5'; // ほんのり赤背景を混ぜて危険度を統一
  } else if (isUrgent) {
    borderStyleClass = 'border-amber-500/80 shadow-[0_0_14px_rgba(245,158,11,0.25)]';
    pulseAnimationClass = 'animate-pulse';
  } else if (isRejected) {
    borderStyleClass = 'border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.05)]';
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      onClick={() => onStartEdit(task)}
      className={`bg-card rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-150 group cursor-grab active:cursor-grabbing border ${borderStyleClass}`}
    >
      {/* タスクカード上部行：カテゴリ ＆ アラートバッジ */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded bg-base text-text-sub border border-border-card">
          {task.category}
        </span>
        
        <div className="flex items-center gap-1.5">
          {/* カスタムラインSVGアラート */}
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
            {task.priority?.toUpperCase()}
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

      {/* 差し戻し理由 */}
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
              <button 
                onClick={() => onTriggerReject(task.id)} 
                className="px-2 py-0.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white font-bold rounded text-[9px] cursor-pointer transition"
              >
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
};
