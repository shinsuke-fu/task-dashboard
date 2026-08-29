-- =============================================================================
-- supabase-migration-projects.sql
-- -----------------------------------------------------------------------------
-- 【役割】
--   プロジェクト管理機能_要件定義書.md の §3（データモデル）・§6.1（オーナー
--   譲渡関数）・§7.1（RLS）を実装するマイグレーション。
--   実行後は 認証・DB設計書.md に該当セクションを追記すること（規約）。
--
-- 【重要：再帰的RLSポリシーのバグと対策】
--   初回実装では projects / project_members / tasks のRLSポリシーを生の
--   `EXISTS(select ... from project_members ...)` サブクエリで書いていたが、
--   project_members テーブル自身のSELECTポリシーが project_members を
--   再度参照する形になり、行の可視性が壊れる（既存タスクが全て消えて見える）
--   Postgres/Supabaseでよく知られた「再帰的RLSポリシー」の罠にはまった。
--   対策として is_project_member() / is_project_owner() を
--   SECURITY DEFINER関数にし、関数内部でRLSをバイパスして再帰を断ち切っている。
--
-- 【重要：INSERT直後のRETURNINGが失敗する不具合と対策】
--   プロジェクト新規作成時、`insert ... returning`のRETURNINGはSELECTポリシー
--   （projects_select_member）の可視性チェックも受けるが、「作成者を自動的に
--   オーナーとしてproject_membersへ登録する」AFTER INSERTトリガーが完了する前に
--   このチェックが走ってしまい、「作成した本人なのに作成直後は自分のプロジェクトが
--   見えない」というRLSの鶏と卵問題でRETURNINGが失敗していた。
--   projects_select_memberに「auth.uid() = created_by」を許可条件として追加することで
--   解消済み（このファイルはこの修正も最初から織り込んだ最終版。詳細は
--   supabase-migration-projects-select-fix.sql参照）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. テーブル定義（§3.1 projects / §3.2 project_members）
-- -----------------------------------------------------------------------------

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 既存の set_updated_at() トリガー関数を流用（他テーブルと同じパターン）
drop trigger if exists set_projects_updated_at on projects;
create trigger set_projects_updated_at
  before update on projects
  for each row execute procedure public.set_updated_at();

create table if not exists project_members (
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  primary key (project_id, user_id)
);

create index if not exists idx_project_members_user_id on project_members(user_id);

-- -----------------------------------------------------------------------------
-- 2. プロジェクト作成時に作成者を自動でオーナーとして登録するトリガー
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

drop trigger if exists on_project_created on projects;
create trigger on_project_created
  after insert on projects
  for each row execute procedure public.handle_new_project();

-- -----------------------------------------------------------------------------
-- 3. オーナー譲渡関数（§6.1）
-- -----------------------------------------------------------------------------

create or replace function public.transfer_project_ownership(p_project_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'オーナーのみが実行できます';
  end if;

  if not exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = p_new_owner_id
  ) then
    raise exception '譲渡先はこのプロジェクトのメンバーである必要があります';
  end if;

  update public.project_members set role = 'member'
  where project_id = p_project_id and user_id = auth.uid();

  update public.project_members set role = 'owner'
  where project_id = p_project_id and user_id = p_new_owner_id;
end;
$$;

grant execute on function public.transfer_project_ownership(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. tasks に project_id を追加し、既存タスクを移行用プロジェクトへ紐付け
--    （on delete cascade は要件定義書の記載を超えて追加。将来の§6.2「オーナー
--     退会時、他メンバーがいなければプロジェクトごと削除」に備えたもの）
-- -----------------------------------------------------------------------------

alter table tasks add column if not exists project_id uuid references projects(id) on delete cascade;

do $$
declare
  v_default_project_id uuid;
  v_first_user_id uuid;
begin
  -- 一番古く登録したユーザーを、移行用プロジェクトの仮の作成者とする
  -- （通常運用の「作成者=オーナー」ルールとは別の、初回移行のみの特例）
  select id into v_first_user_id from profiles order by created_at asc limit 1;

  if v_first_user_id is not null then
    insert into projects (name, description, status, created_by)
    values (
      '（移行前タスク）',
      'プロジェクト管理機能の導入前に作成されていた既存タスクの移行先として自動生成されたプロジェクトです。',
      'active',
      v_first_user_id
    )
    returning id into v_default_project_id;

    insert into project_members (project_id, user_id, role)
    select v_default_project_id, id, 'member' from profiles
    on conflict (project_id, user_id) do nothing;

    update tasks set project_id = v_default_project_id where project_id is null;
  end if;
end
$$;

alter table tasks alter column project_id set not null;

create index if not exists idx_tasks_project_id on tasks(project_id);

-- -----------------------------------------------------------------------------
-- 5. RLS有効化
-- -----------------------------------------------------------------------------

alter table projects enable row level security;
alter table project_members enable row level security;

-- -----------------------------------------------------------------------------
-- 6. 再帰的RLS回避用ヘルパー関数（SECURITY DEFINERでRLSをバイパスして判定する）
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- 7. projects / project_members のRLSポリシー（§7.1）
-- -----------------------------------------------------------------------------

-- 「auth.uid() = created_by」は、作成直後（AFTER INSERTトリガーがproject_membersへ
-- オーナー登録を終える前）でも、作成者本人がRETURNINGで自分の行を受け取れるようにするため
drop policy if exists "projects_select_member" on projects;
create policy "projects_select_member" on projects
  for select to authenticated
  using (public.is_project_member(id) OR auth.uid() = created_by);

drop policy if exists "projects_insert_authenticated" on projects;
create policy "projects_insert_authenticated" on projects
  for insert to authenticated
  with check (auth.uid() = created_by);

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

-- オーナー行は transfer_project_ownership() 経由でのみ移動させ、直接の自己削除は
-- 許可しない（§7.4の想定を超えて明示的にブロック。オーナー不在プロジェクトの
-- 発生を防ぐため）
drop policy if exists "project_members_delete_owner_or_self" on project_members;
create policy "project_members_delete_owner_or_self" on project_members
  for delete to authenticated
  using (
    role <> 'owner' and (user_id = auth.uid() or public.is_project_owner(project_id))
  );

-- -----------------------------------------------------------------------------
-- 8. tasks のRLSポリシーをプロジェクト単位に更新
-- -----------------------------------------------------------------------------

drop policy if exists "tasks_select_authenticated" on tasks;
create policy "tasks_select_project_member" on tasks
  for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "tasks_insert_authenticated" on tasks;
create policy "tasks_insert_project_member" on tasks
  for insert to authenticated
  with check (public.is_project_member(project_id));

drop policy if exists "tasks_update_authenticated" on tasks;
create policy "tasks_update_project_member" on tasks
  for update to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "tasks_delete_own" on tasks;
create policy "tasks_delete_own_project_member" on tasks
  for delete to authenticated
  using (auth.uid() = created_by and public.is_project_member(project_id));
