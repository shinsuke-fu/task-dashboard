-- =============================================================================
-- WORK PLUS: プロジェクト管理機能 マイグレーション（2026-08-29・ドラフト）
-- -----------------------------------------------------------------------------
-- 使い方：Supabaseダッシュボード → 左メニュー「SQL Editor」→「New query」で
-- このファイルの中身をすべて貼り付けて「Run」を押してください。
-- supabase-schema.sql / supabase-migration-profile.sql / supabase-migration-account-deletion.sql
-- を実行済みのプロジェクトに対する追加分です（それらを再実行する必要はありません）。
-- 対応するドキュメント：docs/要件定義書_プロジェクト管理機能.md（§3・§6.1・§7.1）、
-- docs/詳細設計書_認証DB編.md（2.7〜2.9・3.2）
--
-- 【内容】
--   1. projects（プロジェクト本体）・project_members（メンバー中間テーブル）を新設
--   2. プロジェクト作成時に、作成者を自動的にproject_membersへ「オーナー」登録するトリガー
--   3. オーナー権限を他メンバーへ譲渡するtransfer_project_ownership()関数
--      （退会フローへの組み込み自体は実装ステップ7で対応。今回は関数の用意のみ）
--   4. tasks.project_id列を追加し、既存タスクを「（移行前タスク）」という既定プロジェクトへ
--      一括移行（既存ユーザー全員をメンバーとして登録）した上でNOT NULL制約を付与
--   5. projects・project_membersのRLSポリシー、および既存tasksのRLSポリシーに
--      「そのタスクのプロジェクトのメンバーであること」という条件を追加
--
-- 実装ステップ§9では1（テーブル作成）と2（tasks.project_id追加・移行）が別項目に
-- 分かれていますが、既存のsupabase-migration-profile.sql等と同じ「1機能=1ファイル」の
-- 粒度に合わせ、このファイル1本にまとめています。
--
-- 【このファイルに最初から織り込み済みの、初回実行後に発生した不具合の修正】
--   このファイルを初めて実行した際に、実際には以下の2つの不具合が発生した（いずれも
--   本番のSupabase上で修正・動作確認済み）。このファイル自体は、その修正を最初から
--   織り込んだ最終版になっている（新規に環境を構築する場合はこのファイル1本で足りる。
--   発生時の記録として`supabase-migration-projects-rls-fix.sql`・
--   `supabase-migration-projects-select-fix.sql`を別途残してある）。
--   1. 再帰的RLS：projects / project_members / tasksのRLSポリシーがproject_membersを
--      素朴なEXISTS句で自己参照しており、Postgresの「recursive RLS policy」の罠に
--      かかっていた（既存タスクが画面から見えなくなる不具合として発現）。
--      is_project_member() / is_project_owner()というsecurity definerのヘルパー関数に
--      判定ロジックを切り出す形に修正した（下記6.参照）
--   2. RETURNINGとAFTER INSERTトリガーの競合：プロジェクト作成直後、オーナー登録
--      トリガー（3.）の完了を待たずに`.insert().select().single()`のRETURNINGが
--      SELECT用RLSポリシーの可視性チェックを受けてしまい、「作成した本人なのに
--      作成直後は自分のプロジェクトが見えない」という理由で作成が失敗する、RLSの
--      “鶏と卵”問題が発生した。projects_select_memberに「auth.uid() = created_by」を
--      許可条件として追加し解消した（下記6.参照）
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. projects（プロジェクト本体）
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

-- tasksと同じく、UPDATE時にupdated_atを自動更新する
-- （関数set_updated_atはsupabase-schema.sqlで既に作成済みのため、ここではトリガーの追加のみでよい）
drop trigger if exists set_projects_updated_at on projects;
create trigger set_projects_updated_at
  before update on projects
  for each row execute procedure public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. project_members（プロジェクトとメンバーの多対多の中間テーブル）
--    task_assignees（supabase-schema.sql 3.）と同じ「中間テーブルで多対多を表す」パターン
-- -----------------------------------------------------------------------------
create table if not exists project_members (
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  primary key (project_id, user_id)
);

