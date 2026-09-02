# WORK PLUS 詳細設計書（認証・DB編）

この文書は、Supabase（PostgreSQL + Auth + Storage）まわりの認証設計・DBスキーマ・RLS
（行レベルセキュリティ）ポリシーの詳細設計書です。「なぜこの実装になっているか」という
非自明な設計判断・落とし穴を中心に記録しています。

設計書ファミリーの中での位置づけは`基本設計書.md`の対応表を参照してください。全体
アーキテクチャ・画面一覧・機能ごとのファイル対応は`基本設計書.md`、プロジェクト管理機能の
要件そのものは`要件定義書_プロジェクト管理機能.md`を参照してください。開発中に実際に
発生した不具合の経緯・トラブルシューティングの物語は`学習ノート.md`9章に移設しました。

作成日：2026-08-20
2026-09-02：`docs/`配下へ移動し、`基本設計書.md`との役割分担に合わせて再構成（旧
`認証・DB設計書.md`）。実装計画・実装後の経過報告など役目を終えた記述を整理し、
現在も有効な設計内容だけを残した

---

## 1. 認証設計

- サインアップ／ログインはメールアドレス＋パスワード方式（Supabase Authの`signUp` /
  `signInWithPassword` / `signOut`をそのまま使用）
- **新規登録はオープン方式**：誰でもメールアドレスとパスワードだけで登録できる（招待制にはしない）
- **メールアドレス確認は必須**（Supabase Authのデフォルト設定をそのまま使用）。確認メール内の
  リンクをクリックするまではログインできない
- ログイン状態（セッション）はSupabaseクライアントが自動的に管理し、`App.tsx`は
  `onAuthStateChange`イベントを購読して`isAuthenticated`と連動させる
- **ゲスト（匿名）ログイン**：Supabase Auth標準の匿名認証（`signInAnonymously`）を利用。
  ポートフォリオサイト経由の訪問者が、会員登録なしでその場でアプリを試せるようにするための
  導線（`Login.tsx`）。匿名ユーザーもPostgRESTに対しては通常の`authenticated`ロールとして
  扱われるため、RLSポリシー側の変更は不要
  - Supabaseダッシュボード側で「Anonymous sign-ins」を有効化する必要がある（設定変更後は
    必ず保存すること。保存し忘れると`Anonymous sign-ins are disabled`エラーになる）
  - `handle_new_user`トリガー（2.1参照）は、匿名ユーザーは`email`が`NULL`になるため、
    表示名のフォールバックとして「`ゲスト` + ユーザーIDの先頭4文字」を3番目の候補として持つ

---

## 2. データベーススキーマ設計

### 2.1 `profiles`（ユーザーのプロフィール）

