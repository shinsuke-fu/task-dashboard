# WORK PLUS

> チームのタスク管理をシンプルに。カンバンボード・ガントチャート・承認フローに対応した、
> 個人開発のタスク管理ダッシュボードです。

[![CI](https://github.com/shinsuke-fu/task-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/shinsuke-fu/task-dashboard/actions/workflows/ci.yml)

- 🔗 公開URL：https://work-plus-eosin.vercel.app/
- 📦 リポジトリ：https://github.com/shinsuke-fu/task-dashboard

---

## これは何か

社内向けの、1人〜少人数チーム向けタスク管理ダッシュボードです。Supabase（PostgreSQL + Auth）を
バックエンドに使っており、メールアドレス＋パスワードでサインアップした複数のユーザーが、実際に
ログインして同じタスクを共有できます。フロントエンド職の転職活動向けに、個人で設計・実装した
ポートフォリオ作品です。

## 主な機能

- カンバンボードでのタスク管理（ドラッグ＆ドロップ、モバイルはボタン操作にも対応）
- 承認フロー（申請→承認／差し戻し）と通知ベル
- ガントチャート・進捗ダッシュボード・月間スケジュール表示
- 配色テーマ12種類（ダーク6種／ライト6種）
- レスポンシブ対応（iPhone実機で検証済み）
- Supabase Authによるログイン・パスワードリセット・プロフィール管理（アバター画像・退会機能を含む）

## 技術スタック

| 分類 | 使用技術 |
|---|---|
| フレームワーク | React 19 |
| 言語 | TypeScript |
| ビルドツール | Vite |
| スタイリング | Tailwind CSS v4（`@theme`によるCSS変数ベースのカスタムテーマ） |
| バックエンド | Supabase（PostgreSQL + Auth + RLS + Storage） |
| テスト | Vitest + Testing Library |
| Lint | oxlint |
| CI | GitHub Actions |
| ホスティング | Vercel |

状態管理ライブラリ（Redux等）やルーティングライブラリ（React Router等）は使わず、素のReactの機能
（`useState` / `useEffect` / `useMemo`）と`currentView`の文字列判定による最軽量な一面集約型SPAとして
実装しています。

## 画面構成

- **ダッシュボード**：KPIカード・進捗グラフ・締切タイムライン
- **タスクボード**：カンバン形式（未着手／進行中／査読・承認待ち／完了）
- **スケジュール**：月間カレンダー（祝日ハイライト付き）
- **プロジェクト管理**：要件定義済み・実装予定（詳細は`プロジェクト管理機能_要件定義書.md`）
- **設定**：プロフィール／テーマ／通知／データ（サンプルリセット・退会）／アプリについて

## ローカルでのセットアップ

```bash
git clone https://github.com/shinsuke-fu/task-dashboard.git
cd task-dashboard
npm install
cp .env.example .env
```

`.env`を、Supabaseダッシュボード → Settings → API に表示されている実際の値（Project URL・anon
key）に書き換えてください。次に、Supabaseプロジェクト側でSQL Editorから以下のマイグレーションを
この順番で実行します。

1. `supabase-schema.sql`（テーブル・トリガー・RLSポリシー一式）
2. `supabase-migration-profile.sql`（プロフィール機能：`avatar_url`列・`avatars`ストレージバケット）
3. `supabase-migration-account-deletion.sql`（退会機能：`delete_own_account`関数）

準備ができたら、開発サーバーを起動します。

```bash
npm run dev
```

## コマンド一覧

```bash
npm run dev      # 開発サーバー起動
npm run build    # 型チェック（tsc -b）＋ビルド
npm run lint     # oxlintによるLint
npm run test     # Vitestによるユニットテスト実行
npm run preview  # ビルド結果のプレビュー
```

## テストとCI

日付計算・タスク絞り込み・「遅延最優先ルール」（期日超過タスクの表示を、他のどの状態よりも
優先して赤枠で強調する、というこのアプリで最も壊れてはいけないロジック）を中心に、最低限の
ユニットテストを`Vitest` + `Testing Library`で用意しています。`main`ブランチへのpushとPull
Requestのたびに、GitHub Actionsで`lint` → `test` → `build`を自動実行します。

## ドキュメント

設計・仕様・開発ルールは以下のドキュメントにまとめています。

- [`仕様書.md`](./仕様書.md) — 実装済み機能の仕様書（画面構成・データモデル・ディレクトリ構成）
- [`認証・DB設計書.md`](./認証・DB設計書.md) — Supabaseのテーブル・RLS・関数の設計書
- [`プロジェクト管理機能_要件定義書.md`](./プロジェクト管理機能_要件定義書.md) — 実装予定の
  複数プロジェクト管理機能の要件定義書
- [`規約.md`](./規約.md) — このプロジェクトのコーディングルール
- [`学習ノート.md`](./学習ノート.md) — このアプリのコードを教材にした技術解説

## 開発について

個人開発のポートフォリオ作品です。AIアシスタント（Claude）と協働で開発しており、開発ルールは
`規約.md`と`CLAUDE.md`に集約しています。
