-- =============================================================================
-- WORK PLUS: task_assignees / task_subtasks RLSポリシー修正
-- -----------------------------------------------------------------------------
-- 【背景】
--   supabase-migration-projects.sql（プロジェクト管理機能導入）でtasks本体のRLSは
--   is_project_member(project_id)ベースに更新されたが、担当者中間テーブル
--   task_assignees とサブタスクテーブル task_subtasks は supabase-schema.sql 作成時の
--   ポリシー（to authenticated using (true) = ログイン済みなら誰でも閲覧・追加・削除可）の
--   まま更新されておらず、プロジェクトメンバーかどうかのチェックが漏れていた
--   （2026-09-02 ドキュメント監査で発覚。docs/詳細設計書_認証DB編.md 3.1参照。
--   経緯は学習ノート.md 8.3参照）。
--
-- 【実害】
--   task_assigneesは「どのタスクIDに誰が割り当てられているか」の対応表、task_subtasksは
--   実際のサブタスク文言（title）を含む。tasks本体はプロジェクトメンバー以外には見えないが、
--   中間テーブル自体はプロジェクトに無関係な認証済みユーザーであっても
--   select * from task_assignees / select * from task_subtasks で全プロジェクト分を
--   横断的に取得でき、task_idさえ分かればinsert・delete（task_subtasksはupdateも）も
--   通ってしまう状態だった。
--
-- 【使い方】Supabaseダッシュボード → 左メニュー「SQL Editor」→「New query」で
-- このファイルの中身をすべて貼り付けて「Run」を押してください。
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. is_task_project_member(p_task_id)：task_idから所属プロジェクトを辿り、
--    自分がそのプロジェクトのメンバーかどうかを判定するsecurity definerヘルパー関数。
--    is_project_member(project_id)（supabase-migration-projects.sql）と同じ考え方で、
--    RLSをバイパスして判定することで「参照先がまだRLSで見えない」ケースを避ける
--    （鶏と卵問題。docs/詳細設計書_認証DB編.md 3.1〜3.2参照）。
-- -----------------------------------------------------------------------------
create or replace function public.is_task_project_member(p_task_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_project_member(project_id)
  from tasks
  where id = p_task_id;
$$;


-- -----------------------------------------------------------------------------
-- 2. task_assignees：tasks本体（supabase-migration-projects.sql）と同じ
--    「プロジェクトメンバーのみ」方針に合わせる
-- -----------------------------------------------------------------------------
drop policy if exists "task_assignees_select_authenticated" on task_assignees;
create policy "task_assignees_select_project_member" on task_assignees
  for select to authenticated
  using (public.is_task_project_member(task_id));

drop policy if exists "task_assignees_insert_authenticated" on task_assignees;
create policy "task_assignees_insert_project_member" on task_assignees
  for insert to authenticated
  with check (public.is_task_project_member(task_id));

drop policy if exists "task_assignees_delete_authenticated" on task_assignees;
create policy "task_assignees_delete_project_member" on task_assignees
  for delete to authenticated
  using (public.is_task_project_member(task_id));


-- -----------------------------------------------------------------------------
-- 3. task_subtasks：同様に「プロジェクトメンバーのみ」方針に合わせる（updateも対象）
-- -----------------------------------------------------------------------------
drop policy if exists "task_subtasks_select_authenticated" on task_subtasks;
create policy "task_subtasks_select_project_member" on task_subtasks
  for select to authenticated
  using (public.is_task_project_member(task_id));

drop policy if exists "task_subtasks_insert_authenticated" on task_subtasks;
create policy "task_subtasks_insert_project_member" on task_subtasks
  for insert to authenticated
  with check (public.is_task_project_member(task_id));

drop policy if exists "task_subtasks_update_authenticated" on task_subtasks;
create policy "task_subtasks_update_project_member" on task_subtasks
  for update to authenticated
  using (public.is_task_project_member(task_id));

drop policy if exists "task_subtasks_delete_authenticated" on task_subtasks;
create policy "task_subtasks_delete_project_member" on task_subtasks
  for delete to authenticated
  using (public.is_task_project_member(task_id));


-- =============================================================================
-- 実行後の反映先：docs/詳細設計書_認証DB編.md 3.1（このファイルの内容を反映済み）
-- =============================================================================
