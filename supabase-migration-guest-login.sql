-- =============================================================================
-- WORK PLUS: ゲストログイン（Supabase Anonymous Auth）対応マイグレーション（2026-08-31）
-- -----------------------------------------------------------------------------
-- 使い方：Supabaseダッシュボード → 左メニュー「SQL Editor」→「New query」で
-- このファイルの中身をすべて貼り付けて「Run」を押してください。
-- handle_new_user()関数を丸ごと置き換えます（既存のprofiles/tasks等のテーブルには
-- 影響しません）。
--
-- 【何が変わるか】
-- 既存のhandle_new_user()は、新規ユーザー登録時にprofiles.display_nameを
--   1. raw_user_meta_data の display_name（新規登録フォームで入力した表示名）
--   2. それも無ければ、メールアドレスの@より前の部分
-- の順で決めていた。匿名ログイン（Anonymous Auth）のユーザーはemail自体がNULLのため、
-- 2番目のフォールバックも失敗し、display_nameがNULLになってNOT NULL制約違反で
-- ユーザー作成そのものが失敗してしまう。3番目のフォールバックとして
-- 「ゲスト + ユーザーIDの先頭4文字」を追加し、匿名ログインでも必ずprofiles行が
-- 作成されるようにする。
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1),
      'ゲスト' || substr(new.id::text, 1, 4)
    )
  );
  return new;
end;
$$;

-- =============================================================================
-- ここまで実行したら完了です。
-- =============================================================================
