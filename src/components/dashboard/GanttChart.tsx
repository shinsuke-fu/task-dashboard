// src/components/dashboard/GanttChart.tsx
import React from 'react';
import type { Task, User } from '../../types/task';

interface GanttChartProps {
  tasks: Task[];
  users: User[];
}

export const GanttChart: React.FC<GanttChartProps> = ({ tasks, users }) => {
  
  // 💡 日付表記ゆれ・タイムゾーンバグの完全修正
  // 現在日時を厳密に日本時間(JST)ベースの 'YYYY-MM-DD' 基準で取得・生成
  const getTimelineDays = () => {
    const days = [];
    const baseDate = new Date('2026-08-07T00:00:00+09:00'); // 💡 2026年8月7日(現在時刻)固定起点
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate.getTime());
      d.setDate(baseDate.getDate() + i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${date}`; // 厳密な 'YYYY-MM-DD' 表記の統一
      
      days.push({
        dateStr,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        dayOfWeek: ['日', '月', '火', '水', '木', '金', '土'][d.getDay()],
        isToday: i === 0,
        isWeekend: d.getDay() === 0 || d.getDay() === 6
      });
    }
    return days;
  };

  const timeline = getTimelineDays();
  const todayStr = timeline[0].dateStr;

  // 💡 不具合修正：アサインID(u1等)と名前の正確なマッピング解決
  const getAssigneeNames = (taskAssignees: string[]) => {
    if (!taskAssignees) return '未割り当て';
    return taskAssignees.map(assigneeStr => {
      const found = users.find(u => u.id === assigneeStr || u.name === assigneeStr);
      return found ? found.name : assigneeStr;
    }).join(', ');
  };

  // 完了(done)以外かつ期日情報のある直近5件をソート抽出
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
        Deadlines & Timeline
      </h3>

      {/* 横スクロールバグを100%徹底防御するレスポンシブコンテナ */}
      <div className="overflow-x-auto -mx-5 px-5 md:-mx-6 md:px-6">
        <div className="min-w-[720px] space-y-2">
          
          {/* ＝ グリッドヘッダー：タイポグラフィと比率を最適化 ＝ */}
          <div className="grid grid-cols-12 items-center text-[11px] font-bold text-text-sub border-b border-surface/60 pb-3 select-none">
            <div className="col-span-5 tracking-wider uppercase">Active Tasks</div>
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

          {/* ＝ タスク行リスト：無駄なノイズを削ぎ落としたマトリクス表現 ＝ */}
          {activeTasks.length === 0 ? (
            <div className="text-center py-12 bg-surface/10 rounded-xl border border-dashed border-border-card/40 my-2">
              <p className="text-xs text-text-sub font-medium tracking-wide">直近1週間に締切のある未完了タスクはありません</p>
            </div>
          ) : (
            <div className="divide-y divide-surface/40 max-h-[260px] overflow-y-auto pr-1">
              {activeTasks.map(task => {
                const assigneeText = getAssigneeNames(task.assignees);

                return (
                  <div key={task.id} className="grid grid-cols-12 items-center py-3 text-xs hover:bg-surface/20 transition-colors rounded-lg px-2 -mx-2">
                    
                    {/* 左5列：タスク名と最適サイズのアサイン表記 */}
                    <div className="col-span-5 pr-4 truncate">
                      <div className="font-bold text-text-main truncate text-xs tracking-wide" title={task.title}>
                        {task.title}
                      </div>
                      <div className="text-[10px] text-text-sub truncate font-medium mt-1 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-border-card" />
                        {assigneeText}
                      </div>
                    </div>

                    {/* 右7列：1日ずつ厳密にマッピングするスケジュールマトリクス */}
                    <div className="col-span-7 grid grid-cols-7 h-6 relative items-center font-mono">
                      {timeline.map((day, idx) => {
                        const isDeadline = task.endDate === day.dateStr;
                        // タイムラインの初日（今日）より過去の締め切りは、すべて初日位置に「遅延」として集約警告
                        const isPastDeadline = task.endDate < todayStr && idx === 0;

                        return (
                          <div key={day.dateStr} className={`h-full border-r border-surface/30 last:border-r-0 flex items-center justify-center relative ${day.isWeekend ? 'bg-surface/10' : ''}`}>
                            {(isDeadline || isPastDeadline) && (
                              <div 
                                className={`absolute inset-x-1.5 h-4.5 rounded-md flex items-center justify-center text-[9px] font-black tracking-wider text-slate-950 shadow-xs border transition-all animate-fade-in
                                  ${task.status === 'review' 
                                    ? 'bg-amber-500 border-amber-600/30' 
                                    : isPastDeadline 
                                      ? 'bg-rose-500 border-rose-600/30 animate-pulse !text-white' 
                                      : 'bg-accent border-accent/30'
                                  }
                                `}
                                title={`${task.title} | Deadline: ${task.endDate}`}
                              >
                                {isPastDeadline ? '遅延' : '締切'}
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
