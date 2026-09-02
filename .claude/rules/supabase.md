---
paths:
  - "supabase-*.sql"
  - "src/lib/**/*.ts"
---

# Supabase（DB・RLS）のルール

- **マイグレーションファイルの命名**：`supabase-migration-<内容>.sql`
  （例：`supabase-migration-profile.sql` `supabase-migration-account-deletion.sql`）。
  実行後は`docs/詳細設計書_認証DB編.md`に該当セクションを追記する
- **security definer関数は必ず`auth.uid()`で本人確認する**：呼び出し元の権限チェックを
  関数内で行い、意図しないユーザーが他人のデータを操作できないようにする
  （`delete_own_account`が実装例）
- **RLSで防いでいる操作は、UI側の条件分岐でも一致させる**：DB側の権限とフロントの
  ボタン表示・非表示を必ず揃える（片方だけ直して食い違わせない）
- **秘密情報を書かない**：`.env`の値やAPIキーをSQL・コード・コミットメッセージに
  直接書かない