-- 「自分が参加しているプロジェクト一覧」（サイドバー・プロジェクト管理タブ）をuser_idから
-- 逆引きするクエリを高速化する索引（主キーはproject_id側が先頭のため、user_id単独の
-- 検索には別途索引が必要。idx_tasks_end_dateと同じ考え方）
create index if not exists idx_project_members_user_id on project_members(user_id);


-- -----------------------------------------------------------------------------
-- 3. プロジェクト作成時に、作成者を自動的にオーナーとしてproject_membersへ登録するトリガー
--    （要件定義書§2.2「作成すると、作成者が自動的にproject_membersへオーナーとして登録される」）
--    handle_new_user（supabase-schema.sql 1.）と同じ「作成をフックして中間テーブルへ
--    自動挿入する」パターン
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer set search_path = public
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
-- 4. オーナー権限の譲渡関数（要件定義書§6.1のSQLをそのまま採用。関数本体のみ、
--    delete_own_account等の既存関数と同じ命名規則に合わせてpublic.を明示）
-- -----------------------------------------------------------------------------
create or replace function public.transfer_project_ownership(p_project_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 呼び出し本人が、このプロジェクトの現オーナーであることを確認
  if not exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'オーナーのみが実行できます';
  end if;

  -- 譲渡先が、既にこのプロジェクトのメンバーであることを確認
  if not exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = p_new_owner_id
  ) then
    raise exception '譲渡先はこのプロジェクトのメンバーである必要があります';
  end if;

  update public.project_members set role = 'member' where project_id = p_project_id and user_id = auth.uid();
  update public.project_members set role = 'owner' where project_id = p_project_id and user_id = p_new_owner_id;
end;
$$;

