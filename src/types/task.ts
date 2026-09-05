/**
 * src/types/task.ts
 * アプリ全体で共有する型定義（Task/User/AppTheme等）を集約する。型エラーが出た場合は
 * `any`で回避せず、Propsの渡し漏れやimportパスの不整合をまず疑うこと。
 */

// タスクの進行ステータス（カンバンの4列に対応）
export type TaskStatus = 'todo' | 'doing' | 'review' | 'done';
export type TaskCategory = '開発' | 'デザイン' | 'マーケ' | 'その他';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface User {
  id: string;
  name: string;
  avatarUrl?: string; // 未設定の場合は名前の頭文字で代替表示する
}

// サブタスク（タスク内の簡易チェックリスト項目）。承認フローは持たせず、担当者向けの
// 進捗メモという位置づけ。期日も持たない（親タスクの期日をそのまま使う）
export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  category: TaskCategory;
  startDate: string;
  endDate: string;
  priority: TaskPriority;
  assignees: string[];
  reviewerId?: string;
  returnReason?: string;
  subtasks?: Subtask[];
  createdBy: string; // 削除ボタンの表示可否判定に使用（RLSの削除権限と揃える）
  projectId: string; // 所属プロジェクトのID（NOT NULL）。TaskForm.tsxの「プロジェクト」欄で移動できる
}

// 選択可能な配色テーマ（src/index.cssの[data-theme="..."]に対応）。デフォルトはGRAPHITE
// （先頭。src/index.cssの:rootにも同じ値を設定している）
export type AppTheme =
  | 'graphite-dark'
  | 'sage-dark'
  | 'bronze-dark'
  | 'ocean-dark'
  | 'amethyst-dark'
  | 'lime-dark'
  // ライト系は刺激の強い純白を避け、オフホワイト/クリーム基調にしている
  | 'cream-light'
  | 'linen-light'
  | 'mist-light'
  | 'pearl-light'
  | 'stone-light'
  | 'sand-light';

// App.tsx・SettingsView.tsxの両方で使うため共有型として定義
export type NotificationType = 'overdue' | 'dueToday' | 'rejected' | 'reviewRequested';

// 通知ベル・NotificationsView.tsxの両方で使う、通知1件分のデータ構造。サーバー側に通知
// テーブルは無く、都度tasksから導出するその場限りのデータ（既読/未読の概念も無い）
export interface NotificationItem {
  id: string;
  type: NotificationType;
  task: Task;
  message: string;
}

// プロジェクトのステータス。デフォルト非表示になるのはアーカイブのみ（§2.2・§3.1）
export type ProjectStatus = 'active' | 'completed' | 'archived';

// プロジェクト1件分のデータ構造（§3.1）。メンバー一覧・自分のロールは別途project_members等で扱う
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdBy: string | null; // 作成者のUser ID。オーナー自体はproject_members側のroleで管理するため、
  // 作成者が退会等でアカウント削除された後もプロジェクト自体は残り続け、その場合createdByはnullになる
  // （supabase-migration-projects-created-by-nullable.sql参照）
}
