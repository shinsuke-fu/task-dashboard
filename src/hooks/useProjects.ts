/**
 * src/hooks/useProjects.ts
 * プロジェクト一覧の取得・選択・新規作成／編集／削除、プロジェクト管理タブの
 * 絞り込み状態をまとめて扱うフック。
 *
 * handleViewChange・refreshProjectSummariesはまだ別フックに切り出していない
 * （useViewNavigation.ts／将来のuseProjectMembers.ts）ため、呼び出し元（App.tsx）から
 * コールバックとして注入する。
 */
import { useEffect, useState } from 'react';
import type { Project, ProjectStatus } from '../types/task';
import { supabase } from '../lib/supabaseClient';

// Supabaseから取得した1行分のプロジェクト生データの型（projectsテーブル）。
// このファイル内でフロント用のProject型へ変換する
interface SupabaseProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  // 作成者が退会等でアカウント削除されると、supabase-migration-projects-created-by-nullable.sql
  // 適用後はnullになりうる（削除前のcreated_byがそのアカウントを指していた場合のみ。詳細は
  // 引継ぎメモ.md参照）
  created_by: string | null;
}

const mapRowToProject = (row: SupabaseProjectRow): Project => ({
  id: row.id,
  name: row.name,
  description: row.description ?? undefined,
  status: row.status as ProjectStatus,
  createdBy: row.created_by,
});

