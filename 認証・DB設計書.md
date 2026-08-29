# WORK PLUS 認証・DBバックエンド設計書（④）

この文書は、④（認証機能＋データベース導入）を実装する前に、設計方針を先に固めておくための
設計書です。

**ステータス：実装完了（コア機能）・動作確認中**（8章の実装ステップ1〜4が完了し、
デバイス上での動作確認も一部進んでいます。詳細は10章「実装後の補足」を参照してください）。
**2026-08-29追加：プロジェクト管理機能を実装（11章参照）。0章で「対象外」としていた
スコープを解禁した**

作成日：2026-08-20
確定日：2026-08-20（4点の要確認事項に回答をもらい、内容を確定）

### 更新履歴

- 2026-08-22：「スケジュール画面」「サブタスク（チェックリスト）機能」を反映。サブタスク用に
  4.4`task_subtasks`テーブルを新設し、5章にそのRLSポリシーを追加。スケジュール画面自体は
  既存の`tasks.end_date`列をそのまま使うため新しいテーブルは不要だが、カレンダー表示の
  クエリを想定した索引（4.5）を追加
- 2026-08-23：8章の実装ステップ1〜4（Supabaseプロジェクト作成〜App.tsx非同期化）を実装完了。
  実機でサインアップ・サインイン・タスク新規作成までの動作確認済み。実装時に判明した追加の
  RLSポリシー・実際に発生した不具合と対処などを10章に追記
- 2026-08-25：プロフィール機能（表示名編集・アバター画像アップロード）用の`profiles.avatar_url`
  列と`avatars`ストレージバケットを追加（4.1・4.6）。退会（アカウント削除）機能用の
  `delete_own_account`関数を追加（4.7）
- 2026-08-29：**「プロジェクト管理」機能を実装**（11章に新設。0章で「対象外」としていた
  スコープを解禁）。`projects` / `project_members`テーブルを新設し、`tasks`に`project_id`
  （NOT NULL）を追加。実装時に発生した2件のRLS不具合（再帰的RLS参照・INSERT直後のRETURNING
  と鶏と卵になる可視性チェック）と、その対処を11章にまとめて記録した。`delete_own_account`
  関数も、退会時に自分1人だけのオーナープロジェクトを削除するステップを追加する形で拡張した

---

## 0. この設計書の対象範囲

- 対象：④ 認証機能＋データベース移行（ログイン・ユーザー登録・タスクの実データ永続化・
  ユーザー間の実共有）
- 【2026-08-29追記】当初「対象外」としていた③（サイドバーの新規タブ機能のうち
  「プロジェクト管理」）は、その後実装しました。設計・スキーマは11章にまとめています。
  なお「スケジュール」タブは2026-08-22時点で③のうち実装済みとなっており、既存の
  `tasks.end_date`列を読むだけの画面のため、この設計書のスキーマに影響はありません（4.5参照）。
- そのため、2〜10章で設計しているデータベースのスキーマ（テーブル構成）は、**当時の
  `仕様書.md`に書かれていた機能（タスク管理・カンバン・ダッシュボード・通知ベル・
  スケジュール画面・サブタスク〈チェックリスト〉）がそのまま動くこと**を目標にした、
  必要最小限の構成でした。プロジェクト管理機能に伴うテーブル追加・変更は11章にまとめています。

---

## 1. なぜSupabase（PostgreSQL）を選ぶか

MySQL系サービスとの比較を、2026年8月時点であらためて調べた内容としてまとめます。

### 1.1 コスト面の比較

| 選択肢 | 無料枠 | 備考 |
|---|---|---|
| **Supabase**（PostgreSQL） | あり。DB 500MB、Auth月間5万ユーザーまで無料 | ただし**1週間アクセスが無いと自動的に一時停止（Pause）**される。有料化するとPro（月$25）でこの制限が外れる |
| PlanetScale（MySQL） | **無し**（2024年に無料プランを完全廃止済み） | 現在は最安でも月$5程度〜の従量課金。2025年からPostgresにも対応し、MySQL専業ではなくなった |
| Railway（MySQL等を自分でホスト） | 実質無し（お試し$5クレジットのみ） | その後は月$5程度〜の従量課金 |
| AWS RDS for MySQL | 恒久無料枠は無し（新規は$200クレジットのみ） | その後は通常課金 |
| GCP Cloud SQL / Azure Database for MySQL | 期間限定の無料トライアルのみ | トライアル終了後は月1,000円台〜 |

