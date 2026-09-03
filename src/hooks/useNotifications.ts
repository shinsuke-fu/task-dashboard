/**
 * src/hooks/useNotifications.ts
 * 通知ベルまわり（ドロップダウン開閉・種類ごとのON/OFF設定・「自分宛て」アラート一覧の
 * 導出）をApp.tsxから切り出したフック。notificationTasks（useTasks.ts側で取得する
 * 全プロジェクト横断のタスク一覧）とcurrentUserId（useAuthSession.ts側）を受け取って、
 * 通知一覧を毎レンダー時に再計算する。
 */
import { useState, useEffect, useRef } from 'react';
import type { Task, NotificationType, NotificationItem } from '../types/task';
import { getTodayJstDateString } from '../utils/date';

// 通知ベルの4種類すべてを初期状態でON（従来通りの挙動）にしたデフォルト設定
const defaultNotificationSettings: Record<NotificationType, boolean> = {
  overdue: true,
  dueToday: true,
  rejected: true,
  reviewRequested: true,
};

export function useNotifications(notificationTasks: Task[], currentUserId: string) {
  // 通知ベルのドロップダウン開閉状態
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  // 通知ベルの種類ごとのON/OFF設定。これも個人の好みなので引き続きlocalStorageに保存する
  const [notificationSettings, setNotificationSettings] = useState<Record<NotificationType, boolean>>(() => {
    const saved = localStorage.getItem('dashboard_notification_settings');
    return saved ? JSON.parse(saved) : defaultNotificationSettings;
  });

  // 通知メニューの「外側クリックで閉じる」処理。
  // 設定は独立したページ（currentView==='settings'）になったため、この仕組みとは無関係
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 通知ON/OFF設定が変わるたびにlocalStorageへ永続化
  useEffect(() => {
    localStorage.setItem('dashboard_notification_settings', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  // 通知ベルの「自分宛て」アラート一覧。notificationTasks（全プロジェクト横断。
  // docs/要件定義書.md§6）から毎レンダー時に導出する。種類ごとに設定ページ
  // （SettingsView.tsx）でON/OFFでき、OFFの種類はここで一切生成しない
  const todayStr = getTodayJstDateString();
  const notifications: NotificationItem[] = [];

  notificationTasks.forEach((task) => {
    const isMine = task.assignees?.includes(currentUserId);

    // 遅延中・当日締切は「自分が担当者になっている」未完了タスクに絞って通知する
    if (isMine && task.status !== 'done' && task.endDate) {
      if (notificationSettings.overdue && task.endDate < todayStr) {
        notifications.push({ id: `${task.id}-overdue`, type: 'overdue', task, message: `「${task.title}」の期日が過ぎています` });
      } else if (notificationSettings.dueToday && task.endDate === todayStr) {
        notifications.push({ id: `${task.id}-dueToday`, type: 'dueToday', task, message: `「${task.title}」の期日は本日です` });
      }
    }

    // 自分のタスクが差し戻された（進行中に戻され、かつ差し戻し理由が付いている）
    if (notificationSettings.rejected && isMine && task.status === 'doing' && task.returnReason) {
      notifications.push({ id: `${task.id}-rejected`, type: 'rejected', task, message: `「${task.title}」が差し戻されました` });
    }

    // 自分がレビュアーに指定されていて、承認待ち（review）のタスクがある
    if (notificationSettings.reviewRequested && task.reviewerId === currentUserId && task.status === 'review') {
      notifications.push({ id: `${task.id}-reviewRequested`, type: 'reviewRequested', task, message: `「${task.title}」が承認待ちです` });
    }
  });

  // 通知ベルの種類ごとのON/OFFを切り替える（設定ページから呼ばれる）
  const handleToggleNotification = (type: NotificationType) => {
    setNotificationSettings(prev => ({ ...prev, [type]: !prev[type] }));
  };

  return {
    isNotifOpen,
    setIsNotifOpen,
    notifDropdownRef,
    notificationSettings,
    notifications,
    handleToggleNotification,
  };
}
