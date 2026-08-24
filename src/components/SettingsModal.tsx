/**
 * src/components/SettingsModal.tsx
 * -----------------------------------------------------------------------
 * 【⚠️未使用（削除候補）】
 *   2026-08-22、設定機能を「モーダル」から「独立したページ」（他画面と同じ
 *   一面表示）に作り替えたため、このファイルはどこからもimportされなくなった。
 *   後継は src/components/settings/SettingsView.tsx。中身は移設済みのため、
 *   このファイルは動作確認後に手動で削除してよい（このセッションからは
 *   ユーザーのPC上のファイル削除はできないため、他の未使用ファイル
 *   〈App.css等〉と同様、削除はユーザー側での対応をお願いしたい）。
 * -----------------------------------------------------------------------
 * 【役割（旧・参考用）】
 *   アプリ全体の設定をまとめるモーダル。ヘッダーのアバター横の⚙️ボタンと、
 *   サイドバー下部のログアウト横の⚙️ボタン、両方から同じモーダルを開く。
 *   isOpen=trueの間だけ描画される（TaskForm.tsx / RejectReasonModal.tsxと
 *   同じ「モーダル系コンポーネント」の設計パターンに合わせている）。
 *
 * 【現状の中身（器だけ先に作り、今入れられるものだけ入れた段階）】
 *   1. テーマ設定：以前ヘッダーに単体のドロップダウンとして置かれていた
 *      配色テーマ切替を、ここに集約した（ヘッダー側のドロップダウンは撤去済み）
 *   2. 通知設定：通知ベルの4種類（遅延中／当日締切／差し戻された／承認待ち）を
 *      それぞれON/OFFできる
 *   3. データ：localStorageのタスクデータを初期のサンプルタスクにリセットする
 *
 *   ログイン機能実装後に増えそうな項目（プロフィール編集・パスワード変更等）は
 *   ④の認証・DBバックエンド導入後にここへ追加していく想定（仕様書参照）。
 * -----------------------------------------------------------------------
 */
import React from 'react';
import type { AppTheme, NotificationType } from '../types/task';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: AppTheme;
  themeLabels: Record<AppTheme, string>;
  onThemeChange: (theme: AppTheme) => void;
  notificationSettings: Record<NotificationType, boolean>;
  onToggleNotification: (type: NotificationType) => void;
  onResetSampleData: () => void;
}

// 通知設定セクションに表示する4種類のラベル・説明文
const NOTIFICATION_OPTIONS: { type: NotificationType; label: string; description: string }[] = [
  { type: 'overdue', label: '遅延中', description: '自分が担当者のタスクの期日が過ぎたとき' },
  { type: 'dueToday', label: '当日締切', description: '自分が担当者のタスクの期日が今日のとき' },
  { type: 'rejected', label: '差し戻された', description: '自分が担当者のタスクが差し戻されたとき' },
  { type: 'reviewRequested', label: '承認待ち', description: '自分が確認者のタスクが承認待ちになったとき' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  themeLabels,
  onThemeChange,
  notificationSettings,
  onToggleNotification,
  onResetSampleData,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-card border border-border-card rounded-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* ヘッダー */}
        <div className="flex items-center justify-between pb-2 border-b border-border-card/40">
          <h3 className="font-extrabold text-xs tracking-wider text-text-main uppercase">設定</h3>
        </div>

        {/* テーマ設定 */}
        <div>
          <label className="block text-[10px] font-black text-text-sub uppercase mb-2">配色テーマ</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(themeLabels) as AppTheme[]).map((themeKey) => (
              <button
                key={themeKey}
                type="button"
                onClick={() => onThemeChange(themeKey)}
                className={`h-9 rounded-lg text-[10px] font-bold tracking-wider transition-colors cursor-pointer border ${
                  theme === themeKey
                    ? 'bg-accent/10 text-accent border-accent/40'
                    : 'bg-base text-text-sub hover:text-text-main border-border-card'
                }`}
              >
                {themeLabels[themeKey]}
              </button>
            ))}
          </div>
        </div>

        {/* 通知設定 */}
        <div>
          <label className="block text-[10px] font-black text-text-sub uppercase mb-2">通知ベル</label>
          <div className="space-y-2">
            {NOTIFICATION_OPTIONS.map((opt) => (
              <label
                key={opt.type}
                className="flex items-center justify-between gap-3 bg-base border border-border-card rounded-xl px-3 h-11 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-text-main">{opt.label}</div>
                  <div className="text-[10px] text-text-sub truncate">{opt.description}</div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings[opt.type]}
                  onChange={() => onToggleNotification(opt.type)}
                  className="w-4 h-4 accent-accent cursor-pointer flex-shrink-0"
                />
              </label>
            ))}
          </div>
        </div>

        {/* データ */}
        <div>
          <label className="block text-[10px] font-black text-text-sub uppercase mb-2">データ</label>
          <button
            type="button"
            onClick={onResetSampleData}
            className="w-full h-9 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white font-bold text-[11px] rounded-xl transition cursor-pointer border border-rose-500/20"
          >
            サンプルデータにリセット
          </button>
          <p className="text-[10px] text-text-sub mt-1.5 pl-1 font-medium">
            現在保存されているタスクデータを削除し、初期のサンプルタスクに戻します。元に戻せません。
          </p>
        </div>

        {/* 下部アクションボタン */}
        <div className="flex justify-end pt-2 border-t border-border-card/30">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-5 bg-accent hover:bg-accent/90 text-slate-950 font-black text-xs rounded-xl cursor-pointer shadow-md"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
