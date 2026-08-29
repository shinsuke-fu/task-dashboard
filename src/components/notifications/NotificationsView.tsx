/**
 * src/components/notifications/NotificationsView.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   通知の全件を確認する専用画面（currentView='notifications'）。ダッシュボード／
 *   スケジュール／設定などと同じ「一面表示」のビューの1つだが、サイドバーには
 *   項目を追加せず、ヘッダーの通知ベルのドロップダウン最下部「すべて見る→」からのみ
 *   遷移する（設定ページと同様、サイドバーを増やさない入り方）。
 *
 * 【なぜ専用画面を用意したか（2026-08-29、ユーザー要望）】
 *   ステップ8で通知が全プロジェクト横断になり、①どのプロジェクトの通知か分かりにくい、
 *   ②ヘッダーの小さいドロップダウン（幅288px）だと件数・情報量が増えるほど窮屈、という
 *   2点の指摘を受けた。ドロップダウンは直近6件だけの「プレビュー」に徹し、全件・詳細確認は
 *   この専用画面に任せる2段構えにしている。
 *
 * 【データについて】
 *   このアプリには通知テーブル・既読/未読の概念が無く、tasksの状態からその場で導出した
 *   「今この瞬間の通知一覧」をApp.tsxから受け取って表示するだけ（App.tsx側のnotifications
 *   算出ロジックは今回変更していない）。過去の通知ログを見る画面ではない。
 *
 * 【将来の拡張について】
 *   将来、タスク内コメント等をきっかけとした通知の種類が増えても、下記TYPE_SECTIONSに
 *   1件追加するだけでこの画面・ドロップダウン側の両方に自然に反映できるよう、
 *   種類（NotificationType）ごとにセクション分けする構成にしている。
 * -----------------------------------------------------------------------
 */
import type { NotificationItem, NotificationType, Project, Task } from '../../types/task';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  projects: Project[];
  onSelectNotification: (task: Task) => void;
}

// 通知の種類ごとの見出し・アイコン色（SettingsView.tsxの通知ON/OFF設定のラベルと表記を統一）。
// 表示順＝緊急度の高い順（遅延中→当日締切→差し戻された→承認待ち）で固定
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
