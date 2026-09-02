# コミットメッセージ案（2026-09-02・task_assignees/task_subtasks RLS修正＋ダッシュボード絞り込み修正）

`fix/task-assignees-subtasks-rls`ブランチ（`feature/project-management`から分岐。①「アプリに
ついて」更新分は`feature/project-management`側で既にコミット・プッシュ済み）での作業を想定した
コミットメッセージ案です。今回は、これに`CLAUDE.md`の未コミット分（ブランチ命名規約への
`fix/`・`refactor/`の明文化。今回のRLS修正とは内容的には無関係ですが、まとめてコミットして
問題ないとユーザー確認済み）もあわせて1つの独立したコミットとして含めています。

（このファイル自体はGitにコミットしない、チャット経由で渡すだけの補助ファイルです）

---

## コミットメッセージ

```
fix: task_assignees/task_subtasksのRLSポリシーがプロジェクト単位になっていない問題を修正

- supabase-migration-projects.sql（プロジェクト管理機能導入）でtasks本体のRLSポリシーは
  is_project_member(project_id)ベースに更新されたが、担当者中間テーブルtask_assigneesと
  サブタスクテーブルtask_subtasksは更新が漏れており、to authenticated using (true)
  （ログイン済みなら誰でも閲覧・追加・削除可）のまま残っていた
- 実害：プロジェクトに無関係な認証済みユーザーでも、select * from task_assignees /
  select * from task_subtasksで全プロジェクト分の担当者対応表・サブタスク文言
  （task_subtasks.title）を横断的に取得でき、task_idが分かればinsert/delete
  （task_subtasksはupdateも）も通ってしまう状態だった
- task_idから所属プロジェクトを辿るsecurity definerヘルパー関数
  is_task_project_member(p_task_id)を新設し、tasks本体と同じ「プロジェクトメンバーのみ」
  方式に揃えた（supabase-migration-task-assignees-subtasks-rls-fix.sql）
- 認証・DB設計書.md 11.5・11.5.1③、仕様書.md 8章のドキュメントも修正済みとして反映

fix: ダッシュボードの「メンバー別稼働状況」が全ユーザーを表示してしまう問題を修正

- App.tsxのusers状態（profilesテーブルを無条件に全件取得）を、DashboardView経由で
  ProgressChart.tsx（メンバー別稼働状況グラフ）・GanttChart.tsxへそのまま渡していたため、
  選択中プロジェクトに無関係な全ユーザー（ログアウト時の削除に失敗して残ったゲストの
  残骸アカウント含む）まで表示されてしまっていた
- TaskForm.tsxのassigneeCandidatesと同じprojectMembersベースの絞り込みパターンで、
  App.tsxにcurrentProjectMembers（選択中プロジェクトのメンバーだけに絞り込んだuser一覧）を
  追加し、DashboardViewへ渡すusersをこれに差し替えた
- 仕様書.md 8章のドキュメントも修正済みとして反映

docs: ブランチ命名規約にfix/・refactor/プレフィックスを明文化

- 個人開発の運用ルールとして、featureだけでなくfix（バグ・セキュリティ修正など、
  素早くmainに戻したいもの）・refactor（挙動を変えない内部整理）のブランチ命名規約を
  CLAUDE.mdに追記した
```

---

## 補足

- **実行が必要なSQLマイグレーション**：`supabase-migration-task-assignees-subtasks-rls-fix.sql`
  （**ユーザー未実行**。Supabaseダッシュボード → SQL Editorで実行してください）
- **コミット前に`npm run build`が通ることの確認をお願いします**（このセッションではビルドを
  実行できないため未確認です）
- あわせて、ダッシュボード画面（メンバー別稼働状況）が選択中プロジェクトのメンバーだけに
  絞り込まれて表示されることの実機確認もお願いします
- `git add` / `git commit` / `git push`はユーザー側で実行してください
  （`fix/task-assignees-subtasks-rls`ブランチ上。対象ファイルは`src/App.tsx`・
  `supabase-migration-task-assignees-subtasks-rls-fix.sql`・`認証・DB設計書.md`・
  `仕様書.md`・`引継ぎメモ.md`・`CLAUDE.md`の6ファイル）
- コミット・プッシュ後、動作確認が済んだら`main`へマージしてください