Supabase Authの`auth.users`（認証専用テーブル）とは別に、表示名・アバターURLなどアプリ側で
使う情報を持つテーブルを`auth.users`と1対1で紐づけるのがSupabaseの定番パターン。

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now()
);
```

新規登録時に自動で1行作られるよう、トリガー`handle_new_user`で`auth.users`への追加をフックする。

```sql
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
```

3番目のフォールバック（`'ゲスト' || ...`）は匿名ユーザー対応で後から追加したもの。`email`が
`NULL`だと2番目のフォールバック（`split_part(new.email, '@', 1)`）も失敗し、`display_name`が
`NULL`になってNOT NULL制約違反でユーザー作成自体が失敗するため。

`avatar_url`列はプロフィール機能追加時に`supabase-migration-profile.sql`で後から追加。
保存先（Storageバケット）は2.6を参照。

### 2.2 `tasks`（タスク本体）

```sql
create table tasks (
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
  project_id uuid references projects(id) on delete cascade not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

`project_id`はプロジェクト管理機能導入時に追加した列（4.3参照）。`assignees`（担当者）は
下記2.3のように別テーブルに分ける（多対多の関係を中間テーブルで表す標準的な設計）。

### 2.3 `task_assignees`（タスクと担当者の中間テーブル）

```sql
create table task_assignees (
  task_id uuid references tasks(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (task_id, user_id)
);
```

フロントエンド側は`tasks`と結合して取得し、`assignees: string[]`の形に組み立て直す。
保存は差分計算をせず、**保存の都度いったん全削除してから作り直す方式**にしている（既存行との
差分を計算してupsertするより実装がシンプルで壊れにくいと判断。デメリットはサブタスクの`id`が
編集の度に変わる点だが、他でその`id`を参照する箇所は無いため実害は無い）。

### 2.4 `task_subtasks`（サブタスク＝タスク内のチェックリスト項目）

```sql
create table task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  title text not null,
  done boolean not null default false,
  created_at timestamptz default now()
);
```

親タスク（`tasks`）が削除されたら`on delete cascade`で紐づくサブタスクも自動的に削除される。
独自の期日・承認フローは持たせない設計方針（`基本設計書.md`のデータモデル参照）。表示順は
`created_at`の昇順。`task_assignees`と同じく、保存は全削除→再作成方式。

### 2.5 スケジュール画面向けの索引

```sql
create index idx_tasks_end_date on tasks(end_date);
```

「スケジュール」タブは新しいテーブルを必要とせず、既存の`tasks.end_date`で絞り込むだけの画面。
表示中の月の範囲で期日を検索するクエリが頻繁に発生するため索引を張っている。祝日ハイライトは
`holidays-jp`という外部の公開API（秘密キー不要）をフロントエンドから直接呼び出すだけで、
Supabase側には一切データを持たせていない。

### 2.6 `avatars`ストレージバケット（アバター画像）

```sql
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
```

保存パスは`{ユーザーID}/avatar`形式で、ユーザー1人につき1ファイルを`upsert`（同じパスへの
再アップロードで上書き）する運用。RLSポリシーは「自分のユーザーIDのフォルダにのみ書き込み・
更新・削除できる」（`(storage.foldername(name))[1] = auth.uid()::text`で判定）、かつ
「誰でも閲覧できる」（`public`バケットのため）という内容（`supabase-migration-profile.sql`）。
アップロード後の公開URLは末尾にタイムスタンプ（`?t=...`）を付けて`profiles.avatar_url`に
保存し、同じファイル名で上書きしてもブラウザのキャッシュが古い画像を表示し続けないようにしている。

### 2.7 `projects`（プロジェクト本体）

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

`status`は進行中／完了／アーカイブの3値。オーナー自体はこのテーブルには持たせず、2.8の
`project_members`側の`role`列で管理する。プロジェクト作成時、作成者を自動的にオーナーとして
`project_members`へ登録するトリガー`handle_new_project`（`handle_new_user`と同じ「INSERT→
トリガーで関連行を自動作成」のパターン）を用意している。

### 2.8 `project_members`（プロジェクトとメンバーの中間テーブル）

```sql
create table project_members (
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz default now(),
  primary key (project_id, user_id)
);
```

`task_assignees`と同じ、多対多を表す中間テーブルの設計パターン。`role`は`owner` / `member`の
2値のみで、組織全体の管理者ロールのような上位ロールは導入していない（`要件定義書_プロジェクト
管理機能.md`§7.3。将来必要になれば`profiles.app_role`のような列を後乗せする拡張性は
確保してある）。

`tasks.project_id`は`on delete cascade`のため、プロジェクトを削除すると配下のタスクもまとめて
削除される（退会時の自分1人だけのオーナープロジェクト削除〈2.10〉が、この挙動を利用している）。

### 2.9 `transfer_project_ownership`関数（オーナー譲渡）

```sql
create or replace function public.transfer_project_ownership(p_project_id uuid, p_new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'オーナーのみがこの操作を行えます';
  end if;

  if not exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = p_new_owner_id
  ) then
    raise exception '譲渡先は既にメンバーである必要があります';
  end if;

  update project_members set role = 'member' where project_id = p_project_id and user_id = auth.uid();
  update project_members set role = 'owner' where project_id = p_project_id and user_id = p_new_owner_id;
end;
$$;

grant execute on function public.transfer_project_ownership(uuid, uuid) to authenticated;
```

`security definer`関数（2.11参照）で、呼び出し本人が現オーナーであること・譲渡先が既に
メンバーであることを関数内で検証してからロールを入れ替える。`MemberManagementModal.tsx`の
オーナー譲渡ボタンのほか、退会前のオーナー引き継ぎ（`OwnershipHandoverSection.tsx`）からも
同じ関数を再利用している。

### 2.10 `delete_own_account`関数（退会）

Supabaseの匿名キー（anon key）では`auth.users`テーブルの行を直接削除できない（自分自身の
行であっても）ため、`security definer`関数を経由し、`auth.uid()`で本人のIDに限定した上で
削除を行う。

```sql
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 自分がオーナーで、かつ他に誰もメンバーがいない（＝自分1人だけの）プロジェクトを
  -- タスクごとまとめて削除する（他にメンバーがいる場合は、フロント側〈OwnershipHandoverSection.tsx〉
  -- で退会前に新オーナーへの譲渡を済ませてから退会する運用のため、ここでは対象にしない。
  -- ただし念のためSQL側でも「他のメンバーがいないこと」を確認しており、
  -- フロント側の譲渡漏れがあっても他人のプロジェクトを巻き込まない二重の安全策になっている）
  delete from public.projects
  where id in (
    select pm.project_id from public.project_members pm
    where pm.user_id = auth.uid() and pm.role = 'owner'
    and not exists (
      select 1 from public.project_members pm2
      where pm2.project_id = pm.project_id and pm2.user_id <> auth.uid()
    )
  );

  delete from public.tasks where created_by = auth.uid();
  update public.tasks set reviewer_id = null where reviewer_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
```

フロントエンド側（`App.tsx`の`handleDeleteAccount`）では、この関数を呼ぶ前に必ずパスワードで
再認証（`signInWithPassword`）を行い、`window.confirm`による確認ダイアログも挟む。
`auth.users`の行を削除すると`profiles`テーブルの対応行も`on delete cascade`で自動的に
削除される。

### 2.11 `security definer`関数についての方針

`delete_own_account` / `transfer_project_ownership` / `is_project_member`などは、いずれも
`security definer`（関数の定義者の権限で実行される）パターンを使っている。**新しく
`security definer`関数を追加する場合は、必ず関数内で`auth.uid()`により呼び出し本人の権限を
確認すること**（`.claude/rules/supabase.md`のルール）。RLSをバイパスする分、関数内の検証が
唯一の防波堤になるため。

---

## 3. RLS（行レベルセキュリティ）ポリシー設計

### 3.1 `tasks` / `task_assignees` / `task_subtasks`

**「そのタスクが所属するプロジェクトのメンバーだけが見られる・操作できる」**方式。

- `tasks`：SELECT / INSERT / UPDATEは`is_project_member(project_id)`、DELETEは作成者
  （`created_by`）のみ（誤操作で他人のタスクを消せてしまうのを防ぐための最低限の安全策）
- `task_assignees` / `task_subtasks`：`task_id`列はあるが`project_id`列を持たないため、
  `task_id`から所属プロジェクトを辿るヘルパー関数`is_task_project_member(task_id)`を使い、
  `tasks`と同じ「プロジェクトメンバーのみ」方式に揃える（SELECT / INSERT / DELETE。
  `task_subtasks`はUPDATEも同様）

```sql
create or replace function public.is_task_project_member(p_task_id uuid)
returns boolean language sql security definer set search_path = public stable
as $$ select public.is_project_member(project_id) from tasks where id = p_task_id; $$;
```

`is_project_member`と同じく`security definer`でRLSをバイパスするため、呼び出し元が対象タスクの
所属プロジェクトのメンバーでなければ（＝`tasks`側で本来見えない行であれば）`project_id`が
`null`扱いとなり、`is_project_member(null)`は常に`false`を返して正しく拒否される。

**教訓（重要）**：中間テーブル・子テーブルに`project_id`列を持たせず親テーブル経由で
プロジェクトを判定する設計にした場合、**親テーブル（`tasks`）のRLSポリシーを変更したら、
その親を参照する全ての中間テーブル・子テーブルのRLSポリシーも同時に見直すこと**。
新しい参照テーブルを追加した際は、関連テーブル一覧を洗い出してから着手するのが望ましい
（実際にこの見直しが漏れて`task_assignees` / `task_subtasks`だけ更新されずに残っていた
経緯は`学習ノート.md`9.6参照）。

### 3.2 `projects` / `project_members`

**「自分が参加しているプロジェクトだけが見える・操作できる」**方式。

- `projects`
  - SELECT：自分がメンバー（`is_project_member`）、または自分が作成者（`created_by`）
  - UPDATE / DELETE：自分がオーナー（`is_project_owner`）のときのみ
- `project_members`
  - SELECT：自分がメンバーであるプロジェクトの行のみ
  - INSERT：自分がオーナーであるプロジェクトへのみ（メンバー追加はオーナー限定）
  - DELETE：自分がオーナー（他メンバーの削除）、または自分自身の行（脱退）。ただし
    `role = 'owner'`の行は本人でも直接削除できない（オーナー交代は`transfer_project_ownership`
    関数経由のみ）

判定に使う`is_project_member(p_project_id)` / `is_project_owner(p_project_id)`は
`security definer`のヘルパー関数として切り出している。

```sql
create or replace function public.is_project_member(p_project_id uuid)
returns boolean language sql security definer set search_path = public stable
as $$ select exists (select 1 from project_members where project_id = p_project_id and user_id = auth.uid()); $$;

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean language sql security definer set search_path = public stable
as $$ select exists (select 1 from project_members where project_id = p_project_id and user_id = auth.uid() and role = 'owner'); $$;
```

**なぜヘルパー関数を経由するか**：`projects` / `project_members`のポリシー内で
`project_members`テーブルを素朴な`EXISTS`句で自己参照すると、そのテーブル自身のSELECT
ポリシーを評価する際に条件がまた同じテーブルを参照する循環が生まれ、Postgresの
「recursive RLS policy」エラー、あるいは意図しない全件非表示という形で症状が出る。
`security definer`関数の内部クエリはRLSの対象外（関数定義者の権限で実行される）ため、この
ループが起きない。**同じテーブルを素朴な`EXISTS`で自己参照するRLSポリシーを書く場合は、
必ずこのパターンでヘルパー関数を経由させること**。

**RLSの「鶏と卵」問題への対処**：`.insert().select().single()`のようなRETURNINGは、SELECT用の
RLSポリシーの可視性チェックも受ける。作成直後に走るAFTER INSERTトリガー（`handle_new_project`
がオーナーとして`project_members`へ登録する処理など）の完了を待たずにこのチェックが走ると、
「作成した本人なのに、まだメンバー登録が完了していないので見えない」という形で失敗する。
このため`projects_select_member`には「`auth.uid() = created_by`」も許可条件として加えている。

```sql
create policy "projects_select_member" on projects
  for select to authenticated
  using (public.is_project_member(id) OR auth.uid() = created_by);
```

**同じ組み合わせ（INSERT直後にAFTER INSERTトリガーが別テーブルへ権限系の行を追加し、かつ
RETURNINGでその場で結果を返す）のRLSポリシーを書くときは、この鶏と卵問題を疑うこと**。

### 3.3 `profiles`

ログイン済みユーザーは全員、すべてのプロフィールを閲覧できる（担当者・確認者の候補表示に
必要なため）。自分の行のみ更新できる。

---

## 4. 運用メモ

- **マイグレーションファイルの命名**：`supabase-migration-<内容>.sql`。実行後はこの文書の
  該当セクションに反映する（`.claude/rules/supabase.md`）
- **RLSで防いでいる操作は、UI側の条件分岐でも一致させる**：DB側の権限とフロントのボタン表示・
  非表示を必ず揃える
- Supabaseダッシュボードで「Anonymous sign-ins」を有効化した場合は、設定を保存し忘れると
  `Anonymous sign-ins are disabled`エラーになる点に注意（1章参照）