結論として、**「無料で使えるMySQLホスティング」は2026年時点でほぼ存在しません**。ポート
フォリオ用途で費用をかけたくない場合、Supabaseの無料枠（1週間アクセスが無いと一時停止する
制約はあるが、面接前にアクセスすれば復帰する程度の話）の方が現実的です。

### 1.2 技術面の比較

- SupabaseはPostgreSQLというデータベースを使っています。PostgreSQLはMySQLと同じ
  「リレーショナルデータベース（表形式でデータを管理し、SQLで操作する）」の一種で、
  機能面でMySQLに劣る部分はなく、むしろこのアプリの要件（後述）には向いています。
- 決め手になるのが **RLS（Row Level Security＝行レベルセキュリティ）** という機能です。
  「このユーザーは、このテーブルのこの行だけ見て良い／編集して良い」というルールを
  データベース自体に直接書き込める仕組みで、「担当者だけがタスクを見られる」
  「レビュアーだけが承認できる」といった、このアプリでまさに必要になる制御と非常に
  相性が良いです。MySQLには標準でこれに相当する機能が無く、同じことをやろうとすると
  アプリ側（サーバーのコード）で毎回チェックを書く必要があり、実装量・バグの入り込む
  余地が増えます。
- SupabaseはDB（PostgreSQL）だけでなく、**認証（Auth）・ファイルストレージ・
  リアルタイム更新（Realtime）** もセットになっており、今回のようにログイン機能を
  ゼロから作る場合、認証周り（パスワードのハッシュ化・セッション管理・パスワード
  リセットメール送信など、本来はセキュリティ的に難易度が高い部分）を自作せずに済みます。
  MySQLを選ぶ場合、これらは基本的に全部自分で実装するか、別サービス（Auth0やClerkなど）
  と組み合わせる必要があり、開発量が大きく増えます。

### 1.3 結論・提案

**このアプリはSupabase（PostgreSQL）のまま進めることを提案します。** フロントエンド
採用向けのポートフォリオという目的を考えると、認証やインフラの自作に時間を使うよりも、
「実際に動く、複数ユーザーが使えるアプリ」を早く完成させて、フロントエンドの作り込み
（UI/UX・状態管理・型安全性など）に時間を使う方が費用対効果が高いと考えます。

もし「MySQLの実務経験としてアピールしたい」という理由がある場合は、この本体アプリの
バックエンドをMySQLに変更するのではなく、**別の小さなお試しプロジェクト**（例：簡単な
CRUD APIをNode.js＋MySQLで作る等）として切り出す方が、労力に対して得られるアピール
効果が高いと思います（本体アプリの設計変更＋認証の自作という大工事をしなくて済むため）。

---

## 2. 全体アーキテクチャ

現状（localStorage版）と、移行後の構成を比較します。

```
【現状】
React (App.tsx) ──── localStorage（このブラウザ内だけで完結）

【移行後】
React (App.tsx) ──── Supabaseクライアント(@supabase/supabase-js)
                          │
                          ├─ Auth（ログイン・ユーザー登録・セッション管理）
                          └─ Database（PostgreSQL、RLSでアクセス制御）
```

独自のサーバー（Node.js/Expressなど）は挟まず、**フロントエンドから直接Supabaseを呼び出す**
構成にします。これがSupabaseの標準的な使い方で、アクセス制御はサーバーコードではなく
RLSポリシー（DB側の設定）で行います。実装がシンプルになり、フロントエンド中心の
ポートフォリオという方針とも合っています。

---

## 3. 認証設計

- サインアップ／ログインは、現状の`Login.tsx`と同じ**メールアドレス＋パスワード方式**を
  想定しています（`Login.tsx`は現在、入力チェックのみのダミー実装です）。
- Supabase Authの`signUp` / `signInWithPassword` / `signOut`をそのまま使います。
- パスワードリセットもSupabase Auth標準機能（リセットメール送信）を利用します。
- ログイン状態（セッション）はSupabaseクライアントが自動的に管理し、ブラウザを閉じても
  維持されます。現状の`App.tsx`の`isAuthenticated`ステートは、Supabaseの
  `onAuthStateChange`イベントを購読する形に置き換えます。
- **【確定】新規登録はオープン方式**：誰でもメールアドレスとパスワードだけで登録できるように
  します（招待制にはしません）。一般的なWebサービスの標準的な方式でもあり、個人のポート
  フォリオ用途としても妥当な選択です。
