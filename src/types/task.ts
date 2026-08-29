/**
 * src/types/task.ts
 * -----------------------------------------------------------------------
 * 【役割】
 *   アプリ全体で共有する型定義（Task / User / AppTheme 等）を集約する。
 *   規約により、ここで定義した型は安易に緩めたり `any` で回避したり
 *   してはならない。型エラーが出た場合はProps渡し漏れやimportパスの
 *   不整合をまず疑うこと。
 * -----------------------------------------------------------------------
 */

// タスクの進行ステータス（カンバンの4列に対応）
export type TaskStatus = 'todo' | 'doing' | 'review' | 'done';
// タスクのカテゴリ分類
export type TaskCategory = '開発' | 'デザイン' | 'マーケ' | 'その他';
// タスクの優先度
export type TaskPriority = 'low' | 'medium' | 'high';

// ユーザー（担当者・レビュアー等）を表す最小単位の型
export interface User {
  id: string;
  name: string;
  avatarUrl?: string; // 追加：プロフィール画像のURL（未設定の場合は名前の頭文字で代替表示）
}

// サブタスク（タスク内の簡易チェックリスト項目）。
// 承認フロー（apply/approve/reject）は持たせず、担当者向けの進捗メモという位置づけにする。
// 期日も持たない（親タスクの期日をそのまま使う）。
export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

// タスク1件分のデータ構造
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  category: TaskCategory;
  startDate: string;
  endDate: string;
  priority: TaskPriority;
  assignees: string[];    // 担当者のUser ID配列
  reviewerId?: string;    // 承認上司のUser ID
  returnReason?: string;  // 追加：差し戻し理由のコメント
  subtasks?: Subtask[];   // 追加：サブタスク（チェックリスト）。任意
  createdBy: string;      // 追加：作成者のUser ID（削除ボタンの表示可否判定に使用。RLSの削除権限と揃える）
  projectId: string;      // 追加：所属プロジェクトのID（NOT NULL）。TaskForm.tsxの「プロジェクト」欄
                           // （ステップ6・要件定義書§2.5）で他プロジェクトへ移動できる
}

// 選択可能な配色テーマ（src/index.css の [data-theme="..."] に対応）
// 2026-08-25：ダーク系に偏りすぎているという指摘を受け、視認性が低かった
// TERRACOTTA・COFFEEを廃止し、代わりにクリーム・オフホワイト系のライトテーマを
// 6種類に拡充（ダーク6種・ライト6種の計12種でバランスを取っている）。
// デフォルトはGRAPHITE（先頭）。src/index.cssの`:root`にもGRAPHITEの値を設定している
export type AppTheme =
  // --- ダーク系（6種。GRAPHITEがデフォルト） ---
  | 'graphite-dark'
  | 'sage-dark'
  | 'bronze-dark'
  | 'ocean-dark'
  | 'amethyst-dark'
  | 'lime-dark'
  // --- ライト系（6種。すべて刺激の強い純白は避け、目に優しいオフホワイト/クリーム基調） ---
  | 'cream-light'
  | 'linen-light'
  | 'mist-light'
  | 'pearl-light'
  | 'stone-light'
  | 'sand-light';

// 通知ベルに表示するアラートの種類（App.tsx・SettingsView.tsxの両方で使うため共有型として定義）
export type NotificationType = 'overdue' | 'dueToday' | 'rejected' | 'reviewRequested';

// 通知ベル・通知専用画面（NotificationsView.tsx）の両方で使う、通知1件分のデータ構造。
// サーバー側に通知テーブルは無く、都度tasksから導出するその場限りのデータ（既読/未読の概念も無い）。
// App.tsx・NotificationsView.tsxの両方で使うため共有型として定義（ステップ8で全プロジェクト
// 横断化した際、通知一覧を専用画面としても表示するようになったため型を共有化した）
export interface NotificationItem {
  id: string;
  type: NotificationType;
  task: Task;
  message: string;
}

// プロジェクトのステータス（「進行中」「完了」「アーカイブ」の3値。デフォルト非表示に
// なるのはアーカイブのみ。プロジェクト管理機能_要件定義書.md §2.2・§3.1）
export type ProjectStatus = 'active' | 'completed' | 'archived';

// プロジェクト1件分のデータ構造（同§3.1）。メンバー一覧・自分のロール（オーナー／メンバー）
// はカード表示・メンバー管理UI（ステップ4・5）で必要になった時点で別途扱う
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdBy: string; // 作成者のUser ID。オーナー自体はproject_members側のroleで管理する
}
