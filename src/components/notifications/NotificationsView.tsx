/**
 * src/components/notifications/NotificationsView.tsx
 * 通知の全件を確認する専用画面（currentView='notifications'）。ヘッダーの通知ベル
 * ドロップダウン（直近6件のプレビュー）の「すべて見る→」からのみ遷移する。通知テーブルは
 * 持たず、tasksの状態からその場で導出した「今この瞬間の通知一覧」を表示するだけ。
 */
import type { NotificationItem, NotificationType, Project, Task } from '../../types/task';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  projects: Project[];
  onSelectNotification: (task: Task) => void;
}

// SettingsView.tsxの通知ON/OFF設定とラベル表記を統一。表示順は緊急度順で固定
const TYPE_SECTIONS: { type: NotificationType; label: string; dotColor: string }[] = [
  { type: 'overdue', label: '遅延中', dotColor: 'bg-rose-500' },
  { type: 'dueToday', label: '当日締切', dotColor: 'bg-amber-500' },
  { type: 'rejected', label: '差し戻された', dotColor: 'bg-rose-400' },
  { type: 'reviewRequested', label: '承認待ち', dotColor: 'bg-accent' },
];

export function NotificationsView({ notifications, projects, onSelectNotification }: NotificationsViewProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-sm font-black tracking-widest uppercase text-text-main">通知</h2>

      {notifications.length === 0 ? (
        <div className="bg-card p-12 rounded-2xl border border-border-card text-center">
          <p className="text-xs text-text-sub font-medium">現在、通知はありません</p>
        </div>
      ) : (
        <div className="space-y-6">
          {TYPE_SECTIONS.map((section) => {
            const items = notifications.filter((n) => n.type === section.type);
            if (items.length === 0) return null;

            return (
              <div key={section.type}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${section.dotColor}`} />
                  <h3 className="text-[11px] font-black tracking-widest uppercase text-text-sub">
                    {section.label}
                  </h3>
                  <span className="text-[10px] font-mono text-text-sub">{items.length}</span>
                </div>

                <div className="space-y-2">
                  {items.map((n) => {
                    const projectName = projects.find((p) => p.id === n.task.projectId)?.name ?? '不明なプロジェクト';
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => onSelectNotification(n.task)}
                        className="w-full text-left bg-card border border-border-card rounded-xl p-4 hover:border-accent/40 hover:bg-surface transition-colors cursor-pointer flex items-start gap-3"
                      >
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${section.dotColor}`} />
                        <span className="min-w-0">
                          <span className="inline-block text-[10px] font-bold text-accent bg-accent/10 rounded-full px-2 py-0.5 mb-1.5">
                            {projectName}
                          </span>
                          <span className="block text-xs text-text-main font-medium leading-relaxed">{n.message}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
