-- =============================================================================
-- supabase-migration-projects-select-fix.sql
-- -----------------------------------------------------------------------------
-- 【役割】
--   プロジェクト新規作成機能（ステップ4）実装後に発生した「プロジェクトの作成に
--   失敗しました」（RLS違反、42501）の修正差分のみを切り出したファイル（実際に
--   Supabase上で実行し、動作確認済み）。
--
-- 【発生していた不具合】
--   `.insert({...}).select('id').single()`でプロジェクトを新規作成すると、
--   INSERT自体は成功する条件でも、RETURNINGの結果を返す段階でRLS違反エラーに
--   なっていた（with_checkを一時的に`true`にしても再現したため、INSERT側の
--   条件式が原因ではないと判明）。
--
--   原因は、プロジェクト作成直後に走るAFTER INSERTトリガー
--   （handle_new_project()。作成者を自動的にオーナーとしてproject_membersへ
--   登録する処理）が完了する“前”に、RETURNINGの結果がSELECT用のRLSポリシー
--   （projects_select_member：`is_project_member(id)`）で可視性チェックされて
--   しまい、「作成した本人なのに、まだproject_membersに登録されていないので
--   見えない」と判定されていたこと。作成直後の一瞬だけ生じる、RLSの
--   「鶏と卵」問題だった。
--
-- 【切り分けの記録（次回同種の問題に当たったときのため）】
--   1. INSERT用ポリシーのwith_checkを一時的に`true`にしても同じエラーが
--      再現したため、INSERT側の条件式は原因ではないと判明
--   2. `returning`を外した素のINSERTだけを試したところ成功したため、
--      RETURNINGの可視性チェックが原因だと確定した
--
-- 【対策】
--   projects_select_memberに「auth.uid() = created_by」を許可条件として追加。
--   作成者本人は、トリガーの完了を待たず常に自分の作成物を見られるようにする
--   （本来的にも自然な権限であり、副作用の無い恒久的な修正）。
--
--   supabase-migration-projects.sql本体も、この修正を最初から織り込んだ最終版に
--   更新済みなので、新規に環境を構築する場合はこのファイルは不要
--   （supabase-migration-projects.sql一本で足りる）。
-- =============================================================================

drop policy if exists "projects_select_member" on projects;
create policy "projects_select_member" on projects
  for select to authenticated
  using (public.is_project_member(id) OR auth.uid() = created_by);
