/**
 * src/App.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   アプリ全体を束ねるルートコンポーネント。tasks・ユーザー一覧・認証状態・
 *   テーマ・フィルター条件など「すべての状態」をここで一元管理する
 *   Single Source of Truth（規約①）。子・孫コンポーネントは状態を
 *   直接書き換えず、Props経由で渡された関数（onUpdateStatus 等）を
 *   呼び出すことでのみ状態変更をリクエストする。
 *
 * 【主な処理】
 *   1. 認証状態はSupabase Authのセッション（onAuthStateChange）と連動する。
 *      tasks（タスク一覧）・users（担当者一覧）はSupabaseのDBから取得し、
 *      テーマ・通知ON/OFF設定など「個人の見た目の好み」だけはこれまで通り
 *      ブラウザのlocalStorageに保存する（この2つは複数人で共有する必要が
 *      無いデータのため、あえてSupabase化していない）
 *   2. currentView（文字列）の切り替えだけで画面を出し分ける
 *      「一面集約型SPA」のルーティングを実現（外部ルーターは未使用・規約②）
 *   3. タスクの作成・編集・削除・ステータス変更・承認/差し戻しなど、
 *      タスク操作系ハンドラーをすべてここに集約し、子コンポーネントへ配布。
 *      いずれもSupabaseへの書き込み後に`refreshTasks()`で最新状態を
 *      再取得し直す、シンプルな「毎回サーバーから読み直す」方式にしている
 *      （楽観的更新はせず、まずは確実さを優先）
 *   4. グローバルヘッダー／担当者・カテゴリ・優先度のフィルターバー／サイドバー
 *      など、画面全体のレイアウトを組み立てる（フィルターは画面ごとに分けず、
 *      全画面共通の状態として扱う方針）
 *   5. tasksから「自分向けの通知」（遅延・当日締切・差し戻し・承認待ち）を
 *      都度算出し、ヘッダーの通知ベルのドロップダウンに表示する
 *   6. 「スケジュール」タブでは月間カレンダー形式のScheduleViewを表示する
 *      （「プロジェクト管理」タブは引き続き未実装のプレースホルダーのまま）
 *   7. 「設定」タブ（currentView==='settings'）では、テーマ／通知ON-OFF／
 *      サンプルデータのリセットを行うSettingsViewを表示する。ヘッダーの
 *      アバター横と、サイドバー下部のログアウト横、2箇所の⚙️ボタンから、
 *      どちらもこの同じ設定ページへ遷移する
 * -----------------------------------------------------------------------
 */
import { useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Task, AppTheme, User, NotificationType } from './types/task';
import { supabase } from './lib/supabaseClient';
import Sidebar from './components/Sidebar';
import KanbanBoard from './components/kanban/KanbanBoard';
import TaskForm from './components/TaskForm';
import { DashboardView } from './components/dashboard/DashboardView';
import { ScheduleView } from './components/schedule/ScheduleView';
import { SettingsView } from './components/settings/SettingsView';
import { Login } from './pages/Login';
import { RejectReasonModal } from './components/RejectReasonModal';
import { getTodayJstDateString } from './utils/date';

// 通知ベルに表示するアラートアイテム。種類（NotificationType）はtypes/task.tsで定義し、
// SettingsView.tsxの通知ON-OFF設定とも共有している
interface NotificationItem {
  id: string;
  type: NotificationType;
  task: Task;
  message: string;
}

// 通知ベルの4種類すべてを初期状態でON（従来通りの挙動）にしたデフォルト設定
const defaultNotificationSettings: Record<NotificationType, boolean> = {
  overdue: true,
  dueToday: true,
  rejected: true,
  reviewRequested: true,
};

// 「サンプルデータにリセット」（設定ページ）で作り直す、たたき台のサンプルタスク
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
    assignees: [],
    reviewerId: undefined,
  },
];

// Supabaseから取得した1行分の生データの型（tasksテーブル＋結合したtask_assignees/
// task_subtasks）。このファイル内でフロント用のTask型（src/types/task.ts）へ変換する
interface SupabaseTaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  category: string;
  start_date: string;
  end_date: string;
  priority: string;
  reviewer_id: string | null;
  return_reason: string | null;
  created_by: string;
  task_assignees: { user_id: string }[];
  task_subtasks: { id: string; title: string; done: boolean }[];
}

const mapRowToTask = (row: SupabaseTaskRow): Task => ({
  id: row.id,
  title: row.title,
  description: row.description ?? undefined,
  status: row.status as Task['status'],
  category: row.category as Task['category'],
  startDate: row.start_date,
  endDate: row.end_date,
  priority: row.priority as Task['priority'],
  assignees: row.task_assignees.map((a) => a.user_id),
  reviewerId: row.reviewer_id ?? undefined,
  returnReason: row.return_reason ?? undefined,
  subtasks: row.task_subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done })),
});

