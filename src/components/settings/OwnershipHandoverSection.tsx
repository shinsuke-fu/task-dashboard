/**
 * src/components/settings/OwnershipHandoverSection.tsx
 * 退会前のオーナー引き継ぎセクション。自分がオーナーかつ他にもメンバーがいる
 * プロジェクトが1件以上ある間、SettingsView.tsx側の分岐でDangerZoneSectionの
 * 代わりに表示される。プロジェクトごとに新オーナー（自分以外のメンバー）を選んで譲渡する。
 */
import React, { useState } from 'react';
import type { Project, User } from '../../types/task';

interface OwnershipHandoverSectionProps {
  // オーナー引き継ぎが必要なプロジェクト（App.tsx側で絞り込み済み）
  projects: Project[];
  projectMembers: Record<string, { userId: string; role: string }[]>;
  users: User[];
  currentUserId: string;
  onTransferOwnership: (projectId: string, newOwnerId: string) => Promise<string | null>;
}

export const OwnershipHandoverSection: React.FC<OwnershipHandoverSectionProps> = ({
  projects,
  projectMembers,
  users,
  currentUserId,
  onTransferOwnership,
}) => {
  // プロジェクトごとに選択中の新オーナー候補（未選択の間は空文字列）
  const [selections, setSelections] = useState<Record<string, string>>({});
  // プロジェクトごとの譲渡処理中フラグ・エラーメッセージ
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleTransfer = async (project: Project) => {
    const newOwnerId = selections[project.id];
    if (!newOwnerId) return;
    const targetName = users.find((u) => u.id === newOwnerId)?.name ?? 'このユーザー';
    const confirmed = window.confirm(
      `「${project.name}」のオーナーを「${targetName}」さんに譲渡しますか？\n退会を完了するには、この操作が必要です。`
    );
    if (!confirmed) return;

    setErrors((prev) => ({ ...prev, [project.id]: '' }));
    setTransferringId(project.id);
    const error = await onTransferOwnership(project.id, newOwnerId);
    setTransferringId(null);

    if (error) {
      setErrors((prev) => ({ ...prev, [project.id]: error }));
    }
    // 成功時：projectMembersの更新で、このprojectはprojects（絞り込み済みリスト）から自動的に外れる
  };

  return (
    <div className="bg-card border border-amber-500/20 rounded-xl p-5 md:p-6 shadow-xs mt-6">
      <label className="block text-[10px] font-black text-amber-400 uppercase mb-3">
        オーナーの引き継ぎが必要です
      </label>
      <p className="text-[10px] text-text-sub mb-4 leading-relaxed">
        あなたがオーナーで、他にもメンバーがいるプロジェクトがあります。退会する前に、
        それぞれのプロジェクトを別のメンバーへ引き継いでください。すべて引き継ぎが
        完了すると、通常の退会ボタンが表示されます。
      </p>

      <div className="space-y-3">
        {projects.map((project) => {
          const candidates = (projectMembers[project.id] ?? [])
            .filter((m) => m.userId !== currentUserId)
            .map((m) => users.find((u) => u.id === m.userId))
            .filter((u): u is User => u !== undefined);

          return (
            <div key={project.id} className="bg-base border border-border-card rounded-xl p-3">
              <div className="text-xs font-bold text-text-main mb-2 truncate">{project.name}</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selections[project.id] ?? ''}
                  onChange={(e) => setSelections((prev) => ({ ...prev, [project.id]: e.target.value }))}
                  className="w-full h-9 px-2.5 rounded-lg border border-border-card bg-card text-xs text-text-main focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="">新しいオーナーを選択</option>
                  {candidates.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleTransfer(project)}
                  disabled={!selections[project.id] || transferringId === project.id}
                  className="h-9 px-4 bg-amber-500/10 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-amber-400 hover:text-white font-bold text-[11px] rounded-lg transition cursor-pointer border border-amber-500/20 flex-shrink-0 whitespace-nowrap"
                >
                  {transferringId === project.id ? '譲渡中…' : '譲渡する'}
                </button>
              </div>
              {errors[project.id] && <p className="text-[10px] text-rose-400 mt-2">{errors[project.id]}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};
