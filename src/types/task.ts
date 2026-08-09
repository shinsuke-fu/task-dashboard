export type TaskStatus = 'todo' | 'doing' | 'review' | 'done';
export type TaskCategory = '開発' | 'デザイン' | 'マーケ' | 'その他';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface User {
  id: string;
  name: string;
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
  assignees: string[];    // 担当者のUser ID配列
  reviewerId?: string;    // 承認上司のUser ID
  returnReason?: string;  // 💡 追加：差し戻し理由のコメント
}

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