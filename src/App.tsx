/**
 * src/App.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   アプリ全体を束ねるルートコンポーネント。tasks・認証状態・テーマ・
 *   フィルター条件など「すべての状態」をここで一元管理する
 *   Single Source of Truth（規約①）。子・孫コンポーネントは状態を
 *   直接書き換えず、Props経由で渡された関数（onUpdateStatus 等）を
 *   呼び出すことでのみ状態変更をリクエストする。
 *
 * 【主な処理】
 *   1. tasks / 認証状態 / テーマ を state で保持し、localStorage と同期
 *   2. currentView（文字列）の切り替えだけで画面を出し分ける
 *      「一面集約型SPA」のルーティングを実現（外部ルーターは未使用・規約②）
 *   3. タスクの作成・編集・削除・ステータス変更・承認/差し戻しなど、
 *      タスク操作系ハンドラーをすべてここに集約し、子コンポーネントへ配布
 *   4. グローバルヘッダー／担当者・カテゴリのフィルターバー／サイドバー
 *      など、画面全体のレイアウトを組み立てる
 *   5. tasksから「自分向けの通知」（遅延・当日締切・差し戻し・承認待ち）を
 *      都度算出し、ヘッダーの通知ベルのドロップダウンに表示する
 * -----------------------------------------------------------------------
 */
import { useState, useEffect, useRef } from 'react';
import type { Task, AppTheme, User } from './types/task';
import Sidebar from './components/Sidebar';
import KanbanBoard from './components/kanban/KanbanBoard';
import TaskForm from './components/TaskForm';
import { DashboardView } from './components/dashboard/DashboardView';
import { Login } from './pages/Login';
import { RejectReasonModal } from './components/RejectReasonModal';
import { getTodayJstDateString } from './utils/date';

// 仮の担当者マスタ（モックデータ）。
// TODO: ログイン／ユーザー登録機能の実装後は、登録済みユーザー一覧に置き換える想定。
const mockUsers: User[] = [
  { id: 'u1', name: '自分（作業者）' },
  { id: 'u2', name: '山田（開発）' },
  { id: 'u3', name: '佐藤（上司・レビュアー）' },
];

// 通知ベルに表示するアラートの種類（①遅延中 ②当日締切 ③差し戻された ④承認待ち）
type NotificationType = 'overdue' | 'dueToday' | 'rejected' | 'reviewRequested';
interface NotificationItem {
  id: string;
  type: NotificationType;
  task: Task;
  message: string;
}

// 初回起動時（localStorageに保存済みデータが無いとき）に表示する初期タスク
const initialTasks: Task[] = [
  {
    id: '1',
    title: 'フロント画面のコンポーネント設計',
    description: 'フェーズ1のレイアウトとテーマ切り替えの実装。チーム運用を見据えた共通ヘッダーの構築。',
    status: 'doing',
    category: '開発',
    startDate: '2026-08-01',
    endDate: '2026-08-10',
    priority: 'high',
    assignees: ['u1'],
    reviewerId: 'u3',
  },
];