export function useProjects(
  isAuthenticated: boolean,
  currentUserId: string,
  handleViewChange: (view: string) => void,
  refreshProjectSummaries: () => Promise<void>,
) {
  // 参加中プロジェクトの一覧（Supabaseの`projects`テーブルから取得。RLSにより自分が
  // メンバーのプロジェクトのみが返る。docs/要件定義書_プロジェクト管理機能.md §3.1）
  const [projects, setProjects] = useState<Project[]>([]);

  // ログイン直後の「初回のプロジェクト一覧取得」が完了したかどうかのフラグ。
  // ゲスト（匿名）ユーザーのデモデータ自動投入は、このフラグがtrueになってから
  // （＝projectsが本当に0件だと確定してから）行うことで、取得とデモデータ作成の
  // 競合を避ける（App.tsx側のゲストデータ投入useEffect参照）
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  // 選択中プロジェクトのID。テーマと同様、複数人で共有する必要のない「個人の選択状態」
  // なのでブラウザのlocalStorageに保存し、リロードしても直前に見ていたプロジェクトを
  // 復元する（§2.1）。未選択（null）の間は、3画面に案内を表示しタスクは取得しない
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    return localStorage.getItem('dashboard_current_project_id') || null;
  });

  // サイドバーの「プロジェクト管理」アコーディオンの開閉状態。isSidebarOpen等の他のUI
  // トグルと同様、Sidebar.tsx側には状態を持たせずApp.tsxで一元管理する（規約①・ui-theming.md）
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState<boolean>(false);

  // プロジェクト作成・編集モーダルの開閉状態と編集対象。同じ理由でApp.tsxに一元管理する
  const [isProjectFormOpen, setIsProjectFormOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);

  // プロジェクト管理タブの検索・ステータスタブによる絞り込み（docs/要件定義書_
  // プロジェクト管理機能.md§2.2）。他のフィルター系state（filterUser等）と同様、
  // 画面遷移時にリセットされる一時的な表示設定として扱い、localStorageには保存せず
  // 都度初期値から始める
  const [projectStatusFilter, setProjectStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [projectSearchQuery, setProjectSearchQuery] = useState<string>('');

  // Supabaseから自分の参加プロジェクト一覧を取得し直す共通関数。RLS
  // （projects_select_member。supabase-migration-projects.sql参照）が自分がメンバーの
  // プロジェクトだけを返すため、クライアント側でのuser_id絞り込みは不要
  //
  // 末尾でprojectsLoadedをtrueにする（成功・失敗どちらでも）。これにより「ログイン直後の
  // 初回取得が完了した」ことを他のuseEffectから判定できる
  const refreshProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      // refreshTasksと同様、二次キーで並び順を確定させる
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      console.error('プロジェクト一覧の取得に失敗しました:', error);
      setProjectsLoaded(true);
      return;
    }
    setProjects(((data ?? []) as SupabaseProjectRow[]).map(mapRowToProject));
    setProjectsLoaded(true);
  };

  // ログイン状態が変わったら参加プロジェクト一覧を取得し直す
  useEffect(() => {
    if (!isAuthenticated) {
      setProjects([]);
      setProjectsLoaded(false);
      return;
    }
    refreshProjects();
  }, [isAuthenticated]);

  // 参加プロジェクト一覧を取得し直した結果、選択中プロジェクトがその一覧に
  // 含まれなくなっていた場合（メンバーから外れた・削除された等）は選択状態を解除する
  useEffect(() => {
    if (projects.length === 0) return;
    if (currentProjectId && !projects.some((p) => p.id === currentProjectId)) {
      setCurrentProjectId(null);
    }
  }, [projects, currentProjectId]);

  // 選択中プロジェクトが変わるたびにlocalStorageへ永続化（テーマと同じ方式。§2.1）
  useEffect(() => {
    if (currentProjectId) {
      localStorage.setItem('dashboard_current_project_id', currentProjectId);
    } else {
      localStorage.removeItem('dashboard_current_project_id');
    }
  }, [currentProjectId]);

  // 選択中プロジェクトの実体（ヘッダーの常時表示バッジ用。「今どのプロジェクトを
  // 見ているか常に分かるようにしたい」という理由で表示している）
  const currentProject = projects.find((p) => p.id === currentProjectId);

  // サイドバーのアコーディオンでプロジェクトを選択したときの処理（要件定義書§2.1）。
  // 選択したプロジェクトをcurrentProjectIdにし、自動的にダッシュボードへ遷移する
  // （スマホ幅でサイドバーを閉じる処理はhandleViewChange側にすでにあるものを再利用する）
  const handleSelectProject = (id: string) => {
    setCurrentProjectId(id);
    handleViewChange('dashboard');
  };

  // サイドバーの「プロジェクト管理」アコーディオンの開閉切り替え
  const handleToggleProjectMenu = () => setIsProjectMenuOpen((prev) => !prev);

  // 新規作成モーダルを開く（編集対象なし）
  const handleOpenCreateProject = () => {
    setEditingProject(undefined);
    setIsProjectFormOpen(true);
  };

  // 既存プロジェクトの編集モーダルを開く（ProjectManagementView側でオーナーにのみ表示）
  const handleOpenEditProject = (project: Project) => {
    setEditingProject(project);
    setIsProjectFormOpen(true);
  };

  const handleCloseProjectForm = () => {
    setIsProjectFormOpen(false);
    setEditingProject(undefined);
  };

  // プロジェクトの新規作成・編集の保存。作成時はhandle_new_project()トリガーが
  // created_byを自動的にオーナーとしてproject_membersへ登録するため、insertのみでよい。
  // RETURNINGはSELECT用RLSの可視性チェックも受けるため、登録が終わる前だと失敗する
  // （RLSの「鶏と卵問題」。詳細：学習ノート.md8.2）
  const handleSaveProject = async (data: { name: string; description?: string; status: ProjectStatus }) => {
    if (editingProject) {
      const { error } = await supabase
        .from('projects')
        .update({ name: data.name, description: data.description ?? null, status: data.status })
        .eq('id', editingProject.id);
      if (error) {
        alert('プロジェクトの更新に失敗しました: ' + error.message);
        return;
      }
    } else {
      const { data: inserted, error } = await supabase
        .from('projects')
        .insert({ name: data.name, description: data.description ?? null, status: data.status, created_by: currentUserId })
        .select('id')
        .single();
      if (error || !inserted) {
        alert('プロジェクトの作成に失敗しました: ' + (error?.message ?? '不明なエラー'));
        return;
      }
      setCurrentProjectId(inserted.id);
    }

    await refreshProjects();
    await refreshProjectSummaries();
    handleCloseProjectForm();
  };

  // プロジェクトの削除（オーナーのみ。RLSの`projects_delete_owner`で保証）。`project_id`は
  // cascadeのため配下のタスクもまとめて消える。元に戻せないため確認ダイアログを挟む
  const handleDeleteProject = async (project: Project) => {
    const confirmed = window.confirm(
      `「${project.name}」を削除しますか？\nこのプロジェクト内のタスクもすべて削除されます。この操作は元に戻せません。`
    );
    if (!confirmed) return;

    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (error) {
      alert('プロジェクトの削除に失敗しました: ' + error.message);
      return;
    }

    // 削除したプロジェクトが選択中だった場合の後始末は、既存のuseEffect
    // （projectsから選択中プロジェクトが消えたらcurrentProjectIdをnullにする）に任せる
    await refreshProjects();
    await refreshProjectSummaries();
  };

  return {
    projects,
    projectsLoaded,
    currentProjectId,
    setCurrentProjectId,
    isProjectMenuOpen,
    isProjectFormOpen,
    editingProject,
    projectStatusFilter,
    setProjectStatusFilter,
    projectSearchQuery,
    setProjectSearchQuery,
    currentProject,
    refreshProjects,
    handleSelectProject,
    handleToggleProjectMenu,
    handleOpenCreateProject,
    handleOpenEditProject,
    handleCloseProjectForm,
    handleSaveProject,
    handleDeleteProject,
  };
}
