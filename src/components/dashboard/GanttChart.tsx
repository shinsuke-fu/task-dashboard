/**
 * src/components/dashboard/GanttChart.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   ダッシュボード下部の「直近の締切」タイムラインテーブル。
 *   今日を中心に前後1週間分のマス目を描画し、期日が近い/超過している
 *   タスクを可視化する。
 *
 * 【主な処理】
 *   1. getTimelineDays … 今日を基準に「2日前〜4日後」7日分のマス目情報を生成
 *   2. getAssigneeNames … タスクの担当者IDを表示名に変換（共通ユーティリティ利用）
 *   3. activeTasks … 完了以外・期日ありのタスクから、期日が近い順に最大5件抽出
 *   4. 各タスク行で、期日超過（isOverdue）を最優先バッジとして表示
 *      （規約③：遅延最優先ルールに準拠。他状態のUIで上書きしない）
 * -----------------------------------------------------------------------
 */
import React from 'react';
import type { Task, User } from '../../types/task';
import { resolveAssigneeName } from '../../utils/assignee';
import { getTodayJstDateString } from '../../utils/date';

interface GanttChartProps {
  tasks: Task[];
  users: User[];
}

export const GanttChart: React.FC<GanttChartProps> = ({ tasks, users }) => {

  // 今日（JST基準）を基準に、2日前〜4日後の合計7日分のマス目情報を生成する
  const getTimelineDays = () => {
    const days = [];
    // 「今日」はブラウザのローカル時刻ではなく、src/utils/date.ts の共通関数（JST基準）から取得する。
    // TaskCard.tsx・KpiCards.tsx・TaskForm.tsx・ScheduleView.tsxと同じ基準に統一することで、
    // 実行環境のタイムゾーンによって「今日」がズレる可能性を排除する
    const [ty, tm, td] = getTodayJstDateString().split('-').map(Number);
    const today = new Date(ty, tm - 1, td); // カレンダー上の「今日」（時刻は00:00固定）

    // 今日から2日前を左端の起点にする
    const startTimelineDate = new Date(today.getTime());
    startTimelineDate.setDate(today.getDate() - 2);
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(startTimelineDate.getTime());
      d.setDate(startTimelineDate.getDate() + i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${date}`;
      
      days.push({
        dateStr,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        dayOfWeek: ['日', '月', '火', '水', '木', '金', '土'][d.getDay()],
        isToday: i === 2, // 常に3番目のマス（今日）がハイライトされる
        isWeekend: d.getDay() === 0 || d.getDay() === 6
      });
    }
    return days;
  };

  const timeline = getTimelineDays();

  // 「今日」の文字列（JST基準）。期日超過（isOverdue）の判定に使うため、
  // 他コンポーネントと同じ基準関数を使い、判定のズレを防ぐ
  const todayStr = getTodayJstDateString();

  const getAssigneeNames = (taskAssignees: string[]) => {
    if (!taskAssignees) return '未割り当て';
    return taskAssignees.map(assigneeStr => resolveAssigneeName(assigneeStr, users)).join(', ');
  };

  // 親から届いた tasks から「完了以外かつ期日あり」の直近5件をソート抽出
  const activeTasks = tasks
    .filter(t => t.endDate && t.status !== 'done')
    .sort((a, b) => a.endDate.localeCompare(b.endDate))
    .slice(0, 5);

  return (
    <div className="bg-card border border-border-card rounded-xl p-5 md:p-6 shadow-xs overflow-hidden">
      
      {/* セクションタイトル：極細カスタムSVGラインアイコン */}
      <h3 className="text-xs font-bold text-text-sub uppercase tracking-widest mb-6 flex items-center gap-2">
        <svg className="w-3.5 h-3.5 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
        締切・タイムライン
      </h3>

      {/* 横スクロールバー常時出現バグを完全駆逐したレスポンシブコンテナ */}
      <div className="overflow-x-auto md:overflow-x-auto -mx-5 px-5 md:-mx-6 md:px-6">
        <div className="min-w-[720px] space-y-2">
          
          {/* グリッドヘッダー */}
          <div className="grid grid-cols-12 items-center text-[11px] font-bold text-text-sub border-b border-surface/60 pb-3 select-none">
            <div className="col-span-5 tracking-wider uppercase">タスク一覧</div>
            <div className="col-span-7 grid grid-cols-7 text-center font-mono">
              {timeline.map(day => (
                <div 
                  key={day.dateStr} 
                  className={`py-1 rounded-md transition-colors ${
                    day.isToday 
                      ? 'bg-accent/15 text-accent font-black ring-1 ring-accent/20' 
                      : day.isWeekend 
                        ? 'bg-surface/30 text-text-sub/70' 
                        : 'text-text-sub'
                  }`}
                >
                  <div className="text-[10px] tracking-tight">{day.label}</div>
                  <div className="text-[9px] opacity-70 font-sans mt-0.5">{day.dayOfWeek}</div>
                </div>
              ))}
            </div>
          </div>

          {/* タスク行リスト */}
          {activeTasks.length === 0 ? (
            <div className="text-center py-12 bg-surface/10 rounded-xl border border-dashed border-border-card/40 my-2">
              <p className="text-xs text-text-sub font-medium tracking-wide">直近1週間に締切のある未完了タスクはありません</p>
            </div>
          ) : (
            <div className="divide-y divide-surface/40 max-h-[260px] overflow-y-auto overflow-x-hidden pr-1 scrollbar-none">
              {activeTasks.map(task => {
                const assigneeText = getAssigneeNames(task.assignees);

                return (
                  <div key={task.id} className="grid grid-cols-12 items-center py-3 text-xs hover:bg-surface/20 transition-colors rounded-lg px-2 -mx-2">
                    
                    {/* 左5列：タスク名とアサイン */}
                    <div className="col-span-5 pr-4 truncate">
                      <div className="font-bold text-text-main truncate text-xs tracking-wide" title={task.title}>
                        {task.title}
                      </div>
                      <div className="text-[10px] text-text-sub truncate font-medium mt-1 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-border-card" />
                        {assigneeText}
                      </div>
                    </div>

                    {/* 右7列：スライド対応スケジュールマトリクス */}
                    <div className="col-span-7 grid grid-cols-7 h-6 relative items-center font-mono">
                      {timeline.map((day, idx) => {
                        const isDeadline = task.endDate === day.dateStr;
                        const isPastTimelineStart = idx === 0 && task.endDate < day.dateStr;
                        const isOverdue = task.endDate < todayStr;
                        const shouldShow = isDeadline || isPastTimelineStart;

                        return (
                          <div key={day.dateStr} className={`h-full border-r border-surface/30 last:border-r-0 flex items-center justify-center relative ${day.isWeekend ? 'bg-surface/10' : ''}`}>
                            {shouldShow && (
                              <div
                                className={`absolute inset-x-1.5 h-4.5 rounded-md flex items-center justify-center text-[9px] font-black tracking-wider shadow-xs border transition-all animate-fade-in
                                  ${isOverdue
                                    ? 'bg-rose-500 border-rose-600/30 animate-pulse text-white'
                                    : task.status === 'review'
                                      ? 'bg-amber-500 border-amber-600/30 text-slate-950'
                                      : 'bg-accent border-accent/30 text-on-accent'
                                  }
                                `}
                                title={`${task.title} | 締切: ${task.endDate}`}
                              >
                                {isOverdue ? '遅延' : '締切'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
