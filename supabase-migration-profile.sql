-- =============================================================================
-- WORK PLUS: プロフィール機能拡張 マイグレーション（2026-08-25）
-- -----------------------------------------------------------------------------
-- 使い方：Supabaseダッシュボード → 左メニュー「SQL Editor」→「New query」で
-- このファイルの中身をすべて貼り付けて「Run」を押してください。
-- supabase-schema.sql を既に実行済みのプロジェクトに対する追加分です
-- （supabase-schema.sqlを再実行する必要はありません）。
--
-- 内容：
--   1. profilesテーブルにavatar_url列を追加（アバター画像のURL保存用）
--   2. アバター画像を保存するStorageバケット「avatars」を作成
--   3. 「本人のフォルダにしかアップロード/更新/削除できない」RLSポリシーを設定
--      （閲覧はバケット自体をpublicにしているため誰でも可能）
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. profiles.avatar_url 列を追加
-- -----------------------------------------------------------------------------
alter table profiles add column if not exists avatar_url text;


-- -----------------------------------------------------------------------------
-- 2. アバター画像用のStorageバケットを作成（公開バケット）
--    公開バケットにすることで、URLさえ分かれば誰でも画像を閲覧できる
--    （＝ log-in不要でアバター画像が表示できる）。書き込み系は下のポリシーで
--    本人のフォルダ以外を弾く
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;


-- -----------------------------------------------------------------------------
-- 3. storage.objectsのRLSポリシー
--    アップロード先のパスは `<自分のuser_id>/avatar` という形式に統一し、
--    フォルダ名（パスの最初の部分）が自分のuser_idと一致する場合のみ
--    アップロード・更新・削除を許可する
-- -----------------------------------------------------------------------------
create policy "avatar_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- バケット自体をpublic=trueで作成しているため無くても閲覧はできるが、
-- 意図を明示する目的で念のため用意しておく
create policy "avatar_select_public" on storage.objects
  for select to public
  using (bucket_id = 'avatars');


-- =============================================================================
-- ここまで実行したら完了です。アプリ側（設定画面）からアバター画像を
-- アップロードできるようになります。
-- =============================================================================
