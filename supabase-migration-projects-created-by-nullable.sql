-- =============================================================================
-- WORK PLUS: projects.created_byをNULL許容化（ゲストログアウト削除漏れバグの修正）マイグレーション（2026-09-05）
-- -----------------------------------------------------------------------------
-- 使い方：Supabaseダッシュボード → 左メニュー「SQL Editor」→「New query」で
-- このファイルの中身をすべて貼り付けて「Run」を押してください。
--
-- 【背景・何のバグを直すか】
-- ゲストのログアウト時、useAuthSession.tsのhandleLogoutはdelete_own_account()を呼んで
-- ゲスト自身のデータを削除してからサインアウトする。ところがdelete_own_account()が削除する
-- プロジェクトは「自分1人だけがメンバーのプロジェクト」に限られ（他にメンバーがいる
-- プロジェクトは、退会時と違いゲストのログアウトにはオーナー引き継ぎフローが無いため、
-- 削除対象に含められない）、そのままauth.usersから自分自身を削除しようとすると、
-- 他メンバーがいるプロジェクトのprojects.created_by（NOT NULL・ON DELETE CASCADE無しで
-- profiles(id)を参照）が外部キー制約違反を起こしdelete_own_account()全体がロールバックする。
-- handleLogout側はこのRPCのエラーをconsole.errorで握りつぶすだけで処理を続けるため、
-- ゲストのログアウト自体は成功したように見えるが、実際にはゲストアカウント・
-- プロジェクト・メンバーシップがDBに残り続けてしまう（引継ぎメモ.md参照）。
--
-- さらに調査の結果、transfer_project_ownership()はproject_members.roleしか更新せず
-- projects.created_byを更新しないことが判明した。つまりcreated_byは「そのプロジェクトを
-- 最初に作った人」を指したまま、オーナー譲渡後も永久に変わらない歴史的フィールドであり、
-- 本バグは「ゲストが他メンバーのいるプロジェクトのオーナーのまま」という当初の想定より
-- 広く、「一度でも（オーナー譲渡等で現在は無関係でも）まだ存在しているプロジェクトを
-- 作成したことがあるアカウント」全般（ゲスト・実アカウント問わず）が対象になりうる。
--
-- 【対応方針】
-- created_byを「作成者を記録するだけの、以後の状態変化を追跡しない履歴的フィールド」
-- として明確に扱い、参照先のprofilesが削除されたらNULLへ自動的に置き換わるようにする
-- （ON DELETE SET NULL）。src/types/task.ts・src/hooks/useProjects.ts側でも
-- Project.createdByをstring | nullへ変更済み（対応するフロント側コミットを参照）。
-- フロント側はcreatedByを画面表示にも権限判定にも使っていないため（プロジェクト作成時の
-- マッピング以外に参照箇所なし。types/task.ts・useProjects.ts・OwnershipHandoverSection.tsx・
-- ProjectManagementView.tsx・ProjectFormModal.tsx・MemberManagementModal.tsxで確認済み）、
-- このスキーマ変更に伴う追加のUI対応は不要と判断した。
--
-- projects_select_memberポリシー（supabase-migration-projects.sql）の
-- 「auth.uid() = created_by」のOR条件（作成直後のRLS「鶏と卵」問題の対策）は、
-- created_byがNULLになった行では単に一致しなくなるだけで、実害はない
-- （is_project_member()側の条件で実際のメンバーには変わらず可視のまま）。
--
-- delete_own_account()自体の変更は不要：このマイグレーション適用後は、他メンバーが
-- いるプロジェクトを削除せずauth.usersの削除だけ行っても、created_byが自動的にNULLへ
-- 置き換わるため外部キー制約違反が起きなくなる。
-- =============================================================================

-- 1. NOT NULL制約を外す（作成者アカウント削除後はNULLになりうるため）
alter table public.projects
  alter column created_by drop not null;

-- 2. 既存の外部キー制約を削除する
--    （supabase-migration-projects.sqlのinline `references`で自動命名された
--    projects_created_by_fkeyという名前のはず。念のためIF EXISTSで安全に）
alter table public.projects
  drop constraint if exists projects_created_by_fkey;

-- 3. ON DELETE SET NULLを付けて外部キー制約を張り直す
alter table public.projects
  add constraint projects_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

-- =============================================================================
-- ここまで実行したら完了です。
-- 動作確認方法：他にメンバーがいるプロジェクトのオーナーであるゲストアカウントで
-- ログアウトし、以前は残っていたゲストのauth.users行・プロジェクト・メンバーシップが
-- 今回はきちんと削除される（プロジェクト自体は他メンバーがいるため残るが、
-- projects.created_byがNULLになっている）ことを確認してください。
-- =============================================================================
