/**
 * src/App.tsx
 * アプリ全体を束ねるルートコンポーネント。tasks・users・認証状態・テーマ・選択中
 * プロジェクトなど全状態をここで一元管理する（Single Source of Truth・規約①）。
 * 子孫コンポーネントは状態を直接書き換えず、Props経由の関数呼び出しでのみ変更を
 * リクエストする。画面切り替えはcurrentView文字列のみで行う一面集約型SPA
 * （規約②）。機能一覧はdocs/基本設計書.md§6参照。
 */
import { useState, useEffect, useRef } from 'react';
import type { Task, NotificationType, NotificationItem, Project } from './types/task';
import { supabase } from './lib/supabaseClient';
import { useAuthSession } from './hooks/useAuthSession';
import { useUsers } from './hooks/useUsers';
import { useTheme, themeLabels } from './hooks/useTheme';
import { useViewNavigation } from './hooks/useViewNavigation';
import { useProjects } from './hooks/useProjects';
import { useProjectMembers } from './hooks/useProjectMembers';
import { useTasks } from './hooks/useTasks';
import Sidebar from './components/Sidebar';
import KanbanBoard from './components/kanban/KanbanBoard';
import TaskForm from './components/TaskForm';
import { DashboardView } from './components/dashboard/DashboardView';
import { ScheduleView } from './components/schedule/ScheduleView';
import { SettingsView } from './components/settings/SettingsView';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { RejectReasonModal } from './components/RejectReasonModal';
import { ImageLightbox } from './components/ImageLightbox';
import ProjectManagementView from './components/project/ProjectManagementView';
import ProjectFormModal from './components/project/ProjectFormModal';
import MemberManagementModal from './components/project/MemberManagementModal';
import { NotificationsView } from './components/notifications/NotificationsView';
import { getTodayJstDateString } from './utils/date';

// 通知ベルに表示するアラートアイテムの型（NotificationItem）は、通知専用画面
// （NotificationsView.tsx）とも共有するため、types/task.tsに集約している

// 通知ベルの4種類すべてを初期状態でON（従来通りの挙動）にしたデフォルト設定
const defaultNotificationSettings: Record<NotificationType, boolean> = {
  overdue: true,
  dueToday: true,
  rejected: true,
  reviewRequested: true,
};

// JST基準の「今日」からの相対日数でYYYY-MM-DD文字列を作る（ポートフォリオを見る
// タイミングに関わらず、常に「今日から見て自然な期日」のサンプルになるようにするため。
// utils/date.tsのgetTodayJstDateStringと同じJST基準で計算する）
const dateFromToday = (offsetDays: number): string => {
  const [year, month, day] = getTodayJstDateString().split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return d.toISOString().slice(0, 10);
};

// ゲストログイン直後に、デモ用プロジェクトとサンプルタスクを一式投入する（1件はあえて
// 期日超過にし「遅延中」表示も確認できるようにしている）。Login.tsxではなくApp.tsx側
// から呼ぶ理由はログイン検知との競合を避けるため（経緯：学習ノート.md8.5）
const seedGuestDemoData = async (guestUserId: string): Promise<string | null> => {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name: 'デモプロジェクト',
      description: 'ゲストログインで自動生成されたデモ用プロジェクトです。自由に編集・削除して試してください。',
      status: 'active',
      created_by: guestUserId,
    })
    .select('id')
    .single();

  if (projectError || !project) {
    console.error('デモプロジェクトの作成に失敗しました:', projectError);
    return null;
  }

  const sampleTasks = [
    {
      title: 'サイト全体のワイヤーフレーム作成',
      description: 'トップページ〜下層ページまでの構成案をまとめる。',
      status: 'done',
      category: 'デザイン',
      start_date: dateFromToday(-10),
      end_date: dateFromToday(-4),
      priority: 'medium',
    },
    {
      title: 'ダッシュボードのAPI連携',
      description: '各種KPIカードに実データを流し込む。',
      status: 'doing',
      category: '開発',
      start_date: dateFromToday(-2),
      end_date: dateFromToday(3),
      priority: 'high',
    },
    {
      title: 'デモ用データのレビュー依頼',
      description: '投入したサンプルデータに問題がないか確認してもらう。',
      status: 'review',
      category: '開発',
      start_date: dateFromToday(-1),
      end_date: dateFromToday(1),
      priority: 'medium',
    },
    {
      title: '月次レポートの下書き',
      description: '先月分の進捗をまとめて共有する。',
      status: 'todo',
      category: 'マーケ',
      start_date: dateFromToday(0),
      end_date: dateFromToday(7),
      priority: 'low',
    },
    {
      title: '先週分の議事録アップロード',
      description: '共有フォルダへのアップロードがまだ済んでいない。',
      status: 'todo',
      category: 'その他',
      start_date: dateFromToday(-9),
      end_date: dateFromToday(-2), // あえて期日超過にして「遅延中」表示を確認できるようにする
      priority: 'high',
    },
  ];

  for (const task of sampleTasks) {
    const { data: inserted, error: taskError } = await supabase
      .from('tasks')
      .insert({ ...task, reviewer_id: null, created_by: guestUserId, project_id: project.id })
      .select('id')
      .single();
    if (taskError || !inserted) {
      console.error('デモ用サンプルタスクの作成に失敗しました:', taskError);
      continue;
    }
    await supabase.from('task_assignees').insert({ task_id: inserted.id, user_id: guestUserId });
  }

  return project.id;
};

