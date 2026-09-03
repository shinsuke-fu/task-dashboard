/**
 * src/hooks/useProjectMembers.ts
 * プロジェクトメンバーの管理（追加・削除・オーナー譲渡）と、カード表示用の
 * メンバー数・タスク進捗の集計（refreshProjectSummaries）をまとめて扱うフック。
 *
 * 選択中プロジェクト・プロジェクト一覧に依存する派生値（currentProjectMembers・
 * projectsNeedingOwnershipHandover等）はuseProjects.ts側のprojects・currentProjectIdと
 * 組み合わせて初めて計算できるため、このフックには含めずApp.tsx側に残す
 * （このフックはprojectMembers等の生の状態と、それを更新する処理のみを持つ）。
 */
import { useState } from 'react';
import type { Project, User } from '../types/task';
import { supabase } from '../lib/supabaseClient';

export function useProjectMembers(users: User[]) {
  // 各プロジェクトのメンバー一覧（user_id・role）とタスク件数・完了数。カードの
  // 「メンバー数」「進捗％」表示に使うほか、TaskForm.tsxの担当者・確認者候補の絞り込みにも
  // 使うため、「プロジェクト管理」タブを開いていなくてもログイン時点で取得しておく
  // （呼び出し元＝App.tsx側のuseEffect参照）
  const [projectMembers, setProjectMembers] = useState<Record<string, { userId: string; role: string }[]>>({});
  const [projectTaskCounts, setProjectTaskCounts] = useState<Record<string, { total: number; done: number }>>({});

  // メンバー管理モーダルの開閉状態。対象プロジェクトはIDだけ保持し、実体はprojectsから
  // 都度参照する（他の編集操作と同様、削除等でprojectsが更新されても参照先がずれない）
  const [memberModalProjectId, setMemberModalProjectId] = useState<string | null>(null);

  // カード表示用の「メンバー数」「タスク進捗」を取得する重めの集計クエリ。RLSにより
  // 絞り込みは不要。タブを開いたときだけ呼び出し、ログイン直後には含めない
  const refreshProjectSummaries = async () => {
    const [membersResult, taskStatsResult] = await Promise.all([
      supabase.from('project_members').select('project_id, user_id, role'),
      supabase.from('tasks').select('project_id, status'),
    ]);

    if (membersResult.error) {
      console.error('プロジェクトメンバーの取得に失敗しました:', membersResult.error);
    } else {
      const membersByProject: Record<string, { userId: string; role: string }[]> = {};
      for (const row of membersResult.data ?? []) {
        (membersByProject[row.project_id] ??= []).push({ userId: row.user_id, role: row.role });
      }
      setProjectMembers(membersByProject);
    }

    if (taskStatsResult.error) {
      console.error('タスク集計の取得に失敗しました:', taskStatsResult.error);
    } else {
      const countsByProject: Record<string, { total: number; done: number }> = {};
      for (const row of taskStatsResult.data ?? []) {
        const entry = (countsByProject[row.project_id] ??= { total: 0, done: 0 });
        entry.total += 1;
        if (row.status === 'done') entry.done += 1;
      }
      setProjectTaskCounts(countsByProject);
    }
  };

  // メンバー管理モーダルの開閉（ProjectManagementView側でオーナーにのみ
  // 「メンバー管理」ボタンを表示）
  const handleOpenMemberModal = (project: Project) => setMemberModalProjectId(project.id);
  const handleCloseMemberModal = () => setMemberModalProjectId(null);

  // メンバーの追加（オーナーのみ。RLSの`project_members_insert_owner`で保証）。
  // 追加自体に確認ダイアログは挟まない（TaskForm.tsxの担当者選択と同様、選ぶだけの軽い操作のため）
  const handleAddMember = async (userId: string) => {
    if (!memberModalProjectId) return;
    const { error } = await supabase
      .from('project_members')
      .insert({ project_id: memberModalProjectId, user_id: userId, role: 'member' });
    if (error) {
      alert('メンバーの追加に失敗しました: ' + error.message);
      return;
    }
    await refreshProjectSummaries();
  };

  // メンバーの削除（オーナーのみ。RLSの`project_members_delete_owner_or_self`で保証。
  // オーナー行自体は同ポリシーの`role <> 'owner'`条件により削除できない）
  const handleRemoveMember = async (userId: string) => {
    if (!memberModalProjectId) return;
    const targetName = users.find((u) => u.id === userId)?.name ?? 'このユーザー';
    if (!window.confirm(`「${targetName}」さんをこのプロジェクトから削除しますか？`)) return;

    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', memberModalProjectId)
      .eq('user_id', userId);
    if (error) {
      alert('メンバーの削除に失敗しました: ' + error.message);
      return;
    }
    await refreshProjectSummaries();
  };

  // オーナー譲渡（docs/要件定義書_プロジェクト管理機能.md§6.1）。本人確認はRPC側
  // （security definer）で行うため、確認ダイアログを挟んで呼ぶだけでよい
  const handleTransferOwnership = async (userId: string) => {
    if (!memberModalProjectId) return;
    const targetName = users.find((u) => u.id === userId)?.name ?? 'このユーザー';
    if (!window.confirm(`オーナーを「${targetName}」さんに譲渡しますか？\nあなた自身はメンバーになります。`)) return;

    const { error } = await supabase.rpc('transfer_project_ownership', {
      p_project_id: memberModalProjectId,
      p_new_owner_id: userId,
    });
    if (error) {
      alert('オーナー譲渡に失敗しました: ' + error.message);
      return;
    }
    handleCloseMemberModal();
    await refreshProjectSummaries();
  };

  // 退会フロー用のオーナー譲渡。上のhandleTransferOwnershipはメンバー管理モーダル専用
  // のため、モーダルを持たない別関数として用意する。OwnershipHandoverSection.tsx側の
  // 行ごとのエラー表示に使うためエラーメッセージ文字列（またはnull）を返す
  const handleTransferOwnershipForRetirement = async (projectId: string, newOwnerId: string): Promise<string | null> => {
    const { error } = await supabase.rpc('transfer_project_ownership', {
      p_project_id: projectId,
      p_new_owner_id: newOwnerId,
    });
    if (error) return 'オーナー譲渡に失敗しました: ' + error.message;
    await refreshProjectSummaries();
    return null;
  };

  return {
    projectMembers,
    projectTaskCounts,
    memberModalProjectId,
    refreshProjectSummaries,
    handleOpenMemberModal,
    handleCloseMemberModal,
    handleAddMember,
    handleRemoveMember,
    handleTransferOwnership,
    handleTransferOwnershipForRetirement,
  };
}