grant execute on function public.transfer_project_ownership(uuid, uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- 5. tasks.project_id列の追加と、既存タスクの移行（要件定義書§3.3・§3.4）
-- -----------------------------------------------------------------------------

-- まずはNULL許容で列を追加する（移行が終わるまではNOT NULLにできないため）。
-- on delete cascadeを付けているのは、退会フロー（要件定義書§6.2）で「自分1人だけの
-- プロジェクト」を削除する際、そのプロジェクトのタスクも連動して消えるようにするため
-- （project_membersのon delete cascadeと同じ考え方。§3.3の元のSQLには無い追加分）
alter table tasks add column if not exists project_id uuid references projects(id) on delete cascade;

-- 既存タスクを「（移行前タスク）」という既定プロジェクトへ一括移行する
-- （要件定義書§3.4：現在の全ユーザーをメンバーとする既定プロジェクトを1つ自動作成し、
--   既存タスクのproject_idをそのIDで一括更新する）
do $$
declare
  v_default_project_id uuid;
  v_first_user_id uuid;
begin
  -- 既定プロジェクトの作成者（＝オーナー）は、一番古く登録したユーザーとする
  -- （要件定義書に明記が無いため、ここで仮決め。作成すると3.のトリガーでproject_membersへ
  -- 自動的にownerとして登録される）
  select id into v_first_user_id from profiles order by created_at asc limit 1;

  -- ユーザーが1人もいない（まっさらな環境）場合は、移行対象のタスクも存在しないため何もしない
  if v_first_user_id is not null then
    insert into projects (name, description, status, created_by)
    values (
      '（移行前タスク）',
      'プロジェクト管理機能の導入前に作成されていた既存タスクの移行先として自動生成されたプロジェクトです。',
      'active',
      v_first_user_id
    )
    returning id into v_default_project_id;

    -- 既存の全ユーザーをこの既定プロジェクトのメンバー（member）として登録する
    -- （作成者は3.のトリガーで既にownerとして登録済みのため、on conflictで重複を回避）
    insert into project_members (project_id, user_id, role)
    select v_default_project_id, id, 'member' from profiles
    on conflict (project_id, user_id) do nothing;

    -- project_idが未設定の既存タスクを、すべてこの既定プロジェクトへ割り当てる
    update tasks set project_id = v_default_project_id where project_id is null;
  end if;
end $$;

-- 移行が完了したので、以降のタスク作成では必ずプロジェクトが必須になるようNOT NULL制約を付与
alter table tasks alter column project_id set not null;

-- 3画面（ダッシュボード／タスクボード／スケジュール）がproject_idで絞り込むクエリを
-- 高速化する索引（idx_tasks_end_dateと同じ考え方。§3.3の元のSQLには無い追加分）
create index if not exists idx_tasks_project_id on tasks(project_id);


-- -----------------------------------------------------------------------------
-- 6. RLS：projects・project_members（要件定義書§7.1）
--
--    projects_select_member 等の判定を素朴なEXISTS句で書くと、project_membersの
--    SELECTポリシー自身がproject_membersを自己参照する形になり、Postgresの
--    「recursive RLS policy」の罠にかかる（初回実行時に実際に発生し、既存タスクが
--    画面から見えなくなった）。is_project_member() / is_project_owner()という
--    security definerのヘルパー関数（RLSをバイパスして判定する）に判定ロジックを
--    切り出すことで回避する
-- -----------------------------------------------------------------------------
alter table projects enable row level security;
alter table project_members enable row level security;

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

-- projects：閲覧はメンバーのみ／作成はログイン済みなら誰でも／更新・削除はオーナーのみ。
-- 「auth.uid() = created_by」は、作成直後（3.のAFTER INSERTトリガーがproject_membersへ
-- オーナー登録を終える前）でも、作成者本人がRETURNINGで自分の行を受け取れるようにするため
-- （§9-4のプロジェクト作成機能実装時に実際に発生した、RLSの“鶏と卵”問題の修正）
create policy "projects_select_member" on projects
  for select to authenticated
  using (public.is_project_member(id) OR auth.uid() = created_by);

create policy "projects_insert_authenticated" on projects
  for insert to authenticated
  with check (auth.uid() = created_by);

create policy "projects_update_owner" on projects
  for update to authenticated
  using (public.is_project_owner(id));

create policy "projects_delete_owner" on projects
  for delete to authenticated
  using (public.is_project_owner(id));

-- project_members：閲覧はメンバーのみ／追加はオーナーのみ
create policy "project_members_select_member" on project_members
  for select to authenticated
  using (public.is_project_member(project_id));

create policy "project_members_insert_owner" on project_members
  for insert to authenticated
  with check (public.is_project_owner(project_id));

-- 削除：オーナーは他のメンバーを削除できる／メンバー本人は自分の行を削除して脱退できる。
-- ただし「role = 'owner'」の行そのものは、本人であっても直接削除できないようにする
-- （要件定義書§7.4「オーナーは他の誰かに譲渡するまで自主的に脱退できない」をDB側でも保証する。
-- オーナー交代は4.のtransfer_project_ownership()でroleをmemberに変えてから削除する想定。
-- §7.1の元の記述には無い追加の安全策）
create policy "project_members_delete_owner_or_self" on project_members
  for delete to authenticated
  using (
    role <> 'owner'
    and (user_id = auth.uid() or public.is_project_owner(project_id))
  );

-- ロール変更（オーナー譲渡）自体に対する直接のUPDATEポリシーはあえて作らない。
-- 4.のtransfer_project_ownership()（security definerのためテーブル所有者としてRLSを
-- バイパスする）を必ず経由させることで、「呼び出し本人が現オーナーであること」の検証を
-- 迂回されないようにする


-- -----------------------------------------------------------------------------
-- 7. tasksの既存RLSポリシーに「プロジェクトのメンバーであること」の条件を追加
--    （要件定義書§7.1・§7.2。supabase-schema.sqlで作成した4ポリシーを置き換える。
--    こちらも6.と同じ理由でis_project_member()経由にする）
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

-- 削除は「作成者本人であること」（既存方針）に加えて、プロジェクトのメンバーであることも
-- 条件に加える（作成者がプロジェクトから脱退した後の想定漏れを防ぐ安全策）
drop policy if exists "tasks_delete_own" on tasks;
create policy "tasks_delete_own_project_member" on tasks
  for delete to authenticated
  using (auth.uid() = created_by and public.is_project_member(project_id));


-- =============================================================================
-- ここまで実行したら完了です。次のステップ（要件定義書§9-3）で、App.tsxに
-- currentProjectIdを追加し、ダッシュボード／タスクボード／スケジュールの問い合わせに
-- project_idの絞り込みを追加します。
-- =============================================================================