- **【確定】メールアドレス確認を必須にする**：登録後、確認メール内のリンクをクリックする
  まではログインできない方式にします。Supabase Authはデフォルトでこの「確認必須」設定に
  なっているので、追加の実装は不要です（Supabase側の管理画面の設定を変えない限り、
  そのまま有効になります）。フロント側では、サインアップ直後に「確認メールを送信しました。
  メール内のリンクをクリックしてください」という案内画面を`Login.tsx`に追加する必要が
  あります（実装時に対応します）。

---

## 4. データベーススキーマ設計

現状の`Task`型・`User`型（`src/types/task.ts`）をベースに、リレーショナルDB向けに
設計し直します。

### 4.1 `profiles`（ユーザーのプロフィール）

Supabase Authは`auth.users`という認証専用のテーブルを内部で管理しますが、そこには
「表示名」のような情報は持たせません。アプリ側で使う名前などは別テーブル（`profiles`）を
用意し、`auth.users`と1対1で紐づけるのがSupabaseの定番パターンです。

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now()
);
```

新規登録時に自動で`profiles`に1行作られるよう、DB側の「トリガー」という仕組みで
`auth.users`への追加をフックします（実装時に用意します）。

`avatar_url`列は当初のスキーマには無く、プロフィール機能（表示名編集・アバター画像アップロード）の
追加にあわせて`supabase-migration-profile.sql`で後から追加した列です。アバター画像本体の
保存先（Storageバケット）については4.6を参照してください。

### 4.2 `tasks`（タスク本体）

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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

現状の`Task`型とほぼ対応していますが、`assignees`（担当者の配列）だけは次の4.3のように
別テーブルに分けます。

### 4.3 `task_assignees`（タスクと担当者の中間テーブル）

現状は`assignees: string[]`という配列でしたが、リレーショナルDBで「1つのタスクに複数の
担当者」「1人のユーザーが複数のタスクを担当」という多対多の関係を表す場合は、間に
中間テーブルを挟むのが標準的な設計です。

```sql
create table task_assignees (
  task_id uuid references tasks(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (task_id, user_id)
);
```

フロントエンド側では、この2つのテーブルを結合して取得すれば、今までと同じ
`assignees: string[]`に近い形に組み立て直せます（Supabaseのクエリで一緒に取得できます）。

### 4.4 `task_subtasks`（サブタスク＝タスク内のチェックリスト項目）

2026-08-22に追加された「サブタスク（チェックリスト）」機能（`仕様書.md`5章・6.7参照）に
対応するテーブルです。この設計書の確定時点（2026-08-20）にはまだ無かった機能のため、
今回追加しました。

```sql
create table task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  title text not null,
  done boolean not null default false,
  created_at timestamptz default now()
);
```

- 親タスク（`tasks`）が削除されたら、`on delete cascade`により紐づくサブタスクも自動的に
  削除されます。
- フロントエンドの`Subtask`型（`id` / `title` / `done`）と対応しており、独自の期日や
  承認フローを持たせない、という現状の設計方針（`仕様書.md`5章）をそのまま踏襲しています。
- 表示順は`created_at`の昇順（＝追加した順）で並べれば、現状のUIの並び順と一致します。
  ドラッグ並べ替えのような機能を将来追加する場合は、`position`列を追加する拡張を想定しています。

### 4.5 スケジュール画面（月間カレンダー）向けの索引

「スケジュール」タブ（`ScheduleView.tsx`）は新しいテーブルを必要とせず、既存の`tasks`テーブルを
`end_date`（期日）で絞り込んで表示するだけの画面です。ただし、表示中の月の範囲で期日を検索する
クエリが頻繁に発生するため、`end_date`列に索引（インデックス）を張っておくことを推奨します。

```sql
create index idx_tasks_end_date on tasks(end_date);
```

なお、祝日ハイライトは`holidays-jp`という外部の公開API（秘密キー不要）をフロントエンドから
直接`fetch`しているだけで、Supabase側には一切データを持たせません（8章参照）。

### 4.6 `avatars`ストレージバケット（アバター画像）

プロフィール画像は、DBのテーブルではなくSupabase Storageの公開バケットに保存します。

```sql
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
```

保存パスは`{ユーザーID}/avatar`という形式で、ユーザー1人につき1ファイルを`upsert`
（同じパスに再アップロードすると上書き）する運用にしています。RLSポリシーは
「自分のユーザーIDのフォルダにのみ書き込み・更新・削除できる」
（`(storage.foldername(name))[1] = auth.uid()::text`で判定）、かつ「誰でも閲覧できる」
（`public`バケットのため）という内容で、`supabase-migration-profile.sql`にまとめています。
アップロード後の公開URLは`getPublicUrl()`で取得し、末尾にタイムスタンプ（`?t=...`）を付けて
`profiles.avatar_url`に保存することで、同じファイル名で上書きしてもブラウザのキャッシュが
古い画像を表示し続けないようにしています。

### 4.7 退会（アカウント削除）用の関数

Supabaseの匿名キー（anon key）では、`auth.users`テーブルの行を直接削除することはできません
（自分自身の行であっても）。そのため、退会機能は`security definer`（関数の定義者の権限で実行
される）Postgres関数を経由し、`auth.uid()`で本人のIDに限定した上で削除を行う設計にしています。

```sql
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.tasks where created_by = auth.uid();
  update public.tasks set reviewer_id = null where reviewer_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
