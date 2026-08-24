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
}

// 選択可能な配色テーマ（src/index.css の [data-theme="..."] に対応）
export type AppTheme =
  | 'sage-dark'
  | 'terracotta-dark'
  | 'bronze-dark'
  | 'ocean-dark'
  | 'amethyst-dark'
  | 'graphite-dark'
  | 'lime-dark'
  | 'light'
  | 'coffee-dark';

// 通知ベルに表示するアラートの種類（App.tsx・SettingsView.tsxの両方で使うため共有型として定義）
export type NotificationType = 'overdue' | 'dueToday' | 'rejected' | 'reviewRequested';