export default function App() {

  // ---- 認証（Supabase Authのセッションと連動） ----

  const [session, setSession] = useState<Session | null>(null);
  // 初回のセッション確認が終わるまでは、ログイン画面を一瞬出さないようにするためのフラグ
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    // ログイン・ログアウト・トークン更新などのセッション変化を購読し続ける
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const isAuthenticated = session !== null;
  // 自分（ログインユーザー）のID。通知ベルの「自分宛て」判定や、
  // タスク作成時のcreated_by／デフォルト担当者に使用する
  const currentUserId = session?.user.id ?? '';

  // ---- 状態管理（App.tsx が保持する Single Source of Truth） ----

  // 担当者一覧（Supabaseの`profiles`テーブルから取得）。ログインしていなければ空配列
  const [users, setUsers] = useState<User[]>([]);

  // タスク一覧本体（Supabaseの`tasks`テーブル＋担当者・サブタスクの結合データから取得）
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState<boolean>(false);

  // 配色テーマ（9種類）。これは複数人で共有する必要のない「個人の見た目の好み」なので、
  // 引き続きこのブラウザのlocalStorageにのみ保存する（Supabase化はしていない）
  const [theme, setTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem('dashboard_theme') as AppTheme) || 'sage-dark';
  });

  // 現在表示中のビュー（'dashboard' | 'tasks' | その他）。文字列切替による一面集約型ルーティング
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
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
  // 画面（タブ）ごとには分けず、全画面共通のフィルターとして扱う方針（ユーザー確認済み）
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // 差し戻し対象のタスクID（差し戻しモーダルの表示・非表示もこのstateで制御）
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);

  // ---- Supabaseとのデータ同期 ----

  // Supabaseからtasksを担当者・サブタスクごと結合して取得し直す共通関数。
  // タスクの作成・更新・削除のたびにこれを呼び、「サーバーの最新状態を毎回読み直す」
  // シンプルな方式にしている（楽観的更新はせず、まずは確実さを優先する設計判断）
  const refreshTasks = async () => {
    setTasksLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_assignees(user_id), task_subtasks(id, title, done)')
      .order('created_at', { ascending: false });
    setTasksLoading(false);

    if (error) {
      console.error('タスクの取得に失敗しました:', error);
      return;
    }
    setTasks(((data ?? []) as SupabaseTaskRow[]).map(mapRowToTask));
  };

  // ログイン状態が変わったら、担当者一覧・タスク一覧を取得し直す
  useEffect(() => {
    if (!isAuthenticated) {
      setUsers([]);
      setTasks([]);
      return;
    }

    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, display_name')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('担当者一覧の取得に失敗しました:', error);
          return;
        }
        setUsers((data ?? []).map((p) => ({ id: p.id, name: p.display_name })));
      });

    refreshTasks();

    return () => {
      cancelled = true;
    };
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

  // 通知ベルに表示する「自分宛て」のアラート一覧。サーバー通知ではなく、
  // 現在のtasksデータから毎レンダー時に導出するシンプルな仕組み。
  // ①遅延中 ②当日締切 ③自分のタスクが差し戻された ④自分がレビュアーで承認待ち、の4種類。
  // 各種類は設定ページ（SettingsView.tsx）でON/OFFでき、OFFの種類はここで一切生成しない
  const todayStr = getTodayJstDateString();
  const notifications: NotificationItem[] = [];

  tasks.forEach((task) => {
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

  // ---- タスク操作ハンドラー（子コンポーネントへPropsとして配布。すべてSupabase経由の非同期処理） ----

  // タスクの新規作成／編集保存。
  // 担当者（task_assignees）・サブタスク（task_subtasks）は、差分計算をせず
  // 「いったん全削除してから作り直す」方式にしている（認証・DB設計書.md 7章参照）。
  // 保存後はrefreshTasks()でサーバーの最新状態を読み直す
  const handleSaveTask = async (taskData: Omit<Task, 'id' | 'status'>) => {
    const taskRow = {
      title: taskData.title,
      description: taskData.description ?? null,
      category: taskData.category,
      start_date: taskData.startDate,
      end_date: taskData.endDate,
      priority: taskData.priority,
      // reviewerIdは「候補者がいない」場合にTaskForm側で空文字列('')になり得る。
      // ''のままだとuuid列への挿入時にPostgres側で「invalid input syntax for type uuid」エラー
      // （PostgREST経由では400として現れる）になるため、''もnullとして扱う（??ではなく||を使う理由）
      reviewer_id: taskData.reviewerId || null,
      return_reason: taskData.returnReason ?? null,
    };

    let taskId: string;

    if (editingTask) {
      taskId = editingTask.id;
      const { error } = await supabase.from('tasks').update(taskRow).eq('id', taskId);
      if (error) {
        alert('タスクの更新に失敗しました: ' + error.message);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...taskRow, status: 'todo', created_by: currentUserId })
        .select('id')
        .single();
      if (error || !data) {
        alert('タスクの作成に失敗しました: ' + (error?.message ?? '不明なエラー'));
        return;
      }
      taskId = data.id;
    }

    await supabase.from('task_assignees').delete().eq('task_id', taskId);
    if (taskData.assignees.length > 0) {
      await supabase.from('task_assignees').insert(
        taskData.assignees.map((userId) => ({ task_id: taskId, user_id: userId }))
      );
    }

    await supabase.from('task_subtasks').delete().eq('task_id', taskId);
    if (taskData.subtasks && taskData.subtasks.length > 0) {
      await supabase.from('task_subtasks').insert(
        taskData.subtasks.map((s) => ({ task_id: taskId, title: s.title, done: s.done }))
      );
    }

    await refreshTasks();
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  // タスクの削除（task_assignees・task_subtasksはon delete cascadeで自動的に一緒に消える）
  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      alert('削除に失敗しました: ' + error.message);
      return;
    }
    await refreshTasks();
  };

  // カンバンのドラッグ＆ドロップ等によるステータス変更。
  // doing以外へ移動した場合は差し戻し理由(returnReason)をクリアする
  const handleUpdateStatus = async (id: string, newStatus: Task['status']) => {
    const current = tasks.find((task) => task.id === id);
    const { error } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        return_reason: newStatus === 'doing' ? (current?.returnReason ?? null) : null,
      })
      .eq('id', id);
    if (error) {
      alert('ステータスの更新に失敗しました: ' + error.message);
      return;
    }
    await refreshTasks();
  };

  // 承認申請／承認完了／差し戻しの3アクションをまとめて処理する
  const handleProcessAction = async (id: string, action: 'apply' | 'approve' | 'reject', reason?: string) => {
    // reasonはRejectReasonModal側で必ずtrim済み・非空文字であることを保証済みのため、
    // ここでのデフォルト文言による補完（フォールバック）は不要（B案対応）
    const patch =
      action === 'apply' ? { status: 'review', return_reason: null } :
      action === 'approve' ? { status: 'done', return_reason: null } :
      { status: 'doing', return_reason: reason ?? null };

    const { error } = await supabase.from('tasks').update(patch).eq('id', id);
    if (error) {
      alert('操作に失敗しました: ' + error.message);
      return;
    }
    await refreshTasks();
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
  const handleConfirmReject = async (reason: string) => {
    if (rejectTargetId) {
      await handleProcessAction(rejectTargetId, 'reject', reason);
      handleCloseRejectModal();
    }
  };

  // サイドバーの項目選択によるビュー切り替え。スマホ幅（オーバーレイ表示）で選択した場合は、
  // 選択と同時にサイドバーを閉じてメイン画面が見えるようにする（PC幅では常時表示のため閉じない）
  const handleViewChange = (view: string) => {
    setCurrentView(view);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // 通知ベルの種類ごとのON/OFFを切り替える（設定ページから呼ばれる）
  const handleToggleNotification = (type: NotificationType) => {
    setNotificationSettings(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // ログアウト（設定ページやSidebarのログアウトボタンから呼ばれる）
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // タスクデータをサンプルタスクにリセットする（設定ページの「データ」セクションから呼ばれる）。
  // 複数人でタスクを共有する構成に変わったため、「自分が作成したタスクだけ」を削除して
  // 作り直す（他のユーザーが作成したタスクは削除しない）。元に戻せない操作のため、
  // 実行前に必ず確認ダイアログを挟む
  const handleResetSampleData = async () => {
    const confirmed = window.confirm(
      '自分が作成したタスクをすべて削除し、サンプルタスクを1件作り直します。' +
      'この操作は元に戻せません（他のユーザーが作成したタスクは削除されません）。よろしいですか？'
    );
    if (!confirmed) return;

    const { error: deleteError } = await supabase.from('tasks').delete().eq('created_by', currentUserId);
    if (deleteError) {
      alert('リセットに失敗しました: ' + deleteError.message);
      return;
    }

    const sample = initialTasks[0];
    const { data: inserted, error: insertError } = await supabase
      .from('tasks')
      .insert({
        title: sample.title,
        description: sample.description ?? null,
        status: sample.status,
        category: sample.category,
        start_date: sample.startDate,
        end_date: sample.endDate,
        priority: sample.priority,
        reviewer_id: users.find((u) => u.id !== currentUserId)?.id ?? null,
        created_by: currentUserId,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      alert('サンプルタスクの作成に失敗しました: ' + (insertError?.message ?? '不明なエラー'));
      return;
    }

    await supabase.from('task_assignees').insert({ task_id: inserted.id, user_id: currentUserId });
    await refreshTasks();
  };

  // ヘッダーのテーマ切替メニューに表示するラベル一覧（AppTheme各値 → 表示名）
  const themeLabels: Record<AppTheme, string> = {
    'sage-dark': 'SAGE', 'terracotta-dark': 'TERRACOTTA', 'bronze-dark': 'BRONZE',
    'ocean-dark': 'OCEAN', 'amethyst-dark': 'AMETHYST', 'graphite-dark': 'GRAPHITE',
    'lime-dark': 'LIME', 'light': 'LIGHT', 'coffee-dark': 'COFFEE',
  };

  // 初回のセッション確認が終わるまでは、何も出さず待つ（ログイン画面がちらつくのを防ぐ）
  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-base text-text-sub text-xs font-bold tracking-widest uppercase">
        読み込み中…
      </div>
    );
  }

  // 未ログイン時はログイン画面のみを表示し、以降のダッシュボードUIは描画しない
  if (!isAuthenticated) {
    return <Login />;
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
          onViewChange={handleViewChange}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onLogout={handleLogout}
          onOpenSettings={() => handleViewChange('settings')}
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
              {currentView === 'dashboard' ? 'ダッシュボード' : currentView === 'tasks' ? 'タスクボード' : currentView === 'schedule' ? 'スケジュール' : currentView === 'settings' ? '設定' : '拡張機能'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
            <button
              onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }}
              className="h-9 px-3 md:px-4 bg-accent hover:bg-accent/90 text-slate-950 font-black text-xs tracking-wider rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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

            {/* アバター：自分のprofiles.display_nameの先頭2文字を表示（未取得時は空欄） */}
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-border-card border border-accent/30 flex items-center justify-center font-bold text-[8px] md:text-[10px] flex-shrink-0" title={myProfile?.name}>
              {myProfile ? myProfile.name.slice(0, 2) : ''}
            </div>
          </div>
        </header>

        {/* グローバル操作フィルターバー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 md:px-8 py-2.5 bg-card/10 border-b border-border-card flex-shrink-0 select-none">
          {/* 担当者・カテゴリ・優先度の3つの選択を flex-wrap にし、幅の狭いスマホ画面でも
              横はみ出し（横スクロール）せず自然に折り返すようにする。
              画面（タブ）ごとには分けず、全画面共通のフィルターとして扱う（ユーザー確認済み） */}
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

        {/* メインビュー領域（独立スクロール）
            高さは h-[calc(...)] のような固定値ではなく flex-1 + min-h-0 で計算しており、
            ヘッダーやフィルターバーの実際の高さ（スマホ幅で折り返して増える等）に
            関わらず、残り領域を正しく埋める */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 bg-base/50">
          <div className="max-w-7xl mx-auto w-full h-full">
            {tasksLoading && tasks.length === 0 && (
              <p className="text-[11px] text-text-sub font-bold tracking-wider mb-4">タスクを読み込み中…</p>
            )}
            {currentView === 'dashboard' ? (
              <div className="animate-fade-in pb-8">
                <DashboardView tasks={tasks} users={users} filterUser={filterUser} filterCategory={filterCategory} filterPriority={filterPriority} />
              </div>
            ) : currentView === 'tasks' ? (
              <div className="space-y-6 animate-fade-in pb-8">
                <KanbanBoard
                  tasks={tasks}
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
            ) : currentView === 'schedule' ? (
              <div className="animate-fade-in pb-8">
                <ScheduleView
                  tasks={tasks}
                  filterUser={filterUser}
                  filterCategory={filterCategory}
                  filterPriority={filterPriority}
                  onStartEdit={handleStartEdit}
                />
              </div>
            ) : currentView === 'settings' ? (
              <div className="animate-fade-in pb-8">
                <SettingsView
                  theme={theme}
                  themeLabels={themeLabels}
                  onThemeChange={setTheme}
                  notificationSettings={notificationSettings}
                  onToggleNotification={handleToggleNotification}
                  onResetSampleData={handleResetSampleData}
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
      />
      {/* 一番底に新設モーダルをマウント（設定は独立したページになったため、ここにはマウントしない） */}
      <RejectReasonModal
        isOpen={rejectTargetId !== null}
        onClose={handleCloseRejectModal}
        onSubmit={handleConfirmReject}
      />
    </div>
  );
}
