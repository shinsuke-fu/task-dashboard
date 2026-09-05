-- =============================================================================
-- WORK PLUS: ゲストアカウントのログアウト時、他メンバーがいてもプロジェクトごと
-- 削除するようにする（delete_own_account()の置き換え）マイグレーション（2026-09-05）
-- -----------------------------------------------------------------------------
-- 使い方：Supabaseダッシュボード → 左メニュー「SQL Editor」→「New query」で
-- このファイルの中身をすべて貼り付けて「Run」を押してください。
-- supabase-migration-account-deletion-owner-handover.sql を実行済みのプロジェクトに対する
-- 追加分です（delete_own_account()関数を丸ごと置き換えます）。
--
-- 【何が変わるか・なぜ変えるか】
-- これまでの実装は、ゲスト（匿名）・実アカウントどちらの場合も「自分1人だけのプロジェクト」
-- しか削除しなかった（ステップ7）。実アカウントの退会では、他にメンバーがいるオーナー
-- プロジェクトは事前にフロント側（設定＞データのオーナー引き継ぎセクション）で
-- 譲渡してから退会する運用のため、これで正しい。
--
-- 一方ゲストのログアウトは、ユーザーの方針として「ログアウトしたらタスクもプロジェクトも
-- アカウントも全部消えてよい。ゲストのプロジェクトに他の登録ユーザーが参加していた
-- としても、そのプロジェクトごと削除して構わない（他メンバーもろとも消えてよい）」と
-- 明示的に決定した（2026-09-05）。ゲストはそもそもデモ用途の使い捨てアカウントであり、
-- ゲストが作ったプロジェクトを他の実アカウントが後々も使い続ける想定は無いため。
--
-- そのためdelete_own_account()を、呼び出し元が匿名アカウントかどうかで分岐する実装に
-- 変更する：
--   - 匿名アカウント（ゲスト）の場合：自分がオーナーのプロジェクトは、他にメンバーが
--     いても問答無用で削除する（project_members・tasksともにprojects.idへの
--     on delete cascadeにより連鎖的に削除される。§3.3・§3.6参照）
--   - 実アカウント（退会）の場合：これまで通り「自分1人だけのプロジェクト」のみ削除する
--     （他にメンバーがいるプロジェクトは、フロント側の引き継ぎフローが済んでいる前提。
--     もし何らかの理由で済んでいなくても、supabase-migration-projects-created-by-
--     nullable.sql適用後はcreated_byがNULLになるだけで外部キー制約違反にはならない）
--
-- 【なぜクライアント側から渡すパラメータではなくauth.usersのis_anonymous列で判定するか】
-- 「ゲストかどうか」を呼び出し側（RPCの引数）から渡す設計にすると、実アカウントの
-- ユーザーがブラウザの開発者ツール等から直接RPCを呼び、本来必要なオーナー引き継ぎを
-- 経ずに他人の共有プロジェクトを消してしまえる抜け道になってしまう。関数内部で
-- auth.users.is_anonymous（Supabase Authの匿名サインイン機能が管理する列。フロント側の
-- session.user.is_anonymousと同じ実体）を都度サーバー側で確認することで、実際に匿名
-- アカウントである場合にのみ「丸ごと削除」の挙動になるようにする。
-- =============================================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_anonymous boolean;
begin
  select is_anonymous into v_is_anonymous from auth.users where id = auth.uid();

  if v_is_anonymous then
    -- 【ゲスト（匿名）アカウント】自分がオーナーのプロジェクトは、他にメンバーが
    -- いても問答無用で削除する（ユーザーの明示的な方針決定：2026-09-05）。
    -- project_members・tasks（task_assignees・task_subtasksもtasks経由でさらに
    -- cascade）はいずれもprojects.idへのON DELETE CASCADEのため、まとめて消える
    delete from public.projects
    where id in (
      select pm.project_id
      from public.project_members pm
      where pm.user_id = auth.uid()
        and pm.role = 'owner'
    );
  else
    -- 【実アカウント（退会）】自分1人だけの（＝他に誰もメンバーがいない）プロジェクト
    -- のみ削除する。他にメンバーがいるオーナープロジェクトは、退会前にフロント側で
    -- 新オーナーへ譲渡済みである前提だが、念のため「他のメンバーがいないこと」を
    -- ここでも確認してから削除する（二重の安全策。ステップ7から変更なし）
    delete from public.projects
    where id in (
      select pm.project_id
      from public.project_members pm
      where pm.user_id = auth.uid()
        and pm.role = 'owner'
        and not exists (
          select 1 from public.project_members pm2
          where pm2.project_id = pm.project_id and pm2.user_id <> auth.uid()
        )
    );
  end if;

  -- 1. 自分が作成したタスクを削除
  --    （上記で削除されなかったプロジェクト内のタスクのうち、自分が作成したもの。
  --    task_assignees・task_subtasksはON DELETE CASCADEで自動的に一緒に消える）
  delete from public.tasks where created_by = auth.uid();

  -- 2. 他人が作成したタスクの確認者(reviewer_id)に自分が設定されている場合、
  --    そのタスクは削除せず、reviewer_idだけをNULLに戻す
  --    （reviewer_idはprofiles参照でON DELETE CASCADEを付けていないため、
  --    このステップを飛ばすと次のprofiles削除が外部キー制約で失敗する）
  update public.tasks set reviewer_id = null where reviewer_id = auth.uid();

  -- 3. auth.usersから自分自身を削除
  --    （profilesはauth.users参照でON DELETE CASCADEのため自動的に一緒に消える。
  --    project_members.user_idもON DELETE CASCADEのため、他人がオーナーの
  --    プロジェクトに自分がメンバーとして残っていた場合も自動的に脱退扱いになる）
  delete from auth.users where id = auth.uid();
end;
$$;

-- ログイン済みユーザーなら誰でもこの関数を呼び出せるようにする
-- （関数の中で auth.uid() を使っているため、実際に削除できるのは常に「自分自身」だけ）
grant execute on function public.delete_own_account() to authenticated;


-- =============================================================================
-- ここまで実行したら完了です。
-- 動作確認方法：他の登録ユーザーをメンバーに追加したプロジェクトのオーナーである
-- ゲストアカウントでログアウトし、①ゲストのauth.users行、②そのプロジェクト自体、
-- ③そのプロジェクト内のタスク、④他メンバーのproject_members行（そのプロジェクトの
-- 分のみ）が、すべて削除されている（＝他メンバー側から見てもそのプロジェクトが
-- 一覧から消えている）ことを確認してください。
-- 一方、実アカウントの退会は従来通り「自分1人だけのプロジェクト」しか削除されず、
-- 他にメンバーがいるオーナープロジェクトは引き続きオーナー引き継ぎが必須のままである
-- ことも合わせて確認してください。
-- =============================================================================
