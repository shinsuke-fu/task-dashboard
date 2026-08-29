/**
 * src/components/project/ProjectManagementView.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   「プロジェクト管理」タブ本体。自分が参加しているプロジェクトをカード形式で
 *   一覧表示し、新規作成・編集への導線を提供する（プロジェクト管理機能_要件定義書.md
 *   §2.3〜2.4）。サイドバーのアコーディオン（すばやい切り替え用）とは別の、
 *   一覧性・管理操作のための画面という位置づけ。
 *
 * 【主な処理】
 *   1. アーカイブ済みプロジェクトはデフォルトで一覧から隠す方針は維持しつつ（§2.2）、
 *      検索ボックス（プロジェクト名の部分一致）とステータスタブ（すべて／進行中／完了／
 *      アーカイブ）で絞り込めるようにする。「すべて」タブはアーカイブ以外の全件を指し、
 *      アーカイブ済みは専用タブからのみ見られる（ユーザー要望：2026-08-29。以前あった
 *      「アーカイブ済みを表示」チェックボックスはこのタブに統合し廃止）
 *   2. 各カードには、自分のロール（オーナー／メンバー）・メンバー数・タスク進捗％
 *      （完了タスク数／総タスク数。KpiCards.tsxと同じ計算式で統一）を表示する
 *   3. 「開く」ボタンで該当プロジェクトを選択中プロジェクトに切り替える（App.tsx側の
 *      handleSelectProjectを再利用）。「編集」ボタンはオーナーのみに表示する
 *      （projects_update_ownerのRLSと一致させる。supabase.mdのルール）
 *   4. データの取得・作成・編集・削除・メンバー管理の実処理はすべてApp.tsx側に委譲し、
 *      このコンポーネントはPropsで受け取った内容を表示するだけ（規約①：状態はApp.tsxに
 *      一元化）。削除・メンバー削除・オーナー譲渡・脱退の確認ダイアログもApp.tsx側で行う
 *   5. 「編集」「メンバー管理」「削除」はオーナーのみに表示する（projects_update_owner等の
 *      RLSと一致させる）。オーナー以外のメンバーには、代わりに「抜ける」ボタンを表示する
 *      （§2.4・§7.4。オーナー本人は他の誰かへ譲渡するまで抜けられない）。メンバー管理の
 *      実体（一覧・追加・削除・オーナー譲渡）はMemberManagementModal.tsxが担う
 * -----------------------------------------------------------------------
 */
import type { Project } from '../../types/task';

interface ProjectMemberInfo {
  userId: string;
  role: string;
}

interface ProjectTaskCount {
  total: number;
  done: number;
}

type ProjectStatusFilter = 'all' | Project['status'];

