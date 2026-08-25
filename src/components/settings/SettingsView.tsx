/**
 * src/components/settings/SettingsView.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   「設定」ページ本体。ダッシュボード／タスクボード／スケジュールと同じ、
 *   独立した1画面として表示する（一面集約型SPAのcurrentView='settings'に
 *   対応するビュー）。ヘッダーのアバター横と、サイドバー下部のログアウト横、
 *   2箇所の⚙️ボタンから、どちらもcurrentViewを'settings'に切り替えることで
 *   このページが表示される（2つの入り口から同じページへ遷移する設計）。
 *
 *   以前はモーダル（旧SettingsModal.tsx）として実装していたが、④の
 *   バックエンド導入後にプロフィール編集・パスワード変更等の項目が増える
 *   見込みのため、他の画面と同じ「一面表示」に作り替えた
 *   （旧SettingsModal.tsxは現在どこからも参照されておらず削除候補。
 *   中身はこのファイルに移設済み）。
 *
 *   2026-08-25：項目が増えて縦スクロールが長くなってきたため、カテゴリタブ
 *   （プロフィール／テーマ／通知／データ／アプリについて）で出し分ける構成に変更。
 *   タブの選択状態はこのコンポーネント内だけのローカルstate（設定ページを
 *   開き直すたびに「プロフィール」タブへ戻る。永続化は不要と判断）。
 *   あわせて、`max-w-2xl`だけでは中央寄せされず（ウルトラワイド等の広い画面で
 *   左に寄って見える）不具合があったため`mx-auto`を追加している。
 *   タブ選択部分は当初`overflow-x-auto`にしていたが、常時横スクロールバーが
 *   出て見た目が気になるとのフィードバックがあり、`flex-wrap`（幅が足りない
 *   時は折り返す）に変更した。
 *
 * 【主な処理】
 *   1. プロフィール：アバター画像・表示名・パスワードの変更（実処理は
 *      ProfileSection.tsxに分離。App.tsx経由でSupabase Auth/Storage/DBを操作する）
 *   2. テーマ設定：配色テーマの切り替え（App.tsxのSSOTを直接更新）
 *   3. 通知設定：通知ベルの4種類（遅延中／当日締切／差し戻された／承認待ち）を
 *      それぞれON/OFFできる
 *   4. データ：サンプルデータへのリセット、および退会（アカウント削除。実処理は
 *      DangerZoneSection.tsxに分離）
 *   5. アプリについて：バージョン・技術スタック・主な機能・リンク等の簡易紹介
 *      （実内容はAboutSection.tsxに分離。社内共有会等で画面をそのまま見せる用途を想定）
 * -----------------------------------------------------------------------
 */
import React, { useState } from 'react';
import type { AppTheme, NotificationType } from '../../types/task';
import { ProfileSection } from './ProfileSection';
import { DangerZoneSection } from './DangerZoneSection';
import { AboutSection } from './AboutSection';

interface SettingsViewProps {
  displayName: string;
  avatarUrl?: string;
  onUpdateDisplayName: (name: string) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
  theme: AppTheme;
  themeLabels: Record<AppTheme, string>;
  onThemeChange: (theme: AppTheme) => void;
  notificationSettings: Record<NotificationType, boolean>;
  onToggleNotification: (type: NotificationType) => void;
  onResetSampleData: () => void;
  onDeleteAccount: (password: string) => Promise<string | null>;
}

// 設定ページのカテゴリタブ
type SettingsTab = 'profile' | 'theme' | 'notifications' | 'data' | 'about';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'profile', label: 'プロフィール' },
  { id: 'theme', label: 'テーマ' },
  { id: 'notifications', label: '通知' },
  { id: 'data', label: 'データ' },
  { id: 'about', label: 'アプリについて' },
];

// 通知設定セクションに表示する4種類のラベル・説明文
const NOTIFICATION_OPTIONS: { type: NotificationType; label: string; description: string }[] = [
  { type: 'overdue', label: '遅延中', description: '自分が担当者のタスクの期日が過ぎたとき' },
  { type: 'dueToday', label: '当日締切', description: '自分が担当者のタスクの期日が今日のとき' },
  { type: 'rejected', label: '差し戻された', description: '自分が担当者のタスクが差し戻されたとき' },
  { type: 'reviewRequested', label: '承認待ち', description: '自分が確認者のタスクが承認待ちになったとき' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  displayName,
  avatarUrl,
  onUpdateDisplayName,
  onUploadAvatar,
  onChangePassword,
  theme,
  themeLabels,
  onThemeChange,
  notificationSettings,
  onToggleNotification,
  onResetSampleData,
  onDeleteAccount,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-sm font-black tracking-widest uppercase text-text-main">設定</h2>

      {/* カテゴリタブ：幅が足りない画面では横スクロールではなく折り返す
          （overflow-x-autoだと常時横スクロールバーが表示されて見た目が悪かったため） */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border-card">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 h-10 text-[11px] font-bold tracking-wider whitespace-nowrap transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-accent border-accent'
                : 'text-text-sub border-transparent hover:text-text-main'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* プロフィール */}
      {activeTab === 'profile' && (
        <ProfileSection
          displayName={displayName}
          avatarUrl={avatarUrl}
          onUpdateDisplayName={onUpdateDisplayName}
          onUploadAvatar={onUploadAvatar}
          onChangePassword={onChangePassword}
        />
      )}

      {/* テーマ設定 */}
      {activeTab === 'theme' && (
        <div className="bg-card border border-border-card rounded-xl p-5 md:p-6 shadow-xs">
          <label className="block text-[10px] font-black text-text-sub uppercase mb-3">配色テーマ</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
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
      )}

      {/* 通知設定 */}
      {activeTab === 'notifications' && (
        <div className="bg-card border border-border-card rounded-xl p-5 md:p-6 shadow-xs">
          <label className="block text-[10px] font-black text-text-sub uppercase mb-3">通知ベル</label>
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
      )}

      {/* データ（サンプルデータのリセット＋退会） */}
      {activeTab === 'data' && (
        <div>
          <div className="bg-card border border-border-card rounded-xl p-5 md:p-6 shadow-xs">
            <label className="block text-[10px] font-black text-text-sub uppercase mb-3">データ</label>
            <button
              type="button"
              onClick={onResetSampleData}
              className="w-full sm:w-auto h-9 px-5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white font-bold text-[11px] rounded-xl transition cursor-pointer border border-rose-500/20"
            >
              サンプルデータにリセット
            </button>
            <p className="text-[10px] text-text-sub mt-2 font-medium">
              現在保存されているタスクデータを削除し、初期のサンプルタスクに戻します。元に戻せません。
            </p>
          </div>

          <DangerZoneSection onDeleteAccount={onDeleteAccount} />
        </div>
      )}

      {/* アプリについて */}
      {activeTab === 'about' && <AboutSection developerName={displayName} />}
    </div>
  );
};