```

フロントエンド側（`App.tsx`の`handleDeleteAccount`）では、この関数を呼ぶ前に必ずパスワードで
再認証（`signInWithPassword`）を行い、`window.confirm`による確認ダイアログも挟んでいます。
`auth.users`の行を削除すると、`profiles`テーブルの対応行も`on delete cascade`で自動的に
削除されます。このSQLは`supabase-migration-account-deletion.sql`にまとめています。

---

## 5. RLS（行レベルセキュリティ）ポリシー設計

現状のアプリ（localStorage版）は、実質「フィルターは表示上の絞り込みだけで、誰でも全
タスクを見たり操作したりできる」という、社内の小さなチームが1つの掲示板を共有している
ようなモデルです。**【確定】この考え方をそのまま踏襲し、「ログインしていれば全員が
全タスクを見られる」方式にします。** 以下のポリシーで実装します。

- **閲覧（SELECT）**：ログイン済みのユーザーは全員、すべてのタスクを閲覧できる
  （＝チーム全体で1つの掲示板を共有するイメージ。個人ごとに完全に隔離はしない）
- **作成（INSERT）**：ログイン済みのユーザーは誰でも新規タスクを作成できる
- **更新（UPDATE）**：ログイン済みのユーザーは誰でも更新できる（現状のドラッグ＆ドロップや
  承認操作を、誰でも行える今の挙動を踏襲）
- **削除（DELETE）**：作成者（`created_by`）のみ削除できる（誤操作で他人のタスクを
  消せてしまうのを防ぐための、最低限の安全策）

`task_subtasks`（サブタスク）については、チェックリストの追加・チェック切替・削除は
「タスクを編集する」という操作の一部（`TaskForm.tsx`内で誰でも行える操作）という位置づけの
ため、`tasks`の**UPDATE**と同じ考え方を採用します。

- **閲覧（SELECT）**：ログイン済みのユーザーは全員、すべてのサブタスクを閲覧できる
- **作成・更新・削除（INSERT / UPDATE / DELETE）**：ログイン済みのユーザーは誰でも行える
  （`tasks`のUPDATEと同じ「誰でも編集できる」方針を踏襲。個別の削除制限は設けない）

**将来の拡張メモ**：「管理者だけが全員分を見られて、一般メンバーは自分の関係するタスクしか
見えない」のような、役職（ロール）ベースの厳格な制御は、今回は導入しません。ただし
`profiles`テーブルに将来`role`列（例：`admin` / `member`）を追加すれば、RLSポリシーの
条件式にその列を組み込むだけで拡張できる設計にしてあるので、必要になったタイミングで
無理なく追加できます。

---

## 6. 既存localStorageデータの移行方針

現状ブラウザのlocalStorageに保存されているタスクは、テスト用のサンプルデータです。
**【確定】移行スクリプトは作らず、DB移行後はクリーンな状態から始めます**（サンプル
タスクが必要であれば、移行後に手動で作り直します）。移行用の変換コードを書かずに済むため、
実装がシンプルになります。

---

## 7. フロントエンド側の変更点（概要）

- `Login.tsx`：ダミー実装から、Supabase Authを呼び出す実装に置き換える。メール確認必須の
  ため、サインアップ直後は「確認メールを送信しました」という案内表示に切り替える状態を
  追加する
- `App.tsx`：
  - `tasks`のstateを、Supabaseから取得したデータで初期化・更新する形に変更
  - `handleSaveTask` / `handleDeleteTask` / `handleUpdateStatus` / `handleProcessAction`は、
    今は同期的に`setTasks`するだけですが、Supabase呼び出しは非同期（`await`が必要）に
    なるため、それぞれ非同期関数に変更する
  - `isAuthenticated`のstateを、Supabaseのセッション状態と連動させる
  - `mockUsers`を、実際に登録された`profiles`テーブルの内容に置き換える
- `TaskForm.tsx`：サブタスクの追加・チェック切替・削除（`handleAddSubtask`等）を、
  `tasks`本体の保存とあわせて`task_subtasks`テーブルへのSupabase呼び出しに置き換える
  （タスク保存と同じタイミングでまとめて反映するか、都度即時反映するかは実装時に決める）
- `ScheduleView.tsx`：祝日API（`holidays-jp`）の呼び出しは変更なし（Supabase化の対象外）。
  タスク取得は`App.tsx`側で共通に取得したものを引き続き利用するだけで、この画面固有の
  変更は基本的に不要です
- 環境変数：SupabaseのプロジェクトURLと公開APIキー（anon key）を`.env`ファイルに
  保存し、コードに直書きしない（`.gitignore`で除外されているか確認する）

---

## 8. 実装ステップ（案）

1. ✅ Supabaseプロジェクトを作成し、環境変数を設定する
2. ✅ 上記のテーブル（`profiles` / `tasks` / `task_assignees` / `task_subtasks`）とRLSポリシー、
   および`tasks.end_date`への索引（4.5）を作成する（`supabase-schema.sql`として実装）
3. ✅ `@supabase/supabase-js`を導入し、`Login.tsx`を実際の認証処理に置き換える
4. ✅ `App.tsx`のタスク操作をSupabase経由に置き換える（読み込み・作成・更新・削除）
5. 🔄 動作確認中（複数アカウントでログインして、タスクが共有されることを確認）：
   サインアップ・サインイン・タスク新規作成までは実機で確認済み。タスクの編集・削除・
   承認フロー（申請／承認／差し戻し）・サブタスクのSupabase連携・設定ページの
   サンプルデータリセットは、今後順次確認していく予定
6. ✅ `仕様書.md`を更新する（2026-08-23、この設計書とあわせて更新）
7. ⬜（任意・余力があれば）Supabase Realtimeを使い、他のユーザーの操作がリアルタイムで
   画面に反映されるようにする（ポートフォリオとしての見栄えが良くなる発展機能。着手指示待ち）

---

## 9. 確定した設計判断のまとめ

当初「要確認」としていた4点は、以下の内容で確定しました。

- 3章：新規登録は**オープン方式**（誰でも登録可能。招待制にはしない）
- 3章：メールアドレス確認は**必須**（Supabase Authのデフォルト設定をそのまま使用）
- 5章：RLSポリシーは**「ログインしていれば全員が全タスクを見られる」方式**を維持
  （役職ベースの厳格な制御は、必要になった時点で`profiles.role`列を追加して拡張）
- 6章：既存localStorageデータは**移行しない**（DB移行後はクリーンな状態から開始）

この4点が確定したことで、この設計書の設計内容は固まりました。以降の実装状況は10章に記録しています。

---

## 10. 実装後の補足（2026-08-23）

8章のステップ1〜4を実装した際の、実際のファイル構成・設計書からの差分・発生した不具合を記録します。

### 10.1 実際に追加・変更したファイル

| ファイル | 役割 |
|---|---|
| `supabase-schema.sql`（プロジェクトルート） | 4テーブル・トリガー2つ（`handle_new_user` / `set_updated_at`）・RLSポリシー一式・`idx_tasks_end_date`索引をまとめたSQLマイグレーション。Supabase側のSQL Editorで1回実行する運用 |
| `supabase-migration-profile.sql`（プロジェクトルート） | `profiles.avatar_url`列・`avatars`ストレージバケット・そのRLSポリシー（4.6参照）。SQL Editorで1回実行 |
| `supabase-migration-account-deletion.sql`（プロジェクトルート） | 退会機能用の`delete_own_account`関数（4.7参照）。SQL Editorで1回実行 |
| `.env.example` | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`のプレースホルダー（Gitにコミットする） |
| `.env`（Git管理外） | 実際のProject URL・anon keyを入れる本番用の設定ファイル。`.gitignore`に追加済み |
| `src/vite-env.d.ts` | 上記2つの環境変数をTypeScriptに認識させる型定義（`規約.md`の「型を安易に緩めない」方針に沿って追加） |
| `src/lib/supabaseClient.ts` | `createClient`で作った`supabase`インスタンスをexportする、唯一のSupabaseクライアント生成箇所 |