export default function App() {

  // true の間はログイン画面をスキップして開発を進められる開発用フラグ。
  // 本番リリース前に false へ戻すこと。
  const IS_DEV_MODE = true;

  // 自分（ログインユーザー）のID。TaskForm.tsxと同様、ログイン機能実装までの暫定値。
  // 通知ベルで「自分宛て」の通知を絞り込むために使用する
  const currentUserId = 'u1';

  // ---- 状態管理（App.tsx が保持する Single Source of Truth） ----

  // ログイン認証状態。IS_DEV_MODE中は常にtrue、それ以外はlocalStorageの保存値を復元
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (IS_DEV_MODE) return true; // 開発中はログイン画面を自動パス
    return localStorage.getItem('dashboard_auth') === 'true';
  });

  // タスク一覧本体。localStorageに保存済みならそれを復元し、無ければ初期タスクを使用
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('dashboard_tasks');
    return saved ? JSON.parse(saved) : initialTasks;
  });

  // 配色テーマ（9種類）。localStorageの保存値を復元、初回は sage-dark
  const [theme, setTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem('dashboard_theme') as AppTheme) || 'sage-dark';
  });

  // 現在表示中のビュー（'dashboard' | 'tasks' | その他）。文字列切替による一面集約型ルーティング
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState<boolean>(false);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  // 通知ベルのドロップダウン開閉状態
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  // グローバル操作フィルターバー（担当者・カテゴリ）の選択状態
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // 差し戻し対象のタスクID（差し戻しモーダルの表示・非表示もこのstateで制御）
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);

  // ---- 副作用（状態変化に応じた同期処理） ----

  // tasksが変わるたびにlocalStorageへ永続化
  useEffect(() => {
    localStorage.setItem('dashboard_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // 認証状態が変わるたびにlocalStorageへ永続化
  useEffect(() => {
    localStorage.setItem('dashboard_auth', String(isAuthenticated));
  }, [isAuthenticated]);

  // テーマ変更時：localStorageへ保存＋<html>にdata-theme属性を反映（CSS変数切替）。
  // 併せて、スマホ幅では自動的にサイドバーを閉じる
  useEffect(() => {
    localStorage.setItem('dashboard_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);

    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [theme]);

  // テーマメニュー・通知メニューの「外側クリックで閉じる」処理をまとめて管理
  // （テーマの値そのものには依存しないため、テーマ変更時の副作用とは別のuseEffectに分離）
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---- 派生データ（stateから都度計算する値） ----

  // フィルターバー右側に表示する「抽出件数」。担当者・カテゴリ条件に一致するタスク数
  const currentFilteredCount = tasks.filter((task) => {
    const matchesUser = filterUser === 'all' || task.assignees.includes(filterUser);
    const matchesCategory = filterCategory === 'all' || task.category === filterCategory;
    return matchesUser && matchesCategory;
  }).length;

  // カテゴリ絞り込みドロップダウンの選択肢。実際に使われているカテゴリ値から動的生成
  const availableCategories = Array.from(new Set(tasks.map((t) => t.category).filter(Boolean)));

  // 通知ベルに表示する「自分宛て」のアラート一覧。サーバー通知ではなく、
  // 現在のtasksデータから毎レンダー時に導出するシンプルな仕組み（バックエンド不要）。
  // ①遅延中 ②当日締切 ③自分のタスクが差し戻された ④自分がレビュアーで承認待ち、の4種類。
  const todayStr = getTodayJstDateString();
  const notifications: NotificationItem[] = [];

  tasks.forEach((task) => {
    const isMine = task.assignees?.includes(currentUserId);

    // 遅延中・当日締切は「自分が担当者になっている」未完了タスクに絞って通知する
    if (isMine && task.status !== 'done' && task.endDate) {
      if (task.endDate < todayStr) {
        notifications.push({ id: `${task.id}-overdue`, type: 'overdue', task, message: `「${task.title}」の期日が過ぎています` });
      } else if (task.endDate === todayStr) {
        notifications.push({ id: `${task.id}-dueToday`, type: 'dueToday', task, message: `「${task.title}」の期日は本日です` });
      }
    }

    // 自分のタスクが差し戻された（進行中に戻され、かつ差し戻し理由が付いている）
    if (isMine && task.status === 'doing' && task.returnReason) {
      notifications.push({ id: `${task.id}-rejected`, type: 'rejected', task, message: `「${task.title}」が差し戻されました` });
    }

    // 自分がレビュアーに指定されていて、承認待ち（review）のタスクがある
    if (task.reviewerId === currentUserId && task.status === 'review') {
      notifications.push({ id: `${task.id}-reviewRequested`, type: 'reviewRequested', task, message: `「${task.title}」が承認待ちです` });
    }
  });

  // ---- タスク操作ハンドラー（子コンポーネントへPropsとして配布） ----

  // タスクの新規作成／編集保存。編集中タスクがあれば上書きマージ、無ければ新規追加（先頭に挿入）
  const handleSaveTask = (taskData: Omit<Task, 'id' | 'status'>) => {
    if (editingTask) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...taskData } : t));
    } else {
      const newTask: Task = { ...taskData, id: crypto.randomUUID(), status: 'todo' };
      setTasks(prev => [newTask, ...prev]);
    }
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  // タスクの削除
  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
  };

  // カンバンのドラッグ＆ドロップ等によるステータス変更。
  // doing以外へ移動した場合は差し戻し理由(returnReason)をクリアする
  const handleUpdateStatus = (id: string, newStatus: Task['status']) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== id) return task;
      return { ...task, status: newStatus, returnReason: newStatus === 'doing' ? task.returnReason : undefined };
    }));
  };

  // 承認申請／承認完了／差し戻しの3アクションをまとめて処理する
  const handleProcessAction = (id: string, action: 'apply' | 'approve' | 'reject', reason?: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== id) return task;
      if (action === 'apply') return { ...task, status: 'review', returnReason: undefined };
      if (action === 'approve') return { ...task, status: 'done', returnReason: undefined };
      if (action === 'reject') {
        // reasonはRejectReasonModal側で必ずtrim済み・非空文字であることを保証済みのため、
        // ここでのデフォルト文言による補完（フォールバック）は不要（B案対応）
        return { ...task, status: 'doing', returnReason: reason };
      }
      return task;
    }));
  };

  // タスクカードクリック等によるタスク編集モーダルの起動
  const handleStartEdit = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  // 差し戻し理由モーダルの開閉
  const handleOpenRejectModal = (id: string) => setRejectTargetId(id);
  const handleCloseRejectModal = () => setRejectTargetId(null);

  // 差し戻し理由モーダルで入力された理由を確定し、対象タスクをdoingへ差し戻す
  const handleConfirmReject = (reason: string) => {
    if (rejectTargetId) {
      handleProcessAction(rejectTargetId, 'reject', reason);
      handleCloseRejectModal();
    }
  };

  // ヘッダーのテーマ切替メニューに表示するラベル一覧（AppTheme各値 → 表示名）
  const themeLabels: Record<AppTheme, string> = {
    'sage-dark': 'SAGE', 'terracotta-dark': 'TERRACOTTA', 'bronze-dark': 'BRONZE',
    'ocean-dark': 'OCEAN', 'amethyst-dark': 'AMETHYST', 'graphite-dark': 'GRAPHITE',
    'lime-dark': 'LIME', 'light': 'LIGHT', 'coffee-dark': 'COFFEE',
  };

  // 未ログイン時はログイン画面のみを表示し、以降のダッシュボードUIは描画しない
  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // ---- ログイン後のメイン画面（サイドバー＋ヘッダー＋フィルターバー＋メインビュー） ----
  return (
    <div className="flex h-screen w-screen bg-base text-text-main font-sans transition-colors duration-300 overflow-hidden relative">
      
      {/* 左側：サイドバーメニュー */}
      <div className={`fixed md:sticky top-0 bottom-0 z-50 h-full transition-transform duration-300 md:translate-x-0 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:w-20'
      }`}>
        <Sidebar 
          currentView={currentView} 
          onViewChange={setCurrentView} 
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onLogout={() => setIsAuthenticated(false)} 
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
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => { setIsSidebarOpen(!isSidebarOpen); setIsThemeMenuOpen(false); setIsNotifOpen(false); }}
              className="p-2 rounded-xl bg-card border border-border-card text-text-sub hover:text-text-main md:hidden cursor-pointer flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-[10px] md:text-xs font-black tracking-widest uppercase text-accent truncate">
              {currentView === 'dashboard' ? 'ダッシュボード' : currentView === 'tasks' ? 'タスクボード' : '拡張機能'}
            </span>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }}
              className="h-9 px-3 md:px-4 bg-accent hover:bg-accent/90 text-slate-950 font-black text-xs tracking-wider rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">新規作成</span>
            </button>

            <div className="relative" ref={themeDropdownRef}>
              <button
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                className="h-9 bg-card border border-border-card rounded-xl px-2.5 md:px-4 flex items-center justify-between text-text-main text-[10px] md:text-xs font-extrabold tracking-wide hover:border-border-card/80 transition-all cursor-pointer min-w-[75px] md:min-w-32"
              >
                <span>{themeLabels[theme]}</span>
                <svg className={`w-3 h-3 text-text-sub ml-1 md:ml-2 transition-transform duration-200 ${isThemeMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isThemeMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-36 md:w-40 bg-card border border-border-card rounded-xl shadow-2xl p-1.5 space-y-0.5 z-50 animate-scale-in">
                  {(Object.keys(themeLabels) as AppTheme[]).map((themeKey) => (
                    <button
                      key={themeKey}
                      onClick={() => {
                        setTheme(themeKey);
                        setIsThemeMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-[10px] md:text-[11px] font-bold tracking-wider transition-colors cursor-pointer block ${
                        theme === themeKey
                          ? 'bg-accent/10 text-accent border border-accent/10'
                          : 'text-text-sub hover:bg-surface hover:text-text-main border border-transparent'
                      }`}
                    >
                      {themeLabels[themeKey]}
                    </button>
                  ))}
                </div>
              )}
            </div>

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

              {isNotifOpen && (
                <div className="absolute right-0 mt-1.5 w-72 max-h-96 overflow-y-auto bg-card border border-border-card rounded-xl shadow-2xl p-1.5 space-y-1 z-50 animate-scale-in">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[11px] text-text-sub font-medium">
                      現在、通知はありません
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => { handleStartEdit(n.task); setIsNotifOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface transition-colors flex items-start gap-2 cursor-pointer"
                      >
                        <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          n.type === 'overdue' ? 'bg-rose-500' :
                          n.type === 'dueToday' ? 'bg-amber-500' :
                          n.type === 'rejected' ? 'bg-rose-400' :
                          'bg-accent'
                        }`} />
                        <span className="text-[11px] text-text-main font-medium leading-relaxed">{n.message}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* アバター */}
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-border-card border border-accent/30 flex items-center justify-center font-bold text-[8px] md:text-[10px] flex-shrink-0">
              自分
            </div>
          </div>
        </header>

        {/* グローバル操作フィルターバー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 md:px-8 py-2.5 bg-card/10 border-b border-border-card flex-shrink-0 select-none">
          <div className="flex items-center gap-4">
            {/* 担当者個別選択 */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold tracking-widest text-text-sub">担当者:</span>
              <select 
                value={filterUser} 
                onChange={(e) => setFilterUser(e.target.value)} 
                className="bg-card border border-border-card/80 text-[11px] font-bold rounded-lg px-2.5 py-1 text-text-main focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="all">全員の一覧</option>
                {mockUsers.map(user => (
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
          </div>

          {/* 右側の抽出件数インジケーター */}
          <div className="text-[10px] tracking-wider text-text-sub font-medium">
            抽出数: <span className="text-text-main font-mono font-bold bg-surface px-1.5 py-0.5 rounded border border-border-card/40">{currentFilteredCount}</span> / <span className="font-mono">{tasks.length}</span>
          </div>
        </div>

        {/* メインビュー領域（独立スクロール） */}
        <main className="flex-1 h-[calc(100vh-108px)] overflow-y-auto p-4 md:p-6 bg-base/50">
          <div className="max-w-7xl mx-auto w-full h-full">
            {currentView === 'dashboard' ? (
              <div className="animate-fade-in pb-8">
                <DashboardView tasks={tasks} users={mockUsers} filterUser={filterUser} filterCategory={filterCategory} />
              </div>
            ) : currentView === 'tasks' ? (
              <div className="space-y-6 animate-fade-in pb-8">
                <KanbanBoard 
                  tasks={tasks} 
                  filterUser={filterUser}
                  filterCategory={filterCategory}
                  onUpdateStatus={handleUpdateStatus} 
                  onProcessAction={handleProcessAction} 
                  onTriggerReject={handleOpenRejectModal}
                  onDeleteTask={handleDeleteTask} 
                  onStartEdit={handleStartEdit} 
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
        users={mockUsers} 
      />
      {/* 一番底に新設モーダルをマウント */}
      <RejectReasonModal
        isOpen={rejectTargetId !== null}
        onClose={handleCloseRejectModal}
        onSubmit={handleConfirmReject}
      />
    </div>
  );
}
