-- =============================================================================
-- supabase-migration-projects-rls-fix.sql
-- -----------------------------------------------------------------------------
-- 【役割】
--   supabase-migration-projects.sql を初回実行した際、projects /
--   project_members / tasks のRLSポリシーが再帰的自己参照になっており、
--   既存タスクが見えなくなる不具合が発生した。その修正差分のみを切り出した
--   ファイル（実際にSupabase上で実行し、動作確認済み）。
--
--   supabase-migration-projects.sql 自体は、この修正を最初から織り込んだ
--   最終版に更新済みなので、新規に環境を構築する場合はこのファイルは不要
--   （supabase-migration-projects.sql 一本で足りる）。
--   このファイルは「初回実行時に何が起きて、どう直したか」の記録として残す。
-- =============================================================================

-- 再帰的RLS回避用ヘルパー関数（SECURITY DEFINERでRLSをバイパスして判定する）
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = auth.uid() and role = 'owner'
  );
$$;

-- projects / project_members のポリシーをヘルパー関数経由に差し替え
drop policy if exists "projects_select_member" on projects;
create policy "projects_select_member" on projects
  for select to authenticated
  using (public.is_project_member(id));

drop policy if exists "projects_update_owner" on projects;
create policy "projects_update_owner" on projects
  for update to authenticated
  using (public.is_project_owner(id));

drop policy if exists "projects_delete_owner" on projects;
create policy "projects_delete_owner" on projects
  for delete to authenticated
  using (public.is_project_owner(id));

drop policy if exists "project_members_select_member" on project_members;
create policy "project_members_select_member" on project_members
  for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "project_members_insert_owner" on project_members;
create policy "project_members_insert_owner" on project_members
  for insert to authenticated
  with check (public.is_project_owner(project_id));

drop policy if exists "project_members_delete_owner_or_self" on project_members;
create policy "project_members_delete_owner_or_self" on project_members
  for delete to authenticated
  using (
    role <> 'owner' and (user_id = auth.uid() or public.is_project_owner(project_id))
  );

-- tasks のポリシーもヘルパー関数経由に差し替え
drop policy if exists "tasks_select_project_member" on tasks;
create policy "tasks_select_project_member" on tasks
  for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "tasks_insert_project_member" on tasks;
create policy "tasks_insert_project_member" on tasks
  for insert to authenticated
  with check (public.is_project_member(project_id));

drop policy if exists "tasks_update_project_member" on tasks;
create policy "tasks_update_project_member" on tasks
  for update to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "tasks_delete_own_project_member" on tasks;
create policy "tasks_delete_own_project_member" on tasks
  for delete to authenticated
  using (auth.uid() = created_by and public.is_project_member(project_id));
