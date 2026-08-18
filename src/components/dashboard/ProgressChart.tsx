/**
 * src/components/dashboard/ProgressChart.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   ダッシュボード中段の2枚組グラフ。左側はステータス別の積層バー、
 *   右側はメンバーごとのタスク負荷（担当件数）を表示する。
 *
 * 【主な処理】
 *   1. ステータス（todo/doing/review/done）別の件数・比率を集計
 *   2. 担当者ごとの件数を集計（担当者名の解決は共通ユーティリティを利用）
 * -----------------------------------------------------------------------
 */
import React from 'react';
import type { Task, User } from '../../types/task';
import { resolveAssigneeName } from '../../utils/assignee';

interface ProgressChartProps {
  tasks: Task[];
  users: User[];
}

export const ProgressChart: React.FC<ProgressChartProps> = ({ tasks, users }) => {
  const total = tasks.length;

  // 1. ステータス別の正確な集計
  const counts = {
    todo: tasks.filter(t => t.status === 'todo').length,
    doing: tasks.filter(t => t.status === 'doing').length,
    review: tasks.filter(t => t.status === 'review').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  const getPct = (count: number) => (total > 0 ? (count / total) * 100 : 0);

  // 2. 不具合修正：新規作成からのデータ（u1などID表記）も100%確実に名前で集計・連動するロジック
  const assigneeMap: Record<string, number> = {};
  
  // 事前に全員のカウントを0で初期化（空アサインを避けてバランスを一定に保つ）
  users.forEach(u => { assigneeMap[u.name] = 0; });

  tasks.forEach(task => {
    if (!task.assignees) return;
    task.assignees.forEach(assigneeStr => {
      // 割り当て文字列がID（例: u1）か名前（例: 山田）かを判定し、常に「表示用の名前」へ統合する
      const displayName = resolveAssigneeName(assigneeStr, users);
      assigneeMap[displayName] = (assigneeMap[displayName] || 0) + 1;
    });
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
      
      {/* ＝ 左側：ステータス配分（積層バー） ＝ */}
      <div className="bg-card border border-border-card rounded-xl p-5 md:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-bold text-text-sub uppercase tracking-widest mb-5 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
            </svg>
            Task Distribution
          </h3>

          {/* ピクセルバランスを整えた美しいシームレス積層バー */}
          <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-surface border border-border-card/30 mb-6">
            <div style={{ width: `${getPct(counts.todo)}%` }} className="bg-text-sub/20 transition-all duration-300" />
            <div style={{ width: `${getPct(counts.doing)}%` }} className="bg-accent transition-all duration-300" />
            <div style={{ width: `${getPct(counts.review)}%` }} className="bg-amber-500/60 transition-all duration-300" />
            <div style={{ width: `${getPct(counts.done)}%` }} className="bg-emerald-600/60 transition-all duration-300" />
          </div>
        </div>

        {/* 凡例および数値・単位の完璧なマージン整列 */}
        <div className="space-y-3">
          {[
            { label: '未着手 (TODO)', count: counts.todo, color: 'bg-text-sub/20' },
            { label: '進行中 (DOING)', count: counts.doing, color: 'bg-accent' },
            { label: '査読待ち (REVIEW)', count: counts.review, color: 'bg-amber-500/60' },
            { label: '完了 (DONE)', count: counts.done, color: 'bg-emerald-600/60' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between border-b border-surface/40 pb-2 last:border-0 last:pb-0">
              <div className="flex items-center gap-2.5 text-xs text-text-sub">
                <span className={`w-2.5 h-2.5 rounded-xs ${item.color} flex-shrink-0`} />
                <span className="font-medium tracking-wide">{item.label}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-xs font-black text-text-main">{item.count}</span>
                <span className="text-[10px] text-text-sub">件</span>
                <span className="text-[10px] text-text-sub font-mono ml-1">({getPct(item.count).toFixed(0)}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ＝ 右側：メンバーごとの負荷状況 ＝ */}
      <div className="bg-card border border-border-card rounded-xl p-5 md:p-6 shadow-xs flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-bold text-text-sub uppercase tracking-widest mb-5 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            Team Workload
          </h3>
        </div>

        {/* メンバー負荷をインジケーターバーで美しく均等整列 */}
        <div className="space-y-4 max-h-[190px] overflow-y-auto pr-1">
          {Object.entries(assigneeMap).map(([name, count]) => {
            const maxTasks = Math.max(...Object.values(assigneeMap), 1);
            const barWidth = (count / maxTasks) * 100;
            return (
              <div key={name} className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-text-main font-bold tracking-wide">{name}</span>
                  <div className="flex items-baseline gap-0.5 font-mono">
                    <span className="text-xs font-black text-accent">{count}</span>
                    <span className="text-[10px] text-text-sub">tasks</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-surface border border-border-card/20 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${barWidth}%` }} 
                    className="h-full bg-accent/80 rounded-full transition-all duration-500 origin-left" 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
