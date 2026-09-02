/**
 * src/constants/app.ts
 * アプリ名・バージョン・紹介文など、複数箇所（Sidebar.tsx、AboutSection.tsx等）で
 * 共有する値をここに集約する。表示のズレを防ぐため、必ずここから参照する。
 */

export const APP_NAME = 'WORK PLUS';
export const APP_NAME_JA = 'ワークプラス';
export const APP_VERSION = '1.0.0（β版）';
export const APP_TAGLINE =
  'チームのタスク管理をシンプルに。カンバンボード・ガントチャート・承認フローに対応した、個人開発のタスク管理ダッシュボードです。';
export const GITHUB_REPO_URL = 'https://github.com/shinsuke-fu/task-dashboard';
// 固定値。window.location.originの動的取得だと、ローカル開発中はlocalhostが表示されて
// しまい、共有会等で見せる際に紛らわしいため、常に本番URLを表示する
export const PRODUCTION_URL = 'https://work-plus-eosin.vercel.app/';

export const TECH_STACK: string[] = [
  'React 19',
  'TypeScript',
  'Vite',
  'Tailwind CSS v4',
  'Supabase（Auth / PostgreSQL / Storage）',
  'Vercel',
];

export const KEY_FEATURES: string[] = [
  '複数プロジェクトの管理（メンバー招待・オーナー譲渡、プロジェクトごとのタスク分離）',
  'カンバンボードでのタスク管理（ドラッグ＆ドロップ、モバイルはボタン操作にも対応）',
  '承認フロー（申請→承認／差し戻し）と、全プロジェクト横断の通知ベル',
  'ガントチャート・進捗ダッシュボード・月間スケジュール表示',
  '配色テーマ12種類（ダーク6種／ライト6種）',
  'レスポンシブ対応（iPhone実機で検証済み）',
  'Supabase Authによるログイン・パスワードリセット・プロフィール管理',
  '登録不要で試せるゲストログイン（匿名認証・自動デモデータ投入）',
];
