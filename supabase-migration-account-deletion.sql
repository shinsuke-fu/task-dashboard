-- =============================================================================
-- WORK PLUS: 退会（アカウント削除）機能 マイグレーション（2026-08-25）
-- -----------------------------------------------------------------------------
-- 使い方：Supabaseダッシュボード → 左メニュー「SQL Editor」→「New query」で
-- このファイルの中身をすべて貼り付けて「Run」を押してください。
-- supabase-schema.sql / supabase-migration-profile.sql を実行済みのプロジェクトに
-- 対する追加分です（それらを再実行する必要はありません）。
--
-- 【なぜこの関数が必要か】
-- フロントエンドが使っているSupabaseの「anon（匿名）キー」には、auth.usersを
-- 削除する権限がありません（自分自身の行であっても）。auth.usersの削除には
-- 管理者権限（service_role）が必要ですが、service_roleキーはブラウザに
-- 絶対に置けない機密情報です。
-- そこで、「security definer」（関数の“作成者”の権限で実行される）という
-- Postgresの仕組みを使い、"呼び出したユーザー自身のアカウントだけ"を
-- 削除できる関数をあらかじめ用意しておきます。これがSupabaseで自己都合の
-- アカウント削除を実装する際の標準的なやり方です。
-- =============================================================================


create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. 自分が作成したタスクを削除
  --    （task_assignees・task_subtasksはON DELETE CASCADEで自動的に一緒に消える）
  delete from public.tasks where created_by = auth.uid();

  -- 2. 他人が作成したタスクの確認者(reviewer_id)に自分が設定されている場合、
  --    そのタスクは削除せず、reviewer_idだけをNULLに戻す
  --    （reviewer_idはprofiles参照でON DELETE CASCADEを付けていないため、
  --    このステップを飛ばすと次のprofiles削除が外部キー制約で失敗する）
  update public.tasks set reviewer_id = null where reviewer_id = auth.uid();

  -- 3. auth.usersから自分自身を削除
  --    （profilesはauth.users参照でON DELETE CASCADEのため自動的に一緒に消える。
  --    これでログインセッションも無効になる）
  delete from auth.users where id = auth.uid();
end;
$$;

-- ログイン済みユーザーなら誰でもこの関数を呼び出せるようにする
-- （関数の中で auth.uid() を使っているため、実際に削除できるのは常に「自分自身」だけ）
grant execute on function public.delete_own_account() to authenticated;


-- =============================================================================
-- ここまで実行したら完了です。設定画面の「データ」タブから退会できるようになります。
-- =============================================================================