interface ProjectManagementViewProps {
  projects: Project[];
  currentUserId: string;
  projectMembers: Record<string, ProjectMemberInfo[]>;
  projectTaskCounts: Record<string, ProjectTaskCount>;
  statusFilter: ProjectStatusFilter;
  onStatusFilterChange: (filter: ProjectStatusFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenProject: (id: string) => void;
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onManageMembers: (project: Project) => void;
  onLeaveProject: (project: Project) => void;
}

const statusLabels: Record<Project['status'], string> = {
  active: '進行中',
  completed: '完了',
  archived: 'アーカイブ',
};

const statusFilterTabs: ProjectStatusFilter[] = ['all', 'active', 'completed', 'archived'];

export default function ProjectManagementView({
  projects,
  currentUserId,
  projectMembers,
  projectTaskCounts,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  onOpenProject,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  onManageMembers,
  onLeaveProject,
}: ProjectManagementViewProps) {
  // 「すべて」タブはアーカイブ以外の全件（アーカイブ済みは既定で隠す方針を維持。§2.2）。
  // 検索は名前の部分一致（大文字小文字を区別しない）。表示順は参加プロジェクト一覧
  // （作成日時の古い順）をそのまま踏襲
  //
  // 検索時のみ、Unicode正規化（NFKC）を通してから比較することで、全角/半角の違い
  // （例：「ABC」と「ＡＢＣ」、「ｱｲｳ」と「アイウ」）を同一視できるようにする
  // （ユーザー要望：2026-08-29）。プロジェクト名自体の保存・表示内容は一切変更しない
  const trimmedQuery = searchQuery.trim().normalize('NFKC').toLowerCase();
  const visibleProjects = projects.filter((p) => {
    const matchesStatus = statusFilter === 'all' ? p.status !== 'archived' : p.status === statusFilter;
    const matchesSearch = trimmedQuery === '' || p.name.normalize('NFKC').toLowerCase().includes(trimmedQuery);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="animate-fade-in pb-8">
      {/* ヘッダー：タイトル＋新規作成ボタン、その下に検索＋ステータスタブ */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-md font-bold uppercase tracking-wider text-text-main">プロジェクト管理</h2>
          <button
            onClick={onCreateProject}
            className="h-9 px-4 bg-accent hover:bg-accent/90 text-on-accent font-black text-xs rounded-xl cursor-pointer shadow-md"
          >
            ＋ 新規プロジェクト
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* ステータスタブ：「すべて」はアーカイブ以外の全件（§2.2の既定非表示を維持しつつ、
              アーカイブ済みは専用タブから見られるようにする） */}
          <div className="flex items-center gap-1 bg-surface border border-border-card rounded-xl p-1">
            {statusFilterTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => onStatusFilterChange(tab)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-accent text-on-accent shadow-sm'
                    : 'text-text-sub hover:text-text-main'
                }`}
              >
                {tab === 'all' ? 'すべて' : statusLabels[tab]}
              </button>
            ))}
          </div>

          {/* プロジェクト名の検索（部分一致） */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="プロジェクト名で検索"
            className="h-8 px-3 bg-card border border-border-card/80 rounded-lg text-[11px] font-medium text-text-main placeholder:text-text-sub focus:outline-none focus:border-accent w-48"
          />
        </div>
      </div>

      {projects.length === 0 ? (
        // 参加プロジェクトが0件（新規ユーザー等）のときの空状態案内（§2.3）
        <div className="bg-card p-12 rounded-2xl border border-border-card text-center">
          <h3 className="text-sm font-bold text-text-main mb-2">参加しているプロジェクトがありません</h3>
          <p className="text-xs text-text-sub mb-5">新しいプロジェクトを作成して、タスク管理を始めましょう。</p>
          <button
            onClick={onCreateProject}
            className="h-10 px-6 bg-accent hover:bg-accent/90 text-on-accent font-black text-xs rounded-xl cursor-pointer shadow-md"
          >
            ＋ 新規プロジェクトを作成
          </button>
        </div>
      ) : visibleProjects.length === 0 ? (
        // 参加プロジェクト自体はあるが、検索・タブの条件に一致するものが無い場合
        <div className="bg-card p-12 rounded-2xl border border-border-card text-center">
          <h3 className="text-sm font-bold text-text-main mb-2">該当するプロジェクトがありません</h3>
          <p className="text-xs text-text-sub">検索条件やタブを変更してみてください。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProjects.map((project) => {
            const members = projectMembers[project.id] ?? [];
            const myRole = members.find((m) => m.userId === currentUserId)?.role;
            const isOwner = myRole === 'owner';
            const counts = projectTaskCounts[project.id] ?? { total: 0, done: 0 };
            const completionRate = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

            return (
              <div key={project.id} className="bg-card border border-border-card rounded-2xl p-5 flex flex-col gap-3 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm text-text-main leading-snug break-words">{project.name}</h3>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    project.status === 'active'
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-surface border-border-card text-text-sub'
                  }`}>
                    {statusLabels[project.status]}
                  </span>
                </div>

                {project.description && (
                  <p className="text-[11px] text-text-sub leading-relaxed line-clamp-2">{project.description}</p>
                )}

                <div className="flex items-center gap-3 text-[11px] text-text-sub font-bold">
                  <span>{isOwner ? 'オーナー：あなた' : 'メンバー'}</span>
                  <span>👤 {members.length}人</span>
                </div>

                {/* タスク進捗（KpiCards.tsxと同じ「完了数／総数」の計算式で統一） */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-text-sub mb-1">
                    <span>進捗</span>
                    <span>{counts.done}/{counts.total}件（{completionRate}%）</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${completionRate}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 mt-auto">
                  {/* 編集・メンバー管理・削除はオーナーのみ（projects_update_owner等のRLSと一致させる） */}
                  {isOwner && (
                    <button
                      onClick={() => onDeleteProject(project)}
                      className="h-8 px-3 bg-surface hover:bg-rose-50 border border-border-card/50 hover:border-rose-200 rounded-lg text-[10px] font-bold text-text-sub hover:text-rose-600 transition cursor-pointer"
                    >
                      削除
                    </button>
                  )}
                  {isOwner && (
                    <button
                      onClick={() => onManageMembers(project)}
                      className="h-8 px-3 bg-surface hover:bg-base border border-border-card/50 rounded-lg text-[10px] font-bold text-text-sub hover:text-text-main transition cursor-pointer"
                    >
                      メンバー管理
                    </button>
                  )}
                  {isOwner && (
                    <button
                      onClick={() => onEditProject(project)}
                      className="h-8 px-3 bg-surface hover:bg-base border border-border-card/50 rounded-lg text-[10px] font-bold text-text-sub hover:text-text-main transition cursor-pointer"
                    >
                      編集
                    </button>
                  )}
                  {/* 抜ける：オーナー以外のメンバーのみ（オーナーは譲渡するまで抜けられない。§7.4） */}
                  {!isOwner && (
                    <button
                      onClick={() => onLeaveProject(project)}
                      className="h-8 px-3 bg-surface hover:bg-rose-50 border border-border-card/50 hover:border-rose-200 rounded-lg text-[10px] font-bold text-text-sub hover:text-rose-600 transition cursor-pointer"
                    >
                      抜ける
                    </button>
                  )}
                  <button
                    onClick={() => onOpenProject(project.id)}
                    className="h-8 px-4 bg-accent hover:bg-accent/90 text-on-accent font-black text-[10px] rounded-lg cursor-pointer shadow-md"
                  >
                    開く
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
