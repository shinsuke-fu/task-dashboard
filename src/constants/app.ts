/**
 * src/constants/app.ts
 * -----------------------------------------------------------------------
 * 【役割】
 *   アプリ名・バージョン・紹介文など、複数箇所（Sidebar.tsxのフッター、
 *   設定画面の「アプリについて」タブ等）で同じ値を表示する必要がある
 *   定数をここに集約する。バラバラの場所にハードコードすると片方だけ
 *   更新し忘れて表示がズレる事故が起きやすいため、値は必ずここから参照する。
 * -----------------------------------------------------------------------
 */

export const APP_NAME = 'WORK PLUS';
export const APP_NAME_JA = 'ワークプラス';
export const APP_VERSION = '1.0.0（β版）';
export const APP_TAGLINE =
  'チームのタスク管理をシンプルに。カンバンボード・ガントチャート・承認フローに対応した、個人開発のタスク管理ダッシュボードです。';
export const GITHUB_REPO_URL = 'https://github.com/shinsuke-fu/task-dashboard';
// 公開URL（固定値）。window.location.originから動的取得も検討したが、ローカル開発中に
// 「アプリについて」タブを開くとlocalhost:5173等が表示されてしまい、共有会等で見せる際に
// 紛らわしいため、常に本番の公開URLを表示する固定値にしている
export const PRODUCTION_URL = 'https://work-plus-eosin.vercel.app/';

// 「アプリについて」タブで表示する技術スタック一覧
export const TECH_STACK: string[] = [
  'React 19',
  'TypeScript',
  'Vite',
  'Tailwind CSS v4',
  'Supabase（Auth / PostgreSQL / Storage）',
  'Vercel',
];

// 「アプリについて」タブで表示する主な機能一覧
export const KEY_FEATURES: string[] = [
  'カンバンボードでのタスク管理（ドラッグ＆ドロップ、モバイルはボタン操作にも対応）',
  '承認フロー（申請→承認／差し戻し）と通知ベル',
  'ガントチャート・進捗ダッシュボード・月間スケジュール表示',
  '配色テーマ12種類（ダーク6種／ライト6種）',
  'レスポンシブ対応（iPhone実機で検証済み）',
  'Supabase Authによるログイン・パスワードリセット・プロフィール管理',
];
