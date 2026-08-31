# コミットメッセージ案（2026-08-31・ゲストログイン機能）

前回のコミット（20秒ポーリングのかくつき改善）以降の変更分です。今回も前回コミットが
存在するため、通常通り`git add`→`git commit`で問題ありません。

（このファイル自体はGitにコミットしない、チャット経由で渡すだけの補助ファイルです）

---

## コミットメッセージ

```
feat: ポートフォリオ訪問者向けにゲストログイン機能を追加

- Supabaseの匿名認証（signInAnonymously）を使い、会員登録・パスワード不要でその場で
  アプリを試せる「ゲストとしてログイン」ボタンをログイン画面に追加した
- ログイン直後、App.tsx側でデモ用プロジェクト＋サンプルタスク5件（todo/doing/review/done
  の各ステータス・優先度・カテゴリをばらけさせ、1件はあえて期日超過にしてある）を
  自動投入する（seedGuestDemoData）。ログアウト時はゲスト（匿名）アカウントの場合、
  既存のdelete_own_account()を呼んでから完全にサインアウトすることで、デモデータ・
  匿名アカウント自体がDBに溜まり続けないようにした
- handle_new_user関数を、匿名ユーザー（emailがNULL）でもprofiles.display_nameの作成に
  失敗しないよう修正（supabase-migration-guest-login.sql）

fix: デモデータ自動投入とプロジェクト一覧取得が競合するレースコンディションを解消

- 当初はLogin.tsx側でsignInAnonymously()直後にデモデータまで作成していたが、それだと
  App.tsx側のログイン検知（プロジェクト一覧の取得）と競合し、取得の方が先に終わって
  新規プロジェクトが画面に反映されないことがあった。デモデータ投入の責務をApp.tsx側へ
  移し、「初回のプロジェクト一覧取得が完了した（projectsLoaded）」ことを確認してから
  作成し、作成後に明示的に再取得する順序を保証するようにした

fix: 退会直後のsignOut()でuser_not_foundエラーが出る不具合を修正

- delete_own_account()で自分自身のauth.users行を削除した直後にsupabase.auth.signOut()を
  呼ぶと、Supabase側が「JWTのsubクレームに対応するユーザーが見つからない」エラーを返す
  ことがある既知の挙動（ゲストログイン機能で新たに発覚したが、既存の退会機能
  〈handleDeleteAccount〉にも元々あった不具合）。scope: 'local'を指定した上でエラーを
  無視する共通ヘルパー（signOutAfterAccountDeletion）を用意し、退会・ゲストログアウトの
  両方から呼ぶようにした。ローカルのセッションは正しくクリアされ、実害はない
```

---

## 補足

- 実行が必要なSQLマイグレーション：`supabase-migration-guest-login.sql`（**ユーザー実行済み**）
- Supabaseダッシュボード側の設定：Authentication → Sign In / Providers →
  「Anonymous sign-ins」の有効化（**ユーザー設定済み**）
- `git add` / `git commit` / `git push`はユーザー側で実行してください
  （`feature/project-management`ブランチ上）。
- コミット前に`npm run build`が通ることの確認をお願いします（**確認済み**とのことです）。