### 10.2 設計書の時点には無かった実装判断

- **`profiles` / `task_assignees`のRLSポリシー**：4章のスキーマ設計時点ではRLSポリシーの記述が
  無かったが、RLSを有効化すると明示的にポリシーを作らない限り「全アクセス拒否」になるため、
  実装時に必要と判明し追加した（5章に反映済み）。
- **`task_assignees` / `task_subtasks`は「保存の都度、全削除→再挿入」方式**：既存行との差分を
  計算してupsertするより実装がシンプルで壊れにくいと判断し、この方式を採用した。デメリットは
  編集の度にサブタスクの`id`が変わる点だが、サブタスクの`id`を他で参照する箇所は無いため実害は無い。
- **タスク操作後は毎回サーバーから再取得（`refreshTasks()`）**：楽観的にローカルstateだけ
  更新する方式ではなく、Supabaseへの書き込み後に必ずサーバーの最新状態を読み直す方式にした。
  レスポンスの体感速度よりも、この環境ではUIをテストできない（npm実行環境が無い）という制約下での
  正しさ・堅牢性を優先した判断。
- **サンプルデータリセットの挙動変更**：`localStorage`版では「全タスクを削除して初期サンプルに
  戻す」処理だったが、複数ユーザーでデータを共有する仕様になったため、**自分（`created_by`）が
  作成したタスクのみ**を削除・再作成する仕様に変更した。他ユーザーのタスクには影響しない。

