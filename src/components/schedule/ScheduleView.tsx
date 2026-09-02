/**
 * src/components/schedule/ScheduleView.tsx
 * 「スケジュール」ビュー本体。月間カレンダー形式でタスクの期日を表示し、日本の祝日を
 * 外部API（holidays-jp）から取得してハイライトする。横幅が狭いときはコンテナクエリ
 * （@min-[640px]:。App.tsxの<main>の@container基準）で縦1列のリスト表示に切り替える
 * （サイドバー開閉で実際の残り幅がビューポート幅と乖離するため）。
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { Task } from '../../types/task';
import { filterTasks } from '../../utils/assignee';
import { getTodayJstDateString } from '../../utils/date';

interface ScheduleViewProps {
  tasks: Task[];
  filterUser: string;
  filterCategory: string;
  filterPriority: string;
  onStartEdit: (task: Task) => void;
}

// 祝日API（holidays-jp）のレスポンス形式：{ "2026-01-01": "元日", ... }
type HolidayMap = Record<string, string>;

// 他コンポーネントと表記を揃えるためのYYYY-MM-DD変換ヘルパー
const toDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export const ScheduleView: React.FC<ScheduleViewProps> = ({ tasks, filterUser, filterCategory, filterPriority, onStartEdit }) => {
  // 表示中の年月（常に「その月の1日」を保持する）
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [holidays, setHolidays] = useState<HolidayMap>({});
  const [holidayStatus, setHolidayStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  // 祝日は年によらず変わらないデータなので、マウント時に1回だけ取得して使い回す
  useEffect(() => {
    let cancelled = false;
    fetch('https://holidays-jp.github.io/api/v1/date.json')
      .then((res) => {
        if (!res.ok) throw new Error('祝日データの取得に失敗しました');
        return res.json();
      })
      .then((data: HolidayMap) => {
        if (!cancelled) {
          setHolidays(data);
          setHolidayStatus('ok');
        }
      })
      .catch(() => {
        // 祝日が取れなくてもカレンダー自体の表示は止めない
        if (!cancelled) setHolidayStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 親から届いたtasksを、他ビューと同じ共通フィルターで絞り込む
  const displayTasks = useMemo(
    () => filterTasks(tasks, filterUser, filterCategory, filterPriority),
    [tasks, filterUser, filterCategory, filterPriority]
  );

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0始まり（0=1月）

  // 当月のカレンダーマス目を生成する（日曜始まり、前後の月の余白日を含め7の倍数になるまで埋める）
  const cells = useMemo(() => {
    const result: { date: Date; dateStr: string; inCurrentMonth: boolean }[] = [];

    const firstDayOfMonth = new Date(year, month, 1);
    const startWeekday = firstDayOfMonth.getDay(); // 0=日曜
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 前月の余白日
    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(year, month, 1 - (startWeekday - i));
      result.push({ date: d, dateStr: toDateStr(d), inCurrentMonth: false });
    }
    // 当月分
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      result.push({ date, dateStr: toDateStr(date), inCurrentMonth: true });
    }
    // 翌月の余白日（週の区切りが揃うよう7の倍数まで埋める）
    while (result.length % 7 !== 0) {
      const last = result[result.length - 1].date;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      result.push({ date: d, dateStr: toDateStr(d), inCurrentMonth: false });
    }
    return result;
  }, [year, month]);

  // 「今日」はブラウザのローカル時刻ではなく、共通関数（JST基準）から取得し、
  // 他コンポーネント（TaskCard.tsx等）と判定基準を揃える
  const todayStr = getTodayJstDateString();

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    displayTasks.forEach((task) => {
      if (!task.endDate) return;
      if (!map[task.endDate]) map[task.endDate] = [];
      map[task.endDate].push(task);
    });
    return map;
  }, [displayTasks]);

  const goPrevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const goNextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => {
    const d = new Date();
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  return (
    <div className="bg-card border border-border-card rounded-xl p-3 @min-[640px]:p-5 md:p-6 shadow-xs">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-black text-text-main tracking-wide">
          {year}年 {month + 1}月
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={goPrevMonth}
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface hover:bg-base border border-border-card/50 text-text-sub hover:text-text-main transition cursor-pointer"
            title="前の月"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToday}
            className="h-8 px-3 flex items-center justify-center rounded-lg bg-surface hover:bg-base border border-border-card/50 text-[10px] font-bold text-text-sub hover:text-text-main transition cursor-pointer"
          >
            今日
          </button>
          <button
            onClick={goNextMonth}
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface hover:bg-base border border-border-card/50 text-text-sub hover:text-text-main transition cursor-pointer"
            title="次の月"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {holidayStatus === 'error' && (
        <p className="text-[10px] text-text-sub mb-3">
          ※祝日データの取得に失敗したため、祝日のハイライトなしで表示しています。
        </p>
      )}

      {/* 横幅が狭い（縦1列リスト）では列見出しの意味がないため非表示にし、各日付の行内に曜日を直接表示する */}
      <div className="hidden @min-[640px]:grid grid-cols-7 text-center text-[10px] font-bold text-text-sub uppercase tracking-wider mb-2">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={w} className={i === 0 ? 'text-rose-400' : i === 6 ? 'text-sky-400' : ''}>
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 @min-[640px]:grid-cols-7 gap-1.5">
        {cells.map((cell) => {
          const holidayName = holidays[cell.dateStr];
          const isToday = cell.dateStr === todayStr;
          const dayTasks = tasksByDate[cell.dateStr] || [];
          const visibleTasks = dayTasks.slice(0, 3);
          const overflowCount = dayTasks.length - visibleTasks.length;
          const weekday = WEEKDAY_LABELS[cell.date.getDay()];

          return (
            <div
              key={cell.dateStr}
              title={holidayName}
              className={`rounded-lg border p-2 @min-[640px]:p-1.5 flex-col gap-1 transition-colors min-h-[40px] @min-[640px]:min-h-[88px] ${
                // 前後月の余白日は、リスト表示では紛らわしいだけなので非表示にし、
                // 7列グリッド表示では従来通り薄く表示して週の並びを保つ
                cell.inCurrentMonth ? 'flex' : 'hidden @min-[640px]:flex'
              } ${
                isToday ? 'border-accent bg-accent/5' : 'border-border-card/40'
              } ${!cell.inCurrentMonth ? 'opacity-35' : ''} ${holidayName ? 'bg-rose-500/5' : ''}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xs @min-[640px]:text-[10px] font-bold font-mono ${holidayName ? 'text-rose-400' : 'text-text-sub'}`}>
                  {cell.date.getDate()}
                  <span className={`@min-[640px]:hidden ml-1 font-sans font-bold ${weekday === '日' ? 'text-rose-400' : weekday === '土' ? 'text-sky-400' : 'text-text-sub'}`}>
                    ({weekday})
                  </span>
                </span>
                {holidayName && (
                  <span className="text-[10px] @min-[640px]:text-[8px] text-rose-400 font-bold truncate">{holidayName}</span>
                )}
              </div>
              <div className="space-y-1 @min-[640px]:space-y-0.5 overflow-hidden">
                {visibleTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onStartEdit(task)}
                    title={task.title}
                    className={`w-full text-left text-[11px] @min-[640px]:text-[9px] font-bold px-1.5 @min-[640px]:px-1 py-1 @min-[640px]:py-0.5 rounded truncate cursor-pointer transition ${
                      task.status === 'done'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : task.endDate < todayStr
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-accent/10 text-accent'
                    }`}
                  >
                    {task.title}
                  </button>
                ))}
                {overflowCount > 0 && (
                  <div className="text-[10px] @min-[640px]:text-[8px] text-text-sub font-bold px-1">+{overflowCount}件</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
