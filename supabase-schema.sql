-- =============================================================================
-- WORK PLUS: Supabase スキーマ作成スクリプト
-- -----------------------------------------------------------------------------
-- 使い方：Supabaseダッシュボード → 左メニュー「SQL Editor」→「New query」で
-- このファイルの中身をすべて貼り付けて「Run」を押してください。
-- 一度に全部実行して問題ありません（テーブル作成→索引→RLS有効化→ポリシーの順）。
--
-- 対応するドキュメント：docs/詳細設計書_認証DB編.md（2章・3章）
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. profiles（ユーザーのプロフィール。auth.usersと1対1で紐づく）
-- -----------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz default now()
);

-- 新規登録（auth.usersへの行追加）が起きたら、自動的にprofilesにも1行作る仕組み。
-- display_nameは、サインアップ時にフロントから渡す user_metadata.display_name を使う。
-- 万一渡し忘れた場合は、メールアドレスの@より前を仮の表示名として使う。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 2. tasks（タスク本体）
-- -----------------------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null check (status in ('todo', 'doing', 'review', 'done')),
  category text not null check (category in ('開発', 'デザイン', 'マーケ', 'その他')),
  start_date date not null,
  end_date date not null,
  priority text not null check (priority in ('low', 'medium', 'high')),
  reviewer_id uuid references profiles(id),
  return_reason text,
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- スケジュール画面（月間カレンダー）が期日で絞り込むクエリを高速化する索引
create index if not exists idx_tasks_end_date on tasks(end_date);

-- UPDATE時にupdated_atを自動更新するトリガー（JS側で毎回セットしなくて済むようにする）
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tasks_updated_at on tasks;
create trigger set_tasks_updated_at
  before update on tasks
  for each row execute procedure public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. task_assignees（タスクと担当者の多対多の中間テーブル）
-- -----------------------------------------------------------------------------
create table if not exists task_assignees (
  task_id uuid references tasks(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (task_id, user_id)
);


-- -----------------------------------------------------------------------------
-- 4. task_subtasks（サブタスク＝タスク内のチェックリスト項目）
-- -----------------------------------------------------------------------------
create table if not exists task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  title text not null,
  done boolean not null default false,
  created_at timestamptz default now()
);


-- -----------------------------------------------------------------------------
-- 5. RLS（行レベルセキュリティ）を有効化
-- -----------------------------------------------------------------------------
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table task_assignees enable row level security;
alter table task_subtasks enable row level security;

-- profiles：ログイン済みなら全員閲覧可。自分の行だけ更新可
-- （design.mdの5章には明記が無かったが、RLSを有効化すると既定で全操作が
--   拒否されるため、担当者名を表示するために最低限これらのポリシーが必要）
create policy "profiles_select_authenticated" on profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on profiles
  for update to authenticated using (auth.uid() = id);

-- tasks：ログイン済みなら誰でも閲覧・作成・更新可。削除は作成者のみ
create policy "tasks_select_authenticated" on tasks
  for select to authenticated using (true);
create policy "tasks_insert_authenticated" on tasks
  for insert to authenticated with check (true);
create policy "tasks_update_authenticated" on tasks
  for update to authenticated using (true);
create policy "tasks_delete_own" on tasks
  for delete to authenticated using (auth.uid() = created_by);

-- task_assignees：tasksのUPDATE方針（誰でも編集できる）を踏襲
create policy "task_assignees_select_authenticated" on task_assignees
  for select to authenticated using (true);
create policy "task_assignees_insert_authenticated" on task_assignees
  for insert to authenticated with check (true);
create policy "task_assignees_delete_authenticated" on task_assignees
  for delete to authenticated using (true);

-- task_subtasks：サブタスクの追加・チェック切替・削除は「タスクの編集」の一部という
-- 位置づけのため、tasksのUPDATEと同じ「誰でも編集できる」方針を採用
create policy "task_subtasks_select_authenticated" on task_subtasks
  for select to authenticated using (true);
create policy "task_subtasks_insert_authenticated" on task_subtasks
  for insert to authenticated with check (true);
create policy "task_subtasks_update_authenticated" on task_subtasks
  for update to authenticated using (true);
create policy "task_subtasks_delete_authenticated" on task_subtasks
  for delete to authenticated using (true);


-- =============================================================================
-- ここまで実行したら、Supabaseダッシュボード → Authentication → Providers で
-- 「Confirm email」が有効になっていることを確認してください（デフォルトで有効なはず）。
-- 次は .env.example を .env にコピーし、Settings → API のURLとanon keyを設定します。
-- =============================================================================