### 10.3 実装中に発生した不具合と対処

- **現象**：タスクを新規作成すると`400`エラーになる。
- **原因**：確認者（レビュアー）の候補は「担当者に選ばれていないユーザー」から絞り込む仕様
  だが（5章・`仕様書.md`6.7参照）、Supabase移行直後はユーザーが自分1人しかいないため候補が
  0人になり、`TaskForm.tsx`側の`reviewerId`が空文字列（`''`）のまま送信されていた。
  `tasks.reviewer_id`はuuid型の列のため、空文字列を送るとPostgres側で
  `invalid input syntax for type uuid`エラーとなり、PostgREST経由では`400`として現れていた。
- **対処**：`App.tsx`の`handleSaveTask`内で、`taskData.reviewerId ?? null`（`??`は`undefined`/
  `null`しかnullに変換しない）を`taskData.reviewerId || null`（空文字列も含めてnullに変換する）
  に修正した。ユーザーが2人以上登録されれば、確認者候補も通常通り選べるようになる。

### 10.4 今後の確認・課題

- タスクの編集・削除・承認フロー（申請／承認／差し戻し）・通知ベル・サブタスクのSupabase連携・
  設定ページのサンプルデータリセットは、まだ実機での動作確認が済んでいない（8章の5参照）。
- 確認者候補が0人になる制約（`仕様書.md`8章）は、Supabase移行後も引き続き残っている。実際の
  ユーザー登録が増えるまでは、確認者欄が空欄のままタスクを作成することになる（想定通りの挙動）。
- Supabase Realtime対応（8章の7）は未着手。着手する場合は明示的な指示を待つ。
- `supabase-migration-profile.sql`と`supabase-migration-account-deletion.sql`（4.6・4.7）は、
  Supabase側のSQL Editorで実行済みかどうかを別途確認する必要がある。未実行の場合、アバター
  アップロードと退会機能はそれぞれ失敗する。

---

## 11. プロジェクト管理機能（2026-08-29）

0章で当初「対象外」としていた「プロジェクト管理」機能を実装した際の設計・スキーマをまとめます。
要件は`プロジェクト管理機能_要件定義書.md`（1〜9章）を参照してください。この章はDB設計・
実装に関する記録に絞ります。

### 11.1 `projects`（プロジェクト本体）

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

`status`は進行中／完了／アーカイブの3値です（要件定義書で当初2値案としていたものを、
実装前に3値案へ訂正）。オーナー自体はこのテーブルには持たせず、11.2の`project_members`側の
`role`列で管理します。

### 11.2 `project_members`（プロジェクトとメンバーの中間テーブル）

```sql
create table project_members (
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz default now(),
  primary key (project_id, user_id)
);
```

`task_assignees`（4.3）と同じ、多対多を表す中間テーブルの設計パターンです。`role`は
`owner` / `member`の2値のみで、組織全体の管理者ロールのような上位ロールは今回導入しません
（要件定義書§7.3。将来必要になれば`profiles.app_role`のような列を後乗せする拡張性は
確保してあります）。

プロジェクト作成時、作成者を自動的にオーナーとして本テーブルへ登録するトリガー
（`handle_new_project`。`handle_new_user`と同じ「INSERT→トリガーで関連行を自動作成」の
パターン）を用意しています。

