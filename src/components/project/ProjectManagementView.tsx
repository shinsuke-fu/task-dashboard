/**
 * src/components/project/ProjectManagementView.tsx
 * 「プロジェクト管理」タブ本体。参加プロジェクトをカード形式で一覧表示し、検索・
 * ステータスタブでの絞り込みと新規作成・編集・削除・メンバー管理への導線を提供する。
 * 実処理（確認ダイアログ含む）はすべてApp.tsx側に委譲する（規約①）。
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
  // 「すべて」はアーカイブ以外の全件（§2.2の既定非表示を維持）。検索はNFKC正規化してから
  // 比較するため、全角/半角の違い（「ABC」と「ＡＢＣ」等）を同一視できる
  const trimmedQuery = searchQuery.trim().normalize('NFKC').toLowerCase();
  const visibleProjects = projects.filter((p) => {
    const matchesStatus = statusFilter === 'all' ? p.status !== 'archived' : p.status === statusFilter;
    const matchesSearch = trimmedQuery === '' || p.name.normalize('NFKC').toLowerCase().includes(trimmedQuery);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="animate-fade-in pb-8">
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
        // 参加プロジェクトが0件（新規ユーザー等）の空状態
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
        // 参加プロジェクトはあるが、検索・タブの条件に一致するものが無い場合
        <div className="bg-card p-12 rounded-2xl border border-border-card text-center">
          <h3 className="text-sm font-bold text-text-main mb-2">該当するプロジェクトがありません</h3>
          <p className="text-xs text-text-sub">検索条件やタブを変更してみてください。</p>
        </div>
      ) : (
        // 列数はビューポート幅（sm:/lg:）ではなくコンテナクエリ（App.tsxの<main>の@container基準）
        // で切り替える。サイドバー展開時など実際の残り幅がビューポート幅と乖離するため
        // （KanbanBoard.tsxと同じ考え方）
        <div className="grid grid-cols-1 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-3 gap-4">
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

                {/* KpiCards.tsxと同じ「完了数／総数」の計算式で統一 */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-text-sub mb-1">
                    <span>進捗</span>
                    <span>{counts.done}/{counts.total}件（{completionRate}%）</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${completionRate}%` }} />
                  </div>
                </div>

                {/* flex-wrapで、カード幅が狭いとき（サイドバー展開時など）はボタンが崩れる代わりに折り返す */}
                <div className="flex flex-wrap items-center justify-end gap-2 gap-y-2 pt-1 mt-auto">
                  {/* 編集・メンバー管理・削除はオーナーのみ（projects_update_owner等のRLSと一致させる） */}
                  {isOwner && (
                    <button
                      onClick={() => onDeleteProject(project)}
                      className="h-8 px-2.5 bg-surface hover:bg-rose-50 border border-border-card/50 hover:border-rose-200 rounded-lg text-[10px] font-bold text-text-sub hover:text-rose-600 transition cursor-pointer whitespace-nowrap"
                    >
                      削除
                    </button>
                  )}
                  {isOwner && (
                    <button
                      onClick={() => onManageMembers(project)}
                      className="h-8 px-2.5 bg-surface hover:bg-base border border-border-card/50 rounded-lg text-[10px] font-bold text-text-sub hover:text-text-main transition cursor-pointer whitespace-nowrap"
                    >
                      メンバー管理
                    </button>
                  )}
                  {isOwner && (
                    <button
                      onClick={() => onEditProject(project)}
                      className="h-8 px-2.5 bg-surface hover:bg-base border border-border-card/50 rounded-lg text-[10px] font-bold text-text-sub hover:text-text-main transition cursor-pointer whitespace-nowrap"
                    >
                      編集
                    </button>
                  )}
                  {/* 抜ける：オーナー以外のメンバーのみ（オーナーは譲渡するまで抜けられない。§7.4） */}
                  {!isOwner && (
                    <button
                      onClick={() => onLeaveProject(project)}
                      className="h-8 px-2.5 bg-surface hover:bg-rose-50 border border-border-card/50 hover:border-rose-200 rounded-lg text-[10px] font-bold text-text-sub hover:text-rose-600 transition cursor-pointer whitespace-nowrap"
                    >
                      抜ける
                    </button>
                  )}
                  <button
                    onClick={() => onOpenProject(project.id)}
                    className="h-8 px-4 bg-accent hover:bg-accent/90 text-on-accent font-black text-[10px] rounded-lg cursor-pointer shadow-md whitespace-nowrap"
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
