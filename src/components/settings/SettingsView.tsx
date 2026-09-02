/**
 * src/components/settings/SettingsView.tsx
 * 「設定」ページ本体。ヘッダー・サイドバーどちらの⚙️ボタンからもcurrentView='settings'
 * に切り替えて表示する一画面。プロフィール／テーマ／通知／データ／アプリについての
 * カテゴリタブで出し分け、各タブの実処理は専用コンポーネント（ProfileSection等）に分離する。
 */
import React, { useState } from 'react';
import type { AppTheme, NotificationType, Project, User } from '../../types/task';
import { ProfileSection } from './ProfileSection';
import { DangerZoneSection } from './DangerZoneSection';
import { OwnershipHandoverSection } from './OwnershipHandoverSection';
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
  // 自分がオーナーかつ他にもメンバーがいるプロジェクト（App.tsx側で絞り込み済み）。
  // 0件の間は通常通りDangerZoneSectionを表示する
  projectsNeedingOwnershipHandover: Project[];
  projectMembers: Record<string, { userId: string; role: string }[]>;
  users: User[];
  currentUserId: string;
  onTransferOwnershipForRetirement: (projectId: string, newOwnerId: string) => Promise<string | null>;
}

type SettingsTab = 'profile' | 'theme' | 'notifications' | 'data' | 'about';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'profile', label: 'プロフィール' },
  { id: 'theme', label: 'テーマ' },
  { id: 'notifications', label: '通知' },
  { id: 'data', label: 'データ' },
  { id: 'about', label: 'アプリについて' },
];

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
  projectsNeedingOwnershipHandover,
  projectMembers,
  users,
  currentUserId,
  onTransferOwnershipForRetirement,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-sm font-black tracking-widest uppercase text-text-main">設定</h2>

      {/* 幅が足りない画面では横スクロールでなく折り返す（overflow-x-autoは常時スクロールバーが出るため） */}
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

      {activeTab === 'profile' && (
        <ProfileSection
          displayName={displayName}
          avatarUrl={avatarUrl}
          onUpdateDisplayName={onUpdateDisplayName}
          onUploadAvatar={onUploadAvatar}
          onChangePassword={onChangePassword}
        />
      )}

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

          {projectsNeedingOwnershipHandover.length > 0 ? (
            <OwnershipHandoverSection
              projects={projectsNeedingOwnershipHandover}
              projectMembers={projectMembers}
              users={users}
              currentUserId={currentUserId}
              onTransferOwnership={onTransferOwnershipForRetirement}
            />
          ) : (
            <DangerZoneSection onDeleteAccount={onDeleteAccount} />
          )}
        </div>
      )}

      {activeTab === 'about' && <AboutSection />}
    </div>
  );
};