### 11.3 `tasks.project_id`（既存テーブルへの列追加）

```sql
alter table tasks add column project_id uuid references projects(id) on delete cascade;
-- 既存タスクを既定プロジェクト（「（移行前タスク）」）へ一括移行してから、
-- not null制約を付ける（3.4参照・要件定義書§3.4）
alter table tasks alter column project_id set not null;
```

`on delete cascade`にしているため、プロジェクトを削除すると配下のタスクもまとめて削除されます
（退会時に自分1人だけのオーナープロジェクトを削除する処理〈11.6〉が、この挙動を利用しています）。

移行時、現在の全ユーザーをメンバーとする既定プロジェクト「（移行前タスク）」を1つ自動作成し、
既存の全タスクの`project_id`をそのIDで一括更新してから、`not null`制約を付けています
（要件定義書§3.4）。既定プロジェクトの`created_by`（＝初期オーナー）は、要件定義書に定めが
無かったため、一番古く登録したユーザーとする実装判断をしました（あくまで暫定値で、移行後に
プロジェクト名変更・タスクの再配分は自由に行える前提）。

### 11.4 `transfer_project_ownership`関数（オーナー譲渡）

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

`delete_own_account`（4.7）と同じ`security definer`パターンです。呼び出し本人が現オーナーで
あること・譲渡先が既にメンバーであることをこの関数内で検証してから、ロールを入れ替えます。
`MemberManagementModal.tsx`のオーナー譲渡ボタンから呼ばれるほか、退会前のオーナー引き継ぎ
（`OwnershipHandoverSection.tsx`。11.6参照）からも同じ関数を再利用しています。

### 11.5 RLSポリシー設計

`projects` / `project_members`は、5章で確立した「ログインしていれば全員が見られる」方式とは
異なり、**「自分が参加しているプロジェクトだけが見える・操作できる」**という、このアプリで
初めての行レベルの隔離を導入しました。

- `projects`
  - SELECT：自分がメンバー（`is_project_member`）、または自分が作成者（`created_by`）
  - UPDATE / DELETE：自分がオーナー（`is_project_owner`）のときのみ
- `project_members`
  - SELECT：自分がメンバーであるプロジェクトの行のみ
  - INSERT：自分がオーナーであるプロジェクトへのみ（メンバー追加はオーナー限定）
  - DELETE：自分がオーナー（他メンバーの削除）、または自分自身の行（脱退）。ただし
    `role = 'owner'`の行は本人でも直接削除できない（オーナー交代は11.4の関数経由のみ）
- `tasks` / `task_assignees` / `task_subtasks`
  - 5章の「ログインしていれば全員」方式から、「そのタスクが所属するプロジェクトのメンバーのみ」
    方式に変更（`is_project_member(project_id)`ベース）

判定に使う`is_project_member(p_project_id)` / `is_project_owner(p_project_id)`は、
`security definer`のヘルパー関数として切り出しています（11.5.1で理由を説明）。

#### 11.5.1 発生した不具合と対処（実装時に判明）

**① 再帰的RLSポリシー（recursive RLS policy）**

初版のRLSポリシーでは、`projects` / `project_members` / `tasks`のポリシー内で
`project_members`テーブルを素朴な`EXISTS`句で自己参照していました。

```sql
-- 問題のあった書き方（イメージ）
using (exists (select 1 from project_members where project_id = projects.id and user_id = auth.uid()))
```

`project_members`自身のSELECTポリシーを評価する際に、そのポリシー条件がまた`project_members`を
参照する、という循環が発生し、Postgresの「recursive RLS policy」エラー、あるいは意図しない
全件非表示（既存タスクが画面から見えなくなる）という形で症状が出ました。

**対処**：判定ロジックを`security definer`のヘルパー関数に切り出しました。

```sql
create or replace function public.is_project_member(p_project_id uuid)
returns boolean language sql security definer set search_path = public stable
as $$ select exists (select 1 from project_members where project_id = p_project_id and user_id = auth.uid()); $$;

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean language sql security definer set search_path = public stable
as $$ select exists (select 1 from project_members where project_id = p_project_id and user_id = auth.uid() and role = 'owner'); $$;
```

`security definer`関数の内部クエリはRLSの対象外（関数定義者の権限で実行される）のため、
自己参照によるループが起きません。**同じテーブルを素朴な`EXISTS`で自己参照するRLSポリシーを
書く場合は、必ずこのパターンでヘルパー関数を経由させること**（今後、同じ構造のポリシーを
追加する際の教訓として記録）。

