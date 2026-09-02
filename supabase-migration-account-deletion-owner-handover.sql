-- =============================================================================
-- WORK PLUS: 退会フローへのオーナー引き継ぎ組み込み（ステップ7）マイグレーション（2026-08-29）
-- -----------------------------------------------------------------------------
-- 使い方：Supabaseダッシュボード → 左メニュー「SQL Editor」→「New query」で
-- このファイルの中身をすべて貼り付けて「Run」を押してください。
-- supabase-migration-account-deletion.sql を実行済みのプロジェクトに対する
-- 追加分です（delete_own_account()関数を丸ごと置き換えます）。
--
-- ※ これまでのRLS関連のsql同期修正（ドキュメント上のファイルを、既にSupabase側に
--   適用済みの内容に追いつかせるだけの対応）とは違い、今回は本当にDB側の関数の
--   中身を新しく変更する必要があります。必ずこのSQLをSupabaseのSQL Editorで
--   実行してください（実行するまでは、退会時に自分1人だけのオーナープロジェクトが
--   削除されずに残ってしまいます）。
--
-- 【何が変わるか】
-- 退会（アカウント削除）時、自分がオーナーで他に誰もメンバーがいない
-- （＝自分1人だけの）プロジェクトを、タスクごとまとめて削除するようにする
-- （docs/要件定義書_プロジェクト管理機能.md §6.2）。他にメンバーがいるオーナー
-- プロジェクトは、退会前にフロント側（設定＞データ画面のオーナー引き継ぎ
-- セクション）で新オーナーへの譲渡を済ませてから退会する運用のため、
-- ここでの削除対象には含めない（念のため「他のメンバーがいないこと」を
-- 条件に含めており、フロント側の譲渡漏れがあっても他人のプロジェクトを
-- 巻き込んで削除してしまわないようにしている＝二重の安全策）
-- =============================================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 0. 【ステップ7で追加】自分がオーナーで、他に誰もメンバーがいない
  --    （＝自分1人だけの）プロジェクトを削除する。
  --    `tasks.project_id`はon delete cascadeのため、配下のタスクもまとめて消える
  --    （task_assignees・task_subtasksもtasks経由でさらにcascadeする）。
  --    他にメンバーがいるオーナープロジェクトは、退会前にフロント側で新オーナーへ
  --    譲渡済みである前提だが、念のため「他のメンバーがいないこと」をここでも
  --    確認してから削除する
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

  -- 1. 自分が作成したタスクを削除
  --    （上記0で削除されなかったプロジェクト内のタスクのうち、自分が作成したもの。
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
-- =============================================================================
