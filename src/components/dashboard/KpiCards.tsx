/**
 * src/components/dashboard/KpiCards.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   ダッシュボード上部に並ぶ4枚のKPIカード（完了率／進捗／査読待ち／
 *   期限超過）を表示する。数値の集計のみを行い、状態は持たない。
 *
 * 【主な処理】
 *   1. filteredTasks（絞り込み後）から完了率・査読待ち件数などを算出
 *   2. JST基準の本日日付と比較し、期限超過（overdue）件数を算出
 * -----------------------------------------------------------------------
 */
import React from 'react';
import type { Task } from '../../types/task';

interface KpiCardsProps {
  filteredTasks: Task[];
  totalTasksCount: number; // フィルター変化に関わらず分母を一定に保つための総数
}

export const KpiCards: React.FC<KpiCardsProps> = ({ filteredTasks, totalTasksCount }) => {
  const currentTotal = filteredTasks.length;
  const doneCount = filteredTasks.filter(t => t.status === 'done').length;
  const reviewCount = filteredTasks.filter(t => t.status === 'review').length;
  const completionRate = currentTotal > 0 ? Math.round((doneCount / currentTotal) * 100) : 0;

  // 厳密な日本時間（JST）ベースの本日日付文字列
  const todayStr = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  // 完了以外・期日ありのタスクのうち、本日より過去の期日を持つものを「期限超過」としてカウント
  const overdueCount = filteredTasks.filter(t => t.status !== 'done' && t.endDate && t.endDate < todayStr).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
      
      {/* 1. 全体の完了率 */}
      <div className="bg-card border border-border-card rounded-xl p-4.5 flex items-center justify-between shadow-xs">
        <div className="space-y-1">
          <p className="text-[11px] text-text-sub font-bold tracking-wider uppercase">完了率</p>
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-black font-mono text-text-main tracking-tight">{completionRate}</span>
            <span className="text-[10px] text-text-sub font-bold">%</span>
          </div>
        </div>
        <div className="w-8.5 h-8.5 rounded-xl bg-accent/5 border border-accent/10 flex items-center justify-center text-accent">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
          </svg>
        </div>
      </div>

      {/* 2. 総タスク / 完了数 */}
      <div className="bg-card border border-border-card rounded-xl p-4.5 flex items-center justify-between shadow-xs">
        <div className="space-y-1">
          <p className="text-[11px] text-text-sub font-bold tracking-wider uppercase">タスク進捗</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-text-main tracking-tight">{doneCount}</span>
            <span className="text-[11px] text-text-sub">/</span>
            <span className="text-sm font-bold font-mono text-text-sub">{currentTotal}</span>
            <span className="text-[9px] text-text-sub ml-0.5">件</span>
          </div>
        </div>
        <div className="w-8.5 h-8.5 rounded-xl bg-accent/5 border border-accent/10 flex items-center justify-center text-accent">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
      </div>

      {/* 3. 査読・承認待ち */}
      <div className="bg-card border border-border-card rounded-xl p-4.5 flex items-center justify-between shadow-xs">
        <div className="space-y-1">
          <p className="text-[11px] text-text-sub font-bold tracking-wider uppercase">査読待ち</p>
          <div className="flex items-baseline gap-0.5">
            <span className={`text-2xl font-black font-mono tracking-tight ${reviewCount > 0 ? 'text-amber-500' : 'text-text-main'}`}>{reviewCount}</span>
            <span className="text-[9px] text-text-sub ml-0.5">件</span>
          </div>
        </div>
        <div className={`w-8.5 h-8.5 rounded-xl border flex items-center justify-center ${reviewCount > 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 animate-pulse' : 'bg-border-card/50 border-border-card text-text-sub'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
      </div>

      {/* 4. 期限超過アラート */}
      <div className="bg-card border border-border-card rounded-xl p-4.5 flex items-center justify-between shadow-xs">
        <div className="space-y-1">
          <p className="text-[11px] text-text-sub font-bold tracking-wider uppercase">期限超過</p>
          <div className="flex items-baseline gap-0.5">
            <span className={`text-2xl font-black font-mono tracking-tight ${overdueCount > 0 ? 'text-rose-500' : 'text-text-main'}`}>{overdueCount}</span>
            <span className="text-[9px] text-text-sub ml-0.5">件</span>
          </div>
        </div>
        <div className={`w-8.5 h-8.5 rounded-xl border flex items-center justify-center ${overdueCount > 0 ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-border-card/50 border-border-card text-text-sub'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
      </div>

    </div>
  );
};