**② RLSの「鶏と卵」問題（INSERT直後のRETURNINGが自分の作成物を見られない）**

プロジェクト新規作成が「新しい行が行レベルセキュリティポリシーに違反しています」
（RLS違反、`42501`）で失敗する不具合が発生しました。原因はINSERT自体ではなく、
`.insert().select().single()`のRETURNINGが、作成直後に走る`handle_new_project`トリガー
（作成者をオーナーとして`project_members`へ登録する処理）の完了を待たずに、SELECT用RLS
ポリシー（`projects_select_member`）の可視性チェックを受けてしまい、「作成した本人なのに、
まだメンバー登録が完了していないので見えない」と判定される、という一種の「鶏と卵」問題でした。

**対処**：`projects_select_member`に「`auth.uid() = created_by`」も許可条件として追加しました。

```sql
create policy "projects_select_member" on projects
  for select to authenticated
  using (public.is_project_member(id) OR auth.uid() = created_by);
```

**同じ組み合わせ（INSERT直後にAFTER INSERTトリガーが別テーブルへ権限系の行を追加し、かつ
RETURNINGでその場で結果を返す）のRLSポリシーを書くときは、この鶏と卵問題を疑うこと**
（メンバー追加後に何か即座に返す処理を書く場合も同様の注意が必要）。

### 11.6 `delete_own_account`関数の拡張（退会×オーナー引き継ぎ）

要件定義書§6.2に基づき、退会時に自分がオーナーで他に誰もメンバーがいない（＝自分1人だけの）
プロジェクトを、タスクごとまとめて削除するステップを、4.7の`delete_own_account`関数に追加
しました（`supabase-migration-account-deletion-owner-handover.sql`）。

```sql
-- delete_own_account()内、既存の3ステップの前に追加
delete from public.projects
where id in (
  select pm.project_id from public.project_members pm
  where pm.user_id = auth.uid() and pm.role = 'owner'
  and not exists (
    select 1 from public.project_members pm2
    where pm2.project_id = pm.project_id and pm2.user_id <> auth.uid()
  )
);
```

他にメンバーがいるオーナープロジェクトは、退会前にフロント側（`OwnershipHandoverSection.tsx`）で
新オーナーへの譲渡を済ませてから退会する運用のため、この関数の削除対象には含めません。ただし
念のため「他のメンバーがいないこと」をSQL側でも確認してから削除しており、フロント側の譲渡漏れが
あっても他人のプロジェクトを巻き込んで削除してしまわない、二重の安全策にしています。
`tasks.project_id`が`on delete cascade`（11.3）のため、プロジェクトを削除すれば配下のタスクも
まとめて削除されます。

### 11.7 実際に追加・変更したファイル

| ファイル | 役割 |
|---|---|
| `supabase-migration-projects.sql` | `projects` / `project_members`テーブル、`handle_new_project`トリガー、`transfer_project_ownership`関数、`tasks.project_id`列追加＋既存タスクの移行、RLSポリシー一式（11.5の修正を織り込み済み）を1ファイルに統合 |
| `supabase-migration-projects-rls-fix.sql` | 11.5.1①（再帰的RLS）の修正の履歴用ファイル（内容は上記に統合済み） |
| `supabase-migration-projects-select-fix.sql` | 11.5.1②（鶏と卵問題）の修正の履歴用ファイル（内容は上記に統合済み） |
| `supabase-migration-account-deletion-owner-handover.sql` | 11.6の`delete_own_account`関数拡張 |

### 11.8 実装後の補足

- 上記11.5.1の2件の不具合は、いずれもSupabase側では発見時点で都度修正・動作確認済みです。
  `supabase-migration-projects.sql`本体も、将来別環境にゼロから流し直す場合に同じ不具合が
  起きないよう、最初から修正済みの内容（ヘルパー関数経由）にしてあります。
- `supabase-migration-account-deletion-owner-handover.sql`は、ユーザーがSupabase側のSQL
  Editorで実行済みです。ただし、実際に退会を最後まで実行して自分1人だけのプロジェクトが
  削除されることの確認（エンドツーエンドのテスト）は、「テストが大変なので後で」という
  理由で保留中です（`仕様書.md`8章参照）。
- ロール管理は「プロジェクト単位のオーナー／メンバー」のみを実装し、組織全体の管理者ロールは
  設計のみ（要件定義書§7.3）に留めています（YAGNI判断）。