export default function App() {

  // ---- 認証（Supabase Authのセッションと連動。useAuthSession.tsへ切り出し済み） ----

  const {
    session,
    authLoading,
    isPasswordRecovery,
    setIsPasswordRecovery,
    isAuthenticated,
    currentUserId,
    handleChangePassword,
    handleDeleteAccount,
    handleLogout,
  } = useAuthSession();

  // ---- 状態管理（App.tsx が保持する Single Source of Truth） ----

  // 担当者一覧・自分のプロフィール更新（useUsers.tsへ切り出し済み）
  const { users, handleUpdateDisplayName, handleUploadAvatar } = useUsers(isAuthenticated, currentUserId);

  // プロジェクトメンバー管理・メンバー数/タスク進捗の集計（useProjectMembers.tsへ切り出し済み）。
  // refreshProjectSummariesをuseProjects()へ注入する都合上、useProjects()より先に呼ぶ必要がある
  const {
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
  } = useProjectMembers(users);

  // ゲスト（匿名）ユーザーのデモデータ自動投入が二重実行されるのを防ぐフラグ。
  // 投入処理自体はApp.tsx側のuseEffectに残置（プロジェクト・タスク・通知の3ドメインに
  // またがるため）。「初回のプロジェクト一覧取得」完了判定はuseProjects.ts側のprojectsLoadedを使う
  const guestSeedStartedRef = useRef(false);

  // 配色テーマ（useTheme.tsへ切り出し済み。スマホ幅での自動サイドバークローズは
  // setIsSidebarOpenをコールバックとして注入する）
  const { theme, setTheme } = useTheme(() => setIsSidebarOpen(false));

  // 画面切り替え・サイドバー開閉・アバター拡大表示（useViewNavigation.tsへ切り出し済み）
  const {
    currentView,
    isSidebarOpen,
    setIsSidebarOpen,
    isAvatarPreviewOpen,
    setIsAvatarPreviewOpen,
    handleViewChange,
  } = useViewNavigation();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  // 通知ベルのドロップダウン開閉状態
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  // 通知ベルの種類ごとのON/OFF設定。これも個人の好みなので引き続きlocalStorageに保存する
  const [notificationSettings, setNotificationSettings] = useState<Record<NotificationType, boolean>>(() => {
    const saved = localStorage.getItem('dashboard_notification_settings');
    return saved ? JSON.parse(saved) : defaultNotificationSettings;
  });

  // グローバル操作フィルターバー（担当者・カテゴリ・優先度）の選択状態。
  // 画面（タブ）ごとには分けず、全画面共通のフィルターとして扱う方針
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // 差し戻し対象のタスクID（差し戻しモーダルの表示・非表示もこのstateで制御）
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);

  // ---- Supabaseとのデータ同期 ----

  // プロジェクト一覧・選択・CRUD（useProjects.tsへ切り出し済み）。プロジェクト保存・削除後の
  // refreshProjectSummaries呼び出し（useProjectMembers.tsへ切り出し済み・上で先に呼んである）と、
  // プロジェクト選択後のダッシュボードへの画面遷移（handleViewChange）は、まだ他フックに
  // 切り出していない・切り出し済みだが別ファイルにあるため、コールバックとして注入する
  const {
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
  } = useProjects(isAuthenticated, currentUserId, handleViewChange, refreshProjectSummaries);

  // タスクCRUD・通知用タスク取得・20秒ポーリング（useTasks.tsへ切り出し済み）。
  // editingTask・setIsModalOpen・setEditingTask（タスク編集モーダルの開閉状態）はまだ
  // 別フックに切り出していないため、状態・コールバックとして注入する
  const {
    tasks,
    tasksLoading,
    notificationTasks,
    refreshNotificationTasks,
    handleSaveTask,
    handleDeleteTask,
    handleUpdateStatus,
    handleProcessAction,
    handleResetSampleData,
  } = useTasks(isAuthenticated, currentUserId, currentProjectId, users, editingTask, setIsModalOpen, setEditingTask);

  // ログイン状態が変わったらリセット・プロジェクトメンバー集計を取得し直す（参加
  // プロジェクト一覧はuseProjects.ts側の、担当者一覧はuseUsers.ts側の、通知用タスク一覧は
  // useTasks.ts側の、同じisAuthenticated依存のeffectで並行して取得される）
  useEffect(() => {
    if (!isAuthenticated) {
      // ログアウトのたびにリセットし、次回ログイン時に「初回のプロジェクト一覧取得」を
      // 正しく待てるようにする
      guestSeedStartedRef.current = false;
      return;
    }

    // 担当者・確認者の候補をプロジェクトのメンバーに絞り込むため（TaskForm.tsx）、
    // 「プロジェクト管理」タブを開いていなくてもログイン時点でprojectMembersを取得しておく
    refreshProjectSummaries();
  }, [isAuthenticated]);

  // ゲスト（匿名）ユーザーがログイン直後のプロジェクト一覧取得完了後、0件だと確定した
  // 時点でデモデータを自動投入する（guestSeedStartedRefで二重実行を防ぐ。理由は
  // seedGuestDemoData参照）。tasksはuseTasks.ts側のuseEffectが自動で取得し直すため
  // 明示呼び出し不要
  useEffect(() => {
    if (!isAuthenticated || !projectsLoaded) return;
    if (!session?.user.is_anonymous) return;
    if (projects.length > 0) return;
    if (guestSeedStartedRef.current) return;
    guestSeedStartedRef.current = true;

    (async () => {
      const newProjectId = await seedGuestDemoData(currentUserId);
      await refreshProjects();
      await refreshProjectSummaries();
      await refreshNotificationTasks();
      if (newProjectId) {
        setCurrentProjectId(newProjectId);
      }
    })();
  }, [isAuthenticated, projectsLoaded, session, projects.length, currentUserId]);

  // タブを開いたとき（currentView==='project'）だけメンバー数・タスク進捗の集計を
  // 取得し直す（サイドバーのアコーディオンでの切り替えのみを行っている間はこのクエリを
  // 発生させない）
  useEffect(() => {
    if (!isAuthenticated || currentView !== 'project') return;
    refreshProjectSummaries();
  }, [isAuthenticated, currentView]);

  // 通知メニューの「外側クリックで閉じる」処理。
  // 設定は独立したページ（currentView==='settings'）になったため、この仕組みとは無関係
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 通知ON/OFF設定が変わるたびにlocalStorageへ永続化
  useEffect(() => {
    localStorage.setItem('dashboard_notification_settings', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  // ---- 派生データ（stateから都度計算する値） ----

  // フィルターバー右側に表示する「抽出件数」。担当者・カテゴリ・優先度の条件すべてに一致するタスク数
  const currentFilteredCount = tasks.filter((task) => {
    const matchesUser = filterUser === 'all' || task.assignees.includes(filterUser);
    const matchesCategory = filterCategory === 'all' || task.category === filterCategory;
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    return matchesUser && matchesCategory && matchesPriority;
  }).length;

  // カテゴリ絞り込みドロップダウンの選択肢。実際に使われているカテゴリ値から動的生成
  const availableCategories = Array.from(new Set(tasks.map((t) => t.category).filter(Boolean)));

  // 自分のプロフィール（ヘッダーのアバター表示用）
  const myProfile = users.find((u) => u.id === currentUserId);

  // 選択中プロジェクトのメンバーだけに絞り込んだuser一覧（ダッシュボードに無関係な
  // 全ユーザーが表示されるのを防ぐ。TaskForm.tsxのassigneeCandidatesと同じ考え方）
  const currentProjectMemberIds = new Set(
    (projectMembers[currentProjectId ?? ''] ?? []).map((m) => m.userId)
  );
  const currentProjectMembers = users.filter((u) => currentProjectMemberIds.has(u.id));

  // 自分がオーナーかつ他にもメンバーがいるプロジェクト一覧（退会前に譲渡を求める対象。
  // docs/要件定義書_プロジェクト管理機能.md§6.2）。0件になれば通常の退会ボタンへ自動的に戻る
  const projectsNeedingOwnershipHandover = projects.filter((p) => {
    const members = projectMembers[p.id] ?? [];
    const isOwner = members.some((m) => m.userId === currentUserId && m.role === 'owner');
    return isOwner && members.length > 1;
  });

  // 通知ベルの「自分宛て」アラート一覧。notificationTasks（全プロジェクト横断。
  // docs/要件定義書.md§6）から毎レンダー時に導出する。種類ごとに設定ページ
  // （SettingsView.tsx）でON/OFFでき、OFFの種類はここで一切生成しない
  const todayStr = getTodayJstDateString();
  const notifications: NotificationItem[] = [];

  notificationTasks.forEach((task) => {
    const isMine = task.assignees?.includes(currentUserId);

    // 遅延中・当日締切は「自分が担当者になっている」未完了タスクに絞って通知する
    if (isMine && task.status !== 'done' && task.endDate) {
      if (notificationSettings.overdue && task.endDate < todayStr) {
        notifications.push({ id: `${task.id}-overdue`, type: 'overdue', task, message: `「${task.title}」の期日が過ぎています` });
      } else if (notificationSettings.dueToday && task.endDate === todayStr) {
        notifications.push({ id: `${task.id}-dueToday`, type: 'dueToday', task, message: `「${task.title}」の期日は本日です` });
      }
    }

    // 自分のタスクが差し戻された（進行中に戻され、かつ差し戻し理由が付いている）
    if (notificationSettings.rejected && isMine && task.status === 'doing' && task.returnReason) {
      notifications.push({ id: `${task.id}-rejected`, type: 'rejected', task, message: `「${task.title}」が差し戻されました` });
    }

    // 自分がレビュアーに指定されていて、承認待ち（review）のタスクがある
    if (notificationSettings.reviewRequested && task.reviewerId === currentUserId && task.status === 'review') {
      notifications.push({ id: `${task.id}-reviewRequested`, type: 'reviewRequested', task, message: `「${task.title}」が承認待ちです` });
    }
  });

  // ---- タスク操作ハンドラー ----
  // handleSaveTask・handleDeleteTask・handleUpdateStatus・handleProcessAction・
  // handleResetSampleDataはuseTasks.tsへ切り出し済み。ここに残るのは、タスク編集モーダルや
  // 通知メニューなど「まだ別フックに切り出していないUI状態」と組み合わせるハンドラーのみ

  // タスクカードクリック等によるタスク編集モーダルの起動
  const handleStartEdit = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  // 通知クリック時の起動。タスクが選択中でない別プロジェクトのものであれば、先に
  // currentProjectIdを切り替えてから編集モーダルを開く（そうしないと編集後に戻る画面が
  // 選択中プロジェクトのままでタスクの文脈と食い違うため）
  const handleNotificationClick = (task: Task) => {
    if (task.projectId !== currentProjectId) {
      setCurrentProjectId(task.projectId);
    }
    handleStartEdit(task);
    setIsNotifOpen(false);
  };

  // 差し戻し理由モーダルの開閉
  const handleOpenRejectModal = (id: string) => setRejectTargetId(id);
  const handleCloseRejectModal = () => setRejectTargetId(null);

  // 差し戻し理由モーダルで入力された理由を確定し、対象タスクをdoingへ差し戻す
  const handleConfirmReject = async (reason: string) => {
    if (rejectTargetId) {
      await handleProcessAction(rejectTargetId, 'reject', reason);
      handleCloseRejectModal();
    }
  };

  // メンバー管理モーダルに渡す対象プロジェクトの実体。useProjectMembers.ts側の
  // memberModalProjectId（IDのみ）と、useProjects.ts側のprojects一覧を組み合わせて
  // 導出する必要があるため、両フックの戻り値を使うApp.tsx側に残す。projects一覧から
  // 都度参照するため、削除・編集等でprojectsが更新されてもモーダル側の表示は自動的に追従する
  const memberModalProject = projects.find((p) => p.id === memberModalProjectId);

  // プロジェクトからの脱退（オーナー以外のメンバー本人のみ。RLSの
  // `project_members_delete_owner_or_self`で保証）。脱退後の選択状態解除は既存の
  // useEffect（projectsから消えたらcurrentProjectIdをnullにする）に任せる
  const handleLeaveProject = async (project: Project) => {
    if (!window.confirm(`「${project.name}」から抜けますか？`)) return;

    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', project.id)
      .eq('user_id', currentUserId);
    if (error) {
      alert('脱退に失敗しました: ' + error.message);
      return;
    }
    await refreshProjects();
    await refreshProjectSummaries();
  };

  // 通知ベルの種類ごとのON/OFFを切り替える（設定ページから呼ばれる）
  const handleToggleNotification = (type: NotificationType) => {
    setNotificationSettings(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // ダッシュボード／タスクボード／スケジュールでプロジェクト未選択の間に出す案内
  // （「近日公開」プレースホルダーと同じ見た目に揃える。要件定義書§2.1）
  const projectNotSelectedNotice = (
    <div className="bg-card p-12 rounded-2xl border border-border-card text-center animate-fade-in">
      <h2 className="text-md font-bold uppercase tracking-wider mb-2 text-accent">プロジェクトを選択してください</h2>
      <p className="text-xs text-text-sub">サイドバーの「プロジェクト管理」から、表示するプロジェクトを選んでください。</p>
    </div>
  );

  // 初回のセッション確認が終わるまで何も出さず待つ（ログイン画面のちらつき防止）。
  // h-dvh/w-dvwはiOS Safariのアドレスバー分のズレ対策
  if (authLoading) {
    return (
      <div className="flex h-dvh w-dvw items-center justify-center bg-base text-text-sub text-xs font-bold tracking-widest uppercase">
        読み込み中…
      </div>
    );
  }

  // パスワード再設定リンクを踏んだ直後は、認証済みでも通常画面へ進ませず入力画面を
  // 優先表示する（更新完了後にonDoneでフラグを戻す）
  if (isPasswordRecovery) {
    return <ResetPassword onDone={() => setIsPasswordRecovery(false)} />;
  }

  // 未ログイン時はログイン画面のみを表示し、以降のダッシュボードUIは描画しない
  if (!isAuthenticated) {
    return <Login />;
  }

  // ---- ログイン後のメイン画面（サイドバー＋ヘッダー＋フィルターバー＋メインビュー） ----
  // h-dvh/w-dvw：同上（iOS Safariのアドレスバー分のズレ対策）
  return (
    <div className="flex h-dvh w-dvw bg-base text-text-main font-sans transition-colors duration-300 overflow-hidden relative">

      {/* 左側：サイドバーメニュー */}
      <div className={`fixed md:sticky top-0 bottom-0 z-50 h-full transition-transform duration-300 md:translate-x-0 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:w-20'
      }`}>
        <Sidebar
          currentView={currentView}
          onViewChange={handleViewChange}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onLogout={handleLogout}
          onOpenSettings={() => handleViewChange('settings')}
          projects={projects}
          currentProjectId={currentProjectId}
          onSelectProject={handleSelectProject}
          isProjectMenuOpen={isProjectMenuOpen}
          onToggleProjectMenu={handleToggleProjectMenu}
          onCreateProject={handleOpenCreateProject}
        />
      </div>

      {/* スマホ用：サイドバー背景シールド */}
      {isSidebarOpen && (
        <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 md:hidden cursor-pointer" />
      )}

      {/* 右側：メインコンテンツ領域 */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">

        {/* 共通グローバルヘッダー */}
        <header className="h-16 border-b border-border-card px-4 md:px-8 flex items-center justify-between bg-card/30 backdrop-blur-md flex-shrink-0 z-30 select-none">
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
            <button
              onClick={() => { setIsSidebarOpen(!isSidebarOpen); setIsNotifOpen(false); }}
              className="p-2 rounded-xl bg-card border border-border-card text-text-sub hover:text-text-main md:hidden cursor-pointer flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-[10px] md:text-xs font-black tracking-widest uppercase text-accent truncate">
              {currentView === 'dashboard' ? 'ダッシュボード' : currentView === 'tasks' ? 'タスクボード' : currentView === 'schedule' ? 'スケジュール' : currentView === 'settings' ? '設定' : currentView === 'notifications' ? '通知' : '拡張機能'}
            </span>
            {/* 選択中プロジェクト名の常時表示バッジ。ヘッダーはサイドバーと違いスマホでも
                常に表示され続けるため、ここに置くのが最も「常時」に近い。幅の余裕が無い
                スマホ幅では省略し、sm以上でのみ表示する */}
            {currentProject && (
              <span
                className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-surface border border-border-card/60 text-[10px] font-bold text-text-sub max-w-[220px]"
                title={currentProject.name}
              >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="truncate">{currentProject.name}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
            <button
              onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }}
              className="h-9 px-3 md:px-4 bg-accent hover:bg-accent/90 text-on-accent font-black text-xs tracking-wider rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">新規作成</span>
            </button>

            {/* 通知ベル：tasksから導出した「自分宛て」の通知一覧をドロップダウン表示 */}
            <div className="relative" ref={notifDropdownRef}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="text-text-sub hover:text-text-main transition relative cursor-pointer p-1.5 flex items-center justify-center"
                title="通知"
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notifications.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-rose-500 ring-1 ring-card text-[8px] font-black text-white flex items-center justify-center">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </button>

              {/* 通知は全プロジェクト横断のため件数が増えやすく、このドロップダウン
                  （幅288px・高さ最大384pxで内部スクロール）だけでは狭く、どのプロジェクトの
                  通知か分かりにくい。そのためここは直近6件だけの「プレビュー」に徹し、
                  プロジェクト名タグを添える。全件は「すべて見る→」から専用画面
                  （NotificationsView.tsx・currentView='notifications'）で確認する構成にしている */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-1.5 w-72 bg-card border border-border-card rounded-xl shadow-2xl p-1.5 z-50 animate-scale-in">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[11px] text-text-sub font-medium">
                      現在、通知はありません
                    </div>
                  ) : (
                    <>
                      <div className="max-h-80 overflow-y-auto space-y-1">
                        {notifications.slice(0, 6).map((n) => (
                          <button
                            key={n.id}
                            onClick={() => handleNotificationClick(n.task)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface transition-colors flex items-start gap-2 cursor-pointer"
                          >
                            <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              n.type === 'overdue' ? 'bg-rose-500' :
                              n.type === 'dueToday' ? 'bg-amber-500' :
                              n.type === 'rejected' ? 'bg-rose-400' :
                              'bg-accent'
                            }`} />
                            <span className="min-w-0">
                              <span className="block text-[9px] font-bold text-accent/80 uppercase tracking-wider truncate">
                                {projects.find((p) => p.id === n.task.projectId)?.name ?? '不明なプロジェクト'}
                              </span>
                              <span className="block text-[11px] text-text-main font-medium leading-relaxed">{n.message}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => { handleViewChange('notifications'); setIsNotifOpen(false); }}
                        className="w-full mt-1 px-3 py-2 rounded-lg text-[11px] font-bold text-accent hover:bg-surface transition-colors cursor-pointer text-center"
                      >
                        すべて見る（{notifications.length}件）→
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 設定ボタン：アバターの左に配置。設定ページ（テーマ／通知ON-OFF／データリセット）へ遷移する */}
            <button
              onClick={() => { handleViewChange('settings'); setIsNotifOpen(false); }}
              className={`transition cursor-pointer p-1.5 flex items-center justify-center flex-shrink-0 ${
                currentView === 'settings' ? 'text-accent' : 'text-text-sub hover:text-text-main'
              }`}
              title="設定"
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>

            {/* アバター：avatar_url未設定時はdisplay_nameの先頭2文字を表示。<img>に固定
                サイズを指定しているのは、親依存サイズだと画像の実サイズでflexアイテムが
                押し上げられ正円が崩れる不具合（Safari等）があるため。画像設定時のみ
                クリックでImageLightbox表示する */}
            <button
              type="button"
              onClick={() => { if (myProfile?.avatarUrl) setIsAvatarPreviewOpen(true); }}
              className={`w-7 h-7 md:w-8 md:h-8 rounded-full bg-border-card border border-accent/30 flex items-center justify-center font-bold text-[8px] md:text-[10px] flex-shrink-0 min-w-0 overflow-hidden ${myProfile?.avatarUrl ? 'cursor-pointer' : 'cursor-default'}`}
              title={myProfile?.name}
            >
              {myProfile?.avatarUrl ? (
                <img src={myProfile.avatarUrl} alt={myProfile.name} className="w-7 h-7 md:w-8 md:h-8 object-cover" />
              ) : (
                myProfile ? myProfile.name.slice(0, 2) : ''
              )}
            </button>
          </div>
        </header>

        {isAvatarPreviewOpen && myProfile?.avatarUrl && (
          <ImageLightbox
            src={myProfile.avatarUrl}
            alt={myProfile.name}
            onClose={() => setIsAvatarPreviewOpen(false)}
          />
        )}

        {/* グローバル操作フィルターバー：設定ページ・プロジェクト管理タブ・通知専用画面には
            タスクの絞り込みという概念が無いため、そのタブを開いている間は非表示にする */}
        {currentView !== 'settings' && currentView !== 'project' && currentView !== 'notifications' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 md:px-8 py-2.5 bg-card/10 border-b border-border-card flex-shrink-0 select-none">
            {/* 担当者・カテゴリ・優先度の3つの選択を flex-wrap にし、幅の狭いスマホ画面でも
                横はみ出し（横スクロール）せず自然に折り返すようにする。
                画面（タブ）ごとには分けず、全画面共通のフィルターとして扱う */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {/* 担当者個別選択 */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-widest text-text-sub">担当者:</span>
                <select
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  className="bg-card border border-border-card/80 text-[11px] font-bold rounded-lg px-2.5 py-1 text-text-main focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="all">全員の一覧</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              {/* 動的カテゴリドロップダウン */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-widest text-text-sub">カテゴリ:</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-card border border-border-card/80 text-[11px] font-bold rounded-lg px-2.5 py-1 text-text-main focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="all">すべて</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* 優先度ドロップダウン（TaskForm.tsx / TaskCard.tsx と表記を統一：高/中/低） */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-widest text-text-sub">優先度:</span>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="bg-card border border-border-card/80 text-[11px] font-bold rounded-lg px-2.5 py-1 text-text-main focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="all">すべて</option>
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>
            </div>

            {/* 右側の抽出件数インジケーター */}
            <div className="text-[10px] tracking-wider text-text-sub font-medium">
              抽出数: <span className="text-text-main font-mono font-bold bg-surface px-1.5 py-0.5 rounded border border-border-card/40">{currentFilteredCount}</span> / <span className="font-mono">{tasks.length}</span>
            </div>
          </div>
        )}

        {/* メインビュー領域：flex-1 + min-h-0で残り領域を埋める（固定値は使わない）。
            `@container`はKanbanBoard.tsxのレイアウト切り替えをビューポート幅ではなく
            実際の残り横幅で判定するため（サイドバー開閉で幅が変わるとビューポート幅
            だけの判定ではボードが崩れるため） */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 bg-base/50 @container">
          <div className="max-w-7xl mx-auto w-full h-full">
            {tasksLoading && tasks.length === 0 && (
              <p className="text-[11px] text-text-sub font-bold tracking-wider mb-4">タスクを読み込み中…</p>
            )}
            {currentView === 'dashboard' ? (
              !currentProjectId ? projectNotSelectedNotice : (
                <div className="animate-fade-in pb-8">
                  <DashboardView tasks={tasks} users={currentProjectMembers} filterUser={filterUser} filterCategory={filterCategory} filterPriority={filterPriority} />
                </div>
              )
            ) : currentView === 'tasks' ? (
              !currentProjectId ? projectNotSelectedNotice : (
                <div className="space-y-6 animate-fade-in pb-8">
                  <KanbanBoard
                    tasks={tasks}
                    currentUserId={currentUserId}
                    filterUser={filterUser}
                    filterCategory={filterCategory}
                    filterPriority={filterPriority}
                    onUpdateStatus={handleUpdateStatus}
                    onProcessAction={handleProcessAction}
                    onTriggerReject={handleOpenRejectModal}
                    onDeleteTask={handleDeleteTask}
                    onStartEdit={handleStartEdit}
                  />
                </div>
              )
            ) : currentView === 'schedule' ? (
              !currentProjectId ? projectNotSelectedNotice : (
                <div className="animate-fade-in pb-8">
                  <ScheduleView
                    tasks={tasks}
                    filterUser={filterUser}
                    filterCategory={filterCategory}
                    filterPriority={filterPriority}
                    onStartEdit={handleStartEdit}
                  />
                </div>
              )
            ) : currentView === 'settings' ? (
              <div className="animate-fade-in pb-8">
                <SettingsView
                  displayName={myProfile?.name ?? ''}
                  avatarUrl={myProfile?.avatarUrl}
                  onUpdateDisplayName={handleUpdateDisplayName}
                  onUploadAvatar={handleUploadAvatar}
                  onChangePassword={handleChangePassword}
                  theme={theme}
                  themeLabels={themeLabels}
                  onThemeChange={setTheme}
                  notificationSettings={notificationSettings}
                  onToggleNotification={handleToggleNotification}
                  onResetSampleData={handleResetSampleData}
                  onDeleteAccount={handleDeleteAccount}
                  projectsNeedingOwnershipHandover={projectsNeedingOwnershipHandover}
                  projectMembers={projectMembers}
                  users={users}
                  currentUserId={currentUserId}
                  onTransferOwnershipForRetirement={handleTransferOwnershipForRetirement}
                />
              </div>
            ) : currentView === 'project' ? (
              <ProjectManagementView
                projects={projects}
                currentUserId={currentUserId}
                projectMembers={projectMembers}
                projectTaskCounts={projectTaskCounts}
                statusFilter={projectStatusFilter}
                onStatusFilterChange={setProjectStatusFilter}
                searchQuery={projectSearchQuery}
                onSearchChange={setProjectSearchQuery}
                onOpenProject={handleSelectProject}
                onCreateProject={handleOpenCreateProject}
                onEditProject={handleOpenEditProject}
                onDeleteProject={handleDeleteProject}
                onManageMembers={handleOpenMemberModal}
                onLeaveProject={handleLeaveProject}
              />
            ) : currentView === 'notifications' ? (
              <div className="animate-fade-in pb-8">
                <NotificationsView
                  notifications={notifications}
                  projects={projects}
                  onSelectNotification={handleNotificationClick}
                />
              </div>
            ) : (
              <div className="bg-card p-12 rounded-2xl border border-border-card text-center animate-fade-in">
                <h2 className="text-md font-bold uppercase tracking-wider mb-2 text-accent">近日公開</h2>
              </div>
            )}
          </div>
        </main>
      </div>

      <TaskForm
        isOpen={isModalOpen}
        editingTask={editingTask}
        onClose={() => { setIsModalOpen(false); setEditingTask(undefined); }}
        onAddTask={handleSaveTask}
        users={users}
        currentUserId={currentUserId}
        projects={projects}
        projectMembers={projectMembers}
        currentProjectId={currentProjectId}
      />
      {/* 一番底に新設モーダルをマウント（設定は独立したページになったため、ここにはマウントしない） */}
      <RejectReasonModal
        isOpen={rejectTargetId !== null}
        onClose={handleCloseRejectModal}
        onSubmit={handleConfirmReject}
      />
      <ProjectFormModal
        isOpen={isProjectFormOpen}
        editingProject={editingProject}
        onClose={handleCloseProjectForm}
        onSubmit={handleSaveProject}
      />
      <MemberManagementModal
        isOpen={memberModalProjectId !== null}
        project={memberModalProject}
        members={memberModalProjectId ? (projectMembers[memberModalProjectId] ?? []) : []}
        users={users}
        onClose={handleCloseMemberModal}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
        onTransferOwnership={handleTransferOwnership}
      />
    </div>
  );
}
