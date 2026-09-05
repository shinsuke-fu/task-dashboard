-- =============================================================================
-- WORK PLUS: 既存の放置ゲスト（匿名）データを一括削除する、一回限りのお掃除用SQL（2026-09-05）
-- -----------------------------------------------------------------------------
-- 【重要】これは恒久的な関数ではなく、今たまっている過去のゲストデータを一度きり
-- 掃除するための手動実行スクリプトです。今後発生する分は
-- supabase-migration-account-deletion-guest-full-cleanup.sql（delete_own_account()の
-- 修正）が自動的に処理します。まだ実行していない場合は、先にそちらと
-- supabase-migration-projects-created-by-nullable.sql の2本を実行してから、
-- このファイルを実行してください（順序はどちらでも実害はありませんが、
-- 恒久対応を先に入れておいたほうが安心です）。
--
-- 【やること】
-- 現在DBに残っている「匿名（ゲスト）アカウント」全員分について、
--   1. 匿名ユーザーがオーナーのプロジェクトを、他にメンバーがいるかどうかに関わらず
--      丸ごと削除（tasks・project_members・task_assignees・task_subtasksもcascadeで
--      連鎖的に削除される）
--   2. 上記で消えなかったプロジェクト（他人がオーナー）に、匿名ユーザーが作成した
--      タスクが残っていれば削除
--   3. 他人のタスクの確認者(reviewer_id)に匿名ユーザーが設定されていればNULLに戻す
--      （FK制約対策。これをやらないと次のauth.users削除が失敗する）
--   4. auth.usersから匿名ユーザーを全員削除（profilesはON DELETE CASCADEで自動的に消える）
-- を一括で行います。delete_own_account()のゲスト分岐と同じロジックを、
-- 「自分1人」ではなく「今存在する匿名ユーザー全員」に対して一度に適用するイメージです。
--
-- 【追加：メンバー0人の孤立プロジェクトについて（2026-09-05追記）】
-- project_members側の「role='owner'の行は本人でも直接削除できない」というRLS
-- （project_members_delete_owner_or_self）は、アプリの画面操作からの削除だけを防ぐもの。
-- Supabaseダッシュボードの「Authentication > Users」から直接ユーザーを削除した場合や、
-- 過去（この一連の修正が入る前）の`delete_own_account()`のテスト時などは、
-- auth.usersの削除がprofiles→project_membersへON DELETE CASCADEで連鎖するため、
-- 「role='owner'の行」であっても関係なく一緒に消えてしまう。その結果、
-- project_membersが0行＝誰もオーナーもメンバーもいないのに`projects`の行だけが
-- 残ってしまうことがある。この状態になるとRLS上「自分がメンバー」という条件を
-- 満たす人が誰もいなくなるため、アプリの画面（プロジェクト管理タブの削除ボタン等）
-- からは二度と削除できなくなる。ステップ5で、そうした「メンバー0人」のプロジェクトを
-- 汎用的に（ゲスト由来か実アカウント由来かを問わず）まとめて削除する。
--
-- 【実行前に】件数を確認したい場合は、まず下の確認用クエリだけを選択して実行し、
-- 影響範囲を確認してから本体のDELETE文を実行することをおすすめします。
-- この操作は元に戻せません。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 事前確認用（実行しても何も削除されません。件数を見るだけ）
-- -----------------------------------------------------------------------------
select
  (select count(*) from auth.users where is_anonymous = true) as guest_user_count,
  (select count(*) from public.projects p
     where exists (
       select 1 from public.project_members pm
       join auth.users u on u.id = pm.user_id
       where pm.project_id = p.id and pm.role = 'owner' and u.is_anonymous = true
     )
  ) as guest_owned_project_count,
  (select count(*) from public.projects p
     where not exists (
       select 1 from public.project_members pm where pm.project_id = p.id
     )
  ) as zero_member_orphaned_project_count;

-- -----------------------------------------------------------------------------
-- ここから本体（実行すると削除されます）
-- -----------------------------------------------------------------------------

-- 1. 匿名ユーザーがオーナーのプロジェクトを丸ごと削除
delete from public.projects
where id in (
  select pm.project_id
  from public.project_members pm
  join auth.users u on u.id = pm.user_id
  where pm.role = 'owner' and u.is_anonymous = true
);

-- 2. 上記で消えなかった（＝他人がオーナーの）プロジェクトに残る、匿名ユーザー作成のタスクを削除
delete from public.tasks
where created_by in (select id from auth.users where is_anonymous = true);

-- 3. 他人のタスクの確認者が匿名ユーザーになっている場合、NULLに戻す
update public.tasks
set reviewer_id = null
where reviewer_id in (select id from auth.users where is_anonymous = true);

-- 4. 匿名ユーザーをauth.usersから削除（profiles等はON DELETE CASCADEで連鎖的に消える）
delete from auth.users
where is_anonymous = true;

-- 5. メンバーが1人もいない（オーナー不在の）孤立プロジェクトを削除
--    （ゲスト由来か実アカウント由来かを問わない。project_membersが0行の時点で
--    「誰のものでもない」ため、削除して問題ない。tasks等はON DELETE CASCADEで連鎖的に消える）
delete from public.projects p
where not exists (
  select 1 from public.project_members pm where pm.project_id = p.id
);

-- =============================================================================
-- ここまで実行したら完了です。
-- 確認方法：上の事前確認用クエリをもう一度実行し、3つとも0件になっていることを確認
-- してください。
-- =============================================================================
