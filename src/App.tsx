/**
 * src/App.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   アプリ全体を束ねるルートコンポーネント。tasks・ユーザー一覧・認証状態・
 *   テーマ・フィルター条件・選択中プロジェクトなど「すべての状態」をここで
 *   一元管理するSingle Source of Truth（規約①）。子・孫コンポーネントは状態を
 *   直接書き換えず、Props経由で渡された関数（onUpdateStatus 等）を
 *   呼び出すことでのみ状態変更をリクエストする。
 *
 * 【主な処理】
 *   1. 認証状態はSupabase Authのセッション（onAuthStateChange）と連動する。
 *      tasks（タスク一覧）・users（担当者一覧）・projects（参加プロジェクト一覧）は
 *      SupabaseのDBから取得し、テーマ・通知ON/OFF設定・選択中プロジェクトなど
 *      「個人の見た目の好み・選択状態」だけはこれまで通りブラウザのlocalStorageに
 *      保存する（複数人で共有する必要が無いデータのため、あえてSupabase化していない）
 *   2. currentView（文字列）の切り替えだけで画面を出し分ける
 *      「一面集約型SPA」のルーティングを実現（外部ルーターは未使用・規約②）
 *   3. タスクの作成・編集・削除・ステータス変更・承認/差し戻しなど、
 *      タスク操作系ハンドラーをすべてここに集約し、子コンポーネントへ配布。
 *      いずれもSupabaseへの書き込み後に`refreshTasks()`で最新状態を
 *      再取得し直す、シンプルな「毎回サーバーから読み直す」方式にしている
 *      （楽観的更新はせず、まずは確実さを優先）
 *   4. グローバルヘッダー／担当者・カテゴリ・優先度のフィルターバー／サイドバー
 *      など、画面全体のレイアウトを組み立てる（フィルターは画面ごとに分けず、
 *      全画面共通の状態として扱う方針）。ヘッダーには選択中プロジェクト名の
 *      バッジも常時表示する（ユーザー要望：2026-08-29。sm未満の画面幅では省略）
 *   5. tasksから「自分向けの通知」（遅延・当日締切・差し戻し・承認待ち）を
 *      都度算出し、ヘッダーの通知ベルのドロップダウンに表示する
 *   6. 「スケジュール」タブでは月間カレンダー形式のScheduleViewを表示する
 *   7. 「設定」タブ（currentView==='settings'）では、テーマ／通知ON-OFF／
 *      サンプルデータのリセットを行うSettingsViewを表示する。ヘッダーの
 *      アバター横と、サイドバー下部のログアウト横、2箇所の⚙️ボタンから、
 *      どちらもこの同じ設定ページへ遷移する
 *   8. 【プロジェクト管理機能】currentProjectId（選択中プロジェクト）を1つ保持し、
 *      ダッシュボード／タスクボード／スケジュールの3画面はこのプロジェクトの
 *      タスクだけをSupabaseから取得して表示する（`.eq('project_id', ...)`で絞り込み。
 *      プロジェクト管理機能_要件定義書.md §1・§2.1・§4）。未選択の間はこの3画面に
 *      「プロジェクトを選択してください」という案内を出す。「プロジェクト管理」タブ
 *      （currentView==='project'）では、参加プロジェクトのカード一覧・新規作成・編集・削除
 *      （ProjectManagementView・ProjectFormModal）を提供する。検索＋ステータスタブによる
 *      絞り込みにも対応する（§2.2〜2.3）。オーナーはカードから「メンバー管理」を開き、
 *      メンバーの追加・削除・オーナー譲渡ができる（MemberManagementModal。§2.4・§6.1）。
 *      オーナー以外のメンバーは「抜ける」でプロジェクトから脱退できる
 *   9. 【ステップ6】TaskForm.tsxの編集画面には「プロジェクト」欄があり、自分が参加している
 *      他のプロジェクトへタスクを移動できる（§2.5）。担当者・確認者の選択候補は、常に
 *      選択中プロジェクトのメンバーに絞り込まれ、移動先のメンバーでなくなる担当者・確認者は
 *      自動的に選択から外れる。この絞り込みに使うprojectMembersは、ログイン時点で
 *      取得しておく（「プロジェクト管理」タブを開いていなくても使えるようにするため）
 *  10. 【ステップ7】退会（設定＞データ）時、自分がオーナーかつ他にもメンバーがいる
 *      プロジェクトが1件以上残っていると、通常の退会ボタンの代わりにオーナー引き継ぎ
 *      セクション（OwnershipHandoverSection.tsx）を表示し、先にすべて新オーナーへ
 *      譲渡させる（§6.2）。自分1人だけがオーナーのプロジェクトは、退会実行時に
 *      delete_own_account()側でタスクごとまとめて削除される
 *  11. 【ステップ8】通知ベルは選択中プロジェクトに絞らず、自分が参加している全プロジェクトを
 *      横断して通知する（§4）。判定専用のnotificationTasks（tasksとは別state）をログイン時・
 *      20秒ポーリング・各種タスク操作の直後に取得し直す。通知アイテムをクリックした際、
 *      そのタスクが選択中でない別プロジェクトのものであれば、currentProjectIdを自動的に
 *      そのプロジェクトへ切り替えてから編集モーダルを開く（handleNotificationClick）。
 *      【追加要望・2026-08-29】通知が全プロジェクト横断になり見にくいという指摘を受け、
 *      ヘッダーの通知ベルは直近6件＋プロジェクト名タグのプレビューに徹し、全件は
 *      「すべて見る→」から通知専用画面（NotificationsView.tsx・currentView='notifications'。
 *      サイドバーには項目を増やさず、設定ページと同様ベルからのみ入る）で確認する構成にした
 * -----------------------------------------------------------------------
 */
import { useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Task, AppTheme, User, NotificationType, NotificationItem, Project, ProjectStatus } from './types/task';
import { supabase } from './lib/supabaseClient';
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
// （NotificationsView.tsx）とも共有するため、types/task.tsに集約している（ステップ8）

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
    createdBy: '', // このサンプルテンプレートのcreatedByは未使用（実際の挿入時はcurrentUserIdを使う）
    projectId: '', // 同上：このサンプルテンプレートのprojectIdは未使用（実際の挿入時はcurrentProjectIdを使う。
                    // handleResetSampleData参照。Task型がprojectIdを必須化したため、型を満たすためだけに追加）
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
  project_id: string;
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
  createdBy: row.created_by,
  projectId: row.project_id,
});

// 【ポーリング改善・2026-08-30】20秒ごとのポーリングで内容が変わっていないのに
// setTasks/setNotificationTasksを呼んでしまうと、配列・オブジェクトの参照が毎回
// 新しくなるため無駄な再レンダリングが起きる。内容が完全に同じ場合はstate更新自体を
// スキップするための簡易比較（この規模のアプリではJSON文字列比較で十分）
const tasksEqual = (a: Task[], b: Task[]) => JSON.stringify(a) === JSON.stringify(b);

// Supabaseから取得した1行分のプロジェクト生データの型（projectsテーブル）。
// mapRowToTaskと同様、このファイル内でフロント用のProject型へ変換する
interface SupabaseProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_by: string;
}

const mapRowToProject = (row: SupabaseProjectRow): Project => ({
  id: row.id,
  name: row.name,
  description: row.description ?? undefined,
  status: row.status as ProjectStatus,
  createdBy: row.created_by,
});

export default function App() {

  // ---- 認証（Supabase Authのセッションと連動） ----

  const [session, setSession] = useState<Session | null>(null);
  // 初回のセッション確認が終わるまでは、ログイン画面を一瞬出さないようにするためのフラグ
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // パスワード再設定メールのリンクを踏んだ直後かどうか。trueの間は、ログイン後でも
  // 通常のダッシュボードではなく「新しいパスワードを入力する」画面（ResetPassword.tsx）を
  // 優先して表示する（下記の画面出し分けを参照）
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    // ログイン・ログアウト・トークン更新などのセッション変化を購読し続ける。
    // パスワード再設定メールのリンクをクリックすると、Supabaseが自動的にURL内の
    // トークンを検知して一時セッションを確立し、ここに'PASSWORD_RECOVERY'イベントが
    // 届く（このタイミングではsessionはすでに存在するが、まだ新しいパスワードは
    // 設定されていない状態）
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
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

  // 【ステップ8：通知ベルの全プロジェクト横断対応】通知ベルの判定専用に、選択中プロジェクトに
  // 絞らず「自分が参加している全プロジェクト」のタスクを保持する（要件定義書§4）。
  // tasks（画面表示用。currentProjectIdで絞り込み）とは別に持つ理由は、通知ベルだけは
  // 選択中プロジェクトに関係なく全プロジェクト横断で気づけるようにするため
  const [notificationTasks, setNotificationTasks] = useState<Task[]>([]);

  // 参加中プロジェクトの一覧（Supabaseの`projects`テーブルから取得。RLSにより自分が
  // メンバーのプロジェクトのみが返る。プロジェクト管理機能_要件定義書.md §3.1）
  const [projects, setProjects] = useState<Project[]>([]);

  // 選択中プロジェクトのID。テーマと同様、複数人で共有する必要のない「個人の選択状態」
  // なのでブラウザのlocalStorageに保存し、リロードしても直前に見ていたプロジェクトを
  // 復元する（§2.1）。未選択（null）の間は、後述の3画面に案内を表示しタスクは取得しない
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    return localStorage.getItem('dashboard_current_project_id') || null;
  });

  // サイドバーの「プロジェクト管理」アコーディオンの開閉状態。isSidebarOpen等の他のUI
  // トグルと同様、Sidebar.tsx側には状態を持たせずApp.tsxで一元管理する（規約①・ui-theming.md）
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState<boolean>(false);

  // 【ステップ4：プロジェクト管理タブ】各プロジェクトのメンバー一覧（user_id・role）と
  // タスク件数・完了数。カードの「メンバー数」「進捗％」表示に使う。当初はプロジェクト管理
  // タブを開いたときだけ取得する設計だったが、【ステップ6】でTaskForm.tsxの担当者・確認者
  // 候補の絞り込みにも使うようになったため、ログイン時点（isAuthenticated）でも
  // refreshProjectSummaries()を呼ぶよう変更した（下記useEffect参照）
  const [projectMembers, setProjectMembers] = useState<Record<string, { userId: string; role: string }[]>>({});
  const [projectTaskCounts, setProjectTaskCounts] = useState<Record<string, { total: number; done: number }>>({});

  // プロジェクト作成・編集モーダルの開閉状態と編集対象。同じ理由でApp.tsxに一元管理する
  const [isProjectFormOpen, setIsProjectFormOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);

  // 【ステップ5：メンバー管理・オーナー譲渡UI】メンバー管理モーダルの開閉状態。
  // 対象プロジェクトはIDだけ保持し、実体はprojectsから都度参照する（他の編集操作と同様、
  // 削除等でprojectsが更新されても参照先がずれない）
  const [memberModalProjectId, setMemberModalProjectId] = useState<string | null>(null);

  // プロジェクト管理タブの検索・ステータスタブによる絞り込み（§2.2。ユーザー要望：
  // 2026-08-29で「アーカイブ済みを表示」チェックボックスから置き換え）。他のフィルター系
  // state（filterUser等）と同様、画面遷移時にリセットされる一時的な表示設定として扱い、
  // localStorageには保存せず都度初期値から始める
  const [projectStatusFilter, setProjectStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [projectSearchQuery, setProjectSearchQuery] = useState<string>('');

  // 配色テーマ（12種類）。これは複数人で共有する必要のない「個人の見た目の好み」なので、
  // 引き続きこのブラウザのlocalStorageにのみ保存する（Supabase化はしていない）。
  // デフォルトはGRAPHITE（2026-08-25変更。src/index.cssの`:root`側もGRAPHITEに合わせてある）
  const [theme, setTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem('dashboard_theme') as AppTheme) || 'graphite-dark';
  });

  // 現在表示中のビュー（'dashboard' | 'tasks' | その他）。文字列切替による一面集約型ルーティング
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  // 通知ベルのドロップダウン開閉状態
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  // ヘッダーのアバター画像をクリックしたときの拡大表示（ImageLightbox）の開閉状態
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState<boolean>(false);

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
  // シンプルな方式にしている（楽観的更新はせず、まずは確実さを優先する設計判断）。
  // currentProjectIdで絞り込み、未選択（null）の間は取得自体を行わない
  // （プロジェクト管理機能_要件定義書.md §1・§4。tasks.project_idはNOT NULL制約のため、
  // 未選択のままクエリしても意味のある結果にならない）
  // 【ポーリング改善・2026-08-30】opts.silentは20秒ポーリングからの呼び出し時にtrueを渡す。
  // 通常のsetTasksLoading表示（tasks.length === 0の間だけ出るローディング表示）は初回読み込みや
  // プロジェクト切り替え時にのみ必要で、バックグラウンドのポーリングでは不要なstate更新のため
  const refreshTasks = async (opts?: { silent?: boolean }) => {
    if (!currentProjectId) {
      setTasks([]);
      return;
    }
    if (!opts?.silent) setTasksLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_assignees(user_id), task_subtasks(id, title, done)')
      .eq('project_id', currentProjectId)
      // 【ポーリング改善・2026-08-30】created_atが同一の行が複数ある場合、この二次キーが
      // ないとPostgres側で返却順が確定せず、ポーリングのたびにカードの並びが入れ替わって
      // 見える（画面がかくつく・動く原因の一つ）。idで確定させることで並び順を安定させる
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });
    if (!opts?.silent) setTasksLoading(false);

    if (error) {
      console.error('タスクの取得に失敗しました:', error);
      return;
    }
    const next = ((data ?? []) as SupabaseTaskRow[]).map(mapRowToTask);
    setTasks((prev) => (tasksEqual(prev, next) ? prev : next));
  };

  // 【ステップ8：通知ベルの全プロジェクト横断対応】通知ベル用に、project_idで絞り込まず
  // 全タスクを取得し直す共通関数。RLS（is_project_member経由のtasksポリシー）により、
  // 自分が参加しているプロジェクトのタスクだけが自動的に返るため、クライアント側での
  // user_id/project_id絞り込みは不要（refreshProjectsと同じ考え方）
  const refreshNotificationTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_assignees(user_id), task_subtasks(id, title, done)')
      // 【ポーリング改善・2026-08-30】refreshTasksと同様、二次キーで並び順を確定させる
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });

    if (error) {
      console.error('通知用タスクの取得に失敗しました:', error);
      return;
    }
    const next = ((data ?? []) as SupabaseTaskRow[]).map(mapRowToTask);
    setNotificationTasks((prev) => (tasksEqual(prev, next) ? prev : next));
  };

  // Supabaseから自分の参加プロジェクト一覧を取得し直す共通関数。RLS
  // （projects_select_member。supabase-migration-projects.sql参照）が自分がメンバーの
  // プロジェクトだけを返すため、クライアント側でのuser_id絞り込みは不要
  const refreshProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      // 【ポーリング改善・2026-08-30】refreshTasksと同様、二次キーで並び順を確定させる
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      console.error('プロジェクト一覧の取得に失敗しました:', error);
      return;
    }
    setProjects(((data ?? []) as SupabaseProjectRow[]).map(mapRowToProject));
  };

  // 【ステップ4：プロジェクト管理タブ】カード表示用の「メンバー数」「タスク進捗」を取得する。
  // project_members・tasksともにRLS（is_project_member）が自分の参加プロジェクト分だけを
  // 返すため、project_idでの絞り込みは不要（refreshProjects/refreshTasksと同じ考え方）。
  // タブを開いたときだけ呼び出す重めの集計クエリなので、ログイン直後の全画面ロードには含めない
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

  // ログイン状態が変わったら、担当者一覧・参加プロジェクト一覧を取得し直す
  // （タスク一覧は下のuseEffectで、currentProjectIdの変化も合わせて取得し直す）
  useEffect(() => {
    if (!isAuthenticated) {
      setUsers([]);
      setProjects([]);
      setNotificationTasks([]);
      return;
    }

    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('担当者一覧の取得に失敗しました:', error);
          return;
        }
        setUsers((data ?? []).map((p) => ({ id: p.id, name: p.display_name, avatarUrl: p.avatar_url ?? undefined })));
      });

    refreshProjects();
    // 【ステップ6】担当者・確認者の候補をプロジェクトのメンバーに絞り込むため（TaskForm.tsx）、
    // 「プロジェクト管理」タブを開いていなくてもログイン時点でprojectMembersを取得しておく
    // （元々は§9-4でプロジェクト管理タブを開いたときだけ取得する設計だったが、ダッシュボード等
    // からタスク編集を開いた際にも必要になったため、ログイン時にも取得するよう変更）
    refreshProjectSummaries();
    // 【ステップ8】通知ベルは選択中プロジェクトに関係なく全プロジェクト横断で必要なため、
    // ログイン時点で取得しておく（currentProjectIdが未選択・未確定の間も通知は出したいため）
    refreshNotificationTasks();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // ログイン状態、または選択中プロジェクトが変わるたびにタスク一覧を取得し直す
  // （サイドバーのアコーディオンでプロジェクトを切り替えた瞬間もここで再取得される）
  useEffect(() => {
    if (!isAuthenticated) {
      setTasks([]);
      return;
    }
    refreshTasks();
  }, [isAuthenticated, currentProjectId]);

  // 【ステップ4：プロジェクト管理タブ】タブを開いたとき（currentView==='project'）だけ
  // メンバー数・タスク進捗の集計を取得し直す（サイドバーのアコーディオンでの切り替えのみを
  // 行っている間はこのクエリを発生させない）
  useEffect(() => {
    if (!isAuthenticated || currentView !== 'project') return;
    refreshProjectSummaries();
  }, [isAuthenticated, currentView]);

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

  // 他ユーザーの操作（例：別アカウントが承認申請してreview状態にした等）にリアルタイムに
  // 反応する仕組み（Supabase Realtimeのsubscribe等）はまだ導入していないため、画面を開きっ
  // ぱなしにしていると、他ユーザー側の変更は自分の手元のtasksには自動反映されない
  // （＝確認者アカウントの通知ベルが更新されない、という形で症状が出る）。
  // 本格的な対応（Realtime導入）は別途行う想定だが、暫定策として一定間隔でタスク一覧を
  // ポーリングし直し、通知やカンバン表示がある程度追従するようにしている
  //
  // 【不具合修正・2026-08-29】依存配列が[isAuthenticated]のみだった際、setIntervalのコールバックが
  // クロージャとしてタイマー作成時点のrefreshTasks（＝その時点のcurrentProjectId）を握ったまま
  // 更新されず、プロジェクトを切り替えても「ログイン直後に選択されていたプロジェクト」のタスクを
  // 取得し続けてしまう不具合があった（切り替え直後は正しく表示されるが、最大20秒以内に古い
  // プロジェクトの内容で上書きされる、という形で発現）。currentProjectIdを依存配列に加え、
  // プロジェクトが変わるたびにタイマーを作り直す（＝常に最新のrefreshTasksを使う）ことで解消
  //
  // 【ステップ8】通知ベルは全プロジェクト横断（notificationTasks）になったため、こちらも
  // 同じタイマーで一緒に取得し直す。refreshNotificationTasks自体はcurrentProjectIdに
  // 依存しないが、同じ間隔で回して問題ないため、既存のタイマーに相乗りさせている
  //
  // 【ポーリング改善・2026-08-30】ユーザーから「20秒ごとに画面がかくつく／動く」との報告。
  // 主因は、created_at一意の二次キーがなくSupabase側の行の返却順が不安定だったこと
  // （同着タスクの並びがポーリングのたびに入れ替わって見えていた）。refreshTasks／
  // refreshNotificationTasks／refreshProjectsの.order()にidを二次キーとして追加し解消。
  // 併せて、内容に変化がない場合はsetTasks等を呼ばないようにし（tasksEqual参照）、
  // ポーリング中のsetTasksLoading表示も抑制（silentオプション）して無駄な再レンダリングを削減。
  // 本格対応（Supabase Realtime導入）は仕様書.md／認証・DB設計書.mdにTODOとして記載済み
  useEffect(() => {
    if (!isAuthenticated) return;
    const intervalId = setInterval(() => {
      refreshTasks({ silent: true }); // 【ポーリング改善・2026-08-30】バックグラウンド更新なのでローディング表示は出さない
      refreshNotificationTasks();
    }, 20000); // 20秒間隔（頻度を上げすぎるとAPI呼び出しが増えるため、通知用途としてはこの程度で妥協）
    return () => clearInterval(intervalId);
  }, [isAuthenticated, currentProjectId]);

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

  // 選択中プロジェクトの実体（ヘッダーの常時表示バッジ用。ユーザー要望：2026-08-29。
  // 「今どのプロジェクトを見ているか常に分かるようにしたい」との理由で追加）
  const currentProject = projects.find((p) => p.id === currentProjectId);

  // 【ステップ7：オーナー引き継ぎ】自分がオーナーで、かつ他にもメンバーがいる
  // プロジェクト一覧（設定＞データ画面で、退会前に新オーナーへの譲渡を求める対象。
  // 要件定義書§6.2）。projectMembersの更新のたびに再計算されるため、譲渡が完了して
  // 対象が0件になれば、SettingsView.tsx側の分岐が自動的に通常の退会ボタンへ戻る
  const projectsNeedingOwnershipHandover = projects.filter((p) => {
    const members = projectMembers[p.id] ?? [];
    const isOwner = members.some((m) => m.userId === currentUserId && m.role === 'owner');
    return isOwner && members.length > 1;
  });

  // 通知ベルに表示する「自分宛て」のアラート一覧。サーバー通知ではなく、
  // notificationTasksデータ（全プロジェクト横断。ステップ8・要件定義書§4）から毎レンダー時に
  // 導出するシンプルな仕組み。選択中プロジェクトのtasksとは別データのため、選択中でない
  // 別プロジェクトの承認待ち等にも気づける。
  // ①遅延中 ②当日締切 ③自分のタスクが差し戻された ④自分がレビュアーで承認待ち、の4種類。
  // 各種類は設定ページ（SettingsView.tsx）でON/OFFでき、OFFの種類はここで一切生成しない
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

  // ---- タスク操作ハンドラー（子コンポーネントへPropsとして配布。すべてSupabase経由の非同期処理） ----

  // タスクの新規作成／編集保存。
  // 担当者（task_assignees）・サブタスク（task_subtasks）は、差分計算をせず
  // 「いったん全削除してから作り直す」方式にしている（認証・DB設計書.md 7章参照）。
  // 保存後はrefreshTasks()でサーバーの最新状態を読み直す
  // createdBy（作成者）は受け取らない。新規作成時はここでcurrentUserIdから設定するため
  // （TaskForm.tsx側もOmitで除外している）
  const handleSaveTask = async (taskData: Omit<Task, 'id' | 'status' | 'createdBy'>) => {
    // 新規作成時はcurrentProjectIdが必須（tasks.project_idはNOT NULL制約のため。
    // プロジェクト管理機能_要件定義書.md §3.3）。編集時（editingTaskがある場合）は
    // TaskForm.tsxの「プロジェクト」欄（§2.5・ステップ6）でtaskData.projectIdが
    // 他プロジェクトのIDに変わっている可能性があるため、下記taskRowにそのまま含める
    if (!editingTask && !currentProjectId) {
      alert('プロジェクトが選択されていません。サイドバーからプロジェクトを選択してください。');
      return;
    }

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
      // 新規作成時は下のinsertで必ずcurrentProjectIdへ上書きされる（TaskForm側の初期値も
      // currentProjectId基準のため通常は同じ値になるが、insert側を信頼できる値として優先する）
      project_id: taskData.projectId,
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
        .insert({ ...taskRow, status: 'todo', created_by: currentUserId, project_id: currentProjectId })
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
    await refreshNotificationTasks(); // 【ステップ8】保存したタスクが他プロジェクトの場合もあるため通知も更新
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  // タスクの削除（task_assignees・task_subtasksはon delete cascadeで自動的に一緒に消える）。
  // RLSポリシー上、削除は作成者(created_by)のみ可能（認証・DB設計書.md5章）。ただしTaskCard.tsxの
  // 削除ボタンは誰のタスクでも表示されるため、他人のタスクを削除しようとした場合、Supabase側は
  // エラーを返さず「0件削除」で成功扱いになる（RLSが対象行を除外するだけのため）。
  // それをそのままrefreshTasks()すると、ユーザーには「削除ボタンを押したのに何も起きない」
  // という原因不明の挙動に見えてしまうため、削除件数を明示的に確認し、0件のときは理由を伝える
  const handleDeleteTask = async (id: string) => {
    const { error, count } = await supabase.from('tasks').delete({ count: 'exact' }).eq('id', id);
    if (error) {
      alert('削除に失敗しました: ' + error.message);
      return;
    }
    if (count === 0) {
      alert('このタスクは削除できません（作成者のみ削除できます）。');
      return;
    }
    await refreshTasks();
    await refreshNotificationTasks(); // 【ステップ8】削除したタスクの通知も即座に消す
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
    await refreshNotificationTasks(); // 【ステップ8】ステータス変更（遅延解消等）を通知へ即座に反映
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
    await refreshNotificationTasks(); // 【ステップ8】承認申請・承認・差し戻しを通知へ即座に反映
  };

  // タスクカードクリック等によるタスク編集モーダルの起動
  const handleStartEdit = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  // 【ステップ8】通知ベルのアイテムをクリックしたときの起動（要件定義書§4）。
  // 通知は全プロジェクト横断（notificationTasks）のため、クリックしたタスクが選択中でない
  // 別プロジェクトのものであれば、先にcurrentProjectIdをそのプロジェクトへ自動的に
  // 切り替えてから編集モーダルを開く（切り替えないと、TaskForm.tsxを閉じた後に戻る
  // ダッシュボード等が選択中プロジェクトのままで、せっかく開いたタスクの文脈と食い違うため）
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

  // サイドバーの項目選択によるビュー切り替え。スマホ幅（オーバーレイ表示）で選択した場合は、
  // 選択と同時にサイドバーを閉じてメイン画面が見えるようにする（PC幅では常時表示のため閉じない）
  const handleViewChange = (view: string) => {
    setCurrentView(view);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // サイドバーのアコーディオンでプロジェクトを選択したときの処理（要件定義書§2.1）。
  // 選択したプロジェクトをcurrentProjectIdにし、自動的にダッシュボードへ遷移する
  // （スマホ幅でサイドバーを閉じる処理はhandleViewChangeにすでにあるものを再利用する）
  const handleSelectProject = (id: string) => {
    setCurrentProjectId(id);
    handleViewChange('dashboard');
  };

  // サイドバーの「プロジェクト管理」アコーディオンの開閉切り替え
  const handleToggleProjectMenu = () => setIsProjectMenuOpen((prev) => !prev);

  // 【ステップ4：プロジェクト管理タブ】新規作成モーダルを開く（編集対象なし）
  const handleOpenCreateProject = () => {
    setEditingProject(undefined);
    setIsProjectFormOpen(true);
  };

  // 既存プロジェクトの編集モーダルを開く（ProjectManagementView側でオーナーのみに表示済み）
  const handleOpenEditProject = (project: Project) => {
    setEditingProject(project);
    setIsProjectFormOpen(true);
  };

  const handleCloseProjectForm = () => {
    setIsProjectFormOpen(false);
    setEditingProject(undefined);
  };

  // プロジェクトの新規作成・編集の保存。作成時はhandle_new_project()トリガー
  // （supabase-migration-projects.sql）がcreated_byを自動的にオーナーとしてproject_membersへ
  // 登録するため、ここではprojectsテーブルへのinsertのみを行えばよい。
  // 新規作成した場合は、確認済みの仕様どおり作成したプロジェクトをそのまま選択中にする
  //
  // 【はまった不具合と修正】`.insert(...).select('id').single()`のRETURNINGは、SELECT用のRLS
  // ポリシー（projects_select_member）の可視性チェックも受けるが、上記トリガーがproject_members
  // へオーナー登録を終える前にこのチェックが走ってしまい、「作成した本人なのに作成直後は
  // 自分のプロジェクトが見えない」という理由でRETURNINGが失敗していた（RLSの一種の
  // 鶏と卵問題）。projects_select_memberに「auth.uid() = created_by」も許可条件として
  // 追加することで解消済み（supabase-migration-projects-select-fix.sql参照）
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

  // プロジェクトの削除（オーナーのみ。RLSの`projects_delete_owner`で保証。ProjectManagementView側でも
  // オーナーのみに削除ボタンを表示済み。supabase.mdのルール：DB側の権限とUI側の表示を一致させる）。
  // `tasks.project_id`は`on delete cascade`のため、配下のタスクもまとめて削除される。
  // 元に戻せない操作のため、実行前に必ず確認ダイアログを挟む（code-style.mdのルール）
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

  // 【ステップ5：メンバー管理・オーナー譲渡UI】メンバー管理モーダルの開閉
  // （ProjectManagementView側でオーナーのみに「メンバー管理」ボタンを表示済み）
  const handleOpenMemberModal = (project: Project) => setMemberModalProjectId(project.id);
  const handleCloseMemberModal = () => setMemberModalProjectId(null);

  // モーダルに渡す対象プロジェクトの実体。projects一覧から都度参照するため、
  // 削除・編集等でprojectsが更新されてもモーダル側の表示は自動的に追従する
  const memberModalProject = projects.find((p) => p.id === memberModalProjectId);

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

  // オーナー譲渡（要件定義書§6.1）。呼び出し本人が現オーナーであることの検証は
  // transfer_project_ownership()側（security definer）で行われるため、ここでは
  // 確認ダイアログを挟んでRPCを呼ぶだけでよい。実行すると自分はメンバーに降格するため、
  // オーナー限定の操作ボタンが出せなくなる状態を避けるためモーダルを閉じる
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

  // 【ステップ7：オーナー引き継ぎ】退会フロー（設定＞データ画面）からのオーナー譲渡。
  // 上のhandleTransferOwnershipはメンバー管理モーダル専用（対象をmemberModalProjectIdから
  // 決め、成功後にモーダルを閉じる）ため、退会フロー用に別関数として用意する。
  // こちらはモーダルを持たず、OwnershipHandoverSection.tsx側の行ごとのエラー表示に使うため
  // エラーメッセージ文字列（またはnull）をそのまま返す（onDeleteAccount等と同じ形式）
  const handleTransferOwnershipForRetirement = async (projectId: string, newOwnerId: string): Promise<string | null> => {
    const { error } = await supabase.rpc('transfer_project_ownership', {
      p_project_id: projectId,
      p_new_owner_id: newOwnerId,
    });
    if (error) return 'オーナー譲渡に失敗しました: ' + error.message;
    await refreshProjectSummaries();
    return null;
  };

  // プロジェクトからの脱退（オーナー以外のメンバー本人のみ。RLSの
  // `project_members_delete_owner_or_self`で保証。オーナー本人は他の誰かへ譲渡するまで
  // 抜けられない仕様のため、ProjectManagementView側でも非オーナーにのみ「抜ける」ボタンを
  // 表示済み）。脱退後に選択中プロジェクトだった場合の後始末は、既存のuseEffect
  // （projectsから選択中プロジェクトが消えたらcurrentProjectIdをnullにする）に任せる
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

  // 表示名を変更する（設定ページのプロフィールセクションから呼ばれる）。
  // profiles.display_nameを更新し、担当者一覧（users）にも即座に反映する
  // （users配列を作り直すためだけにrefreshし直すのは無駄が多いため、ローカルでも更新する）
  const handleUpdateDisplayName = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('profiles').update({ display_name: trimmed }).eq('id', currentUserId);
    if (error) throw error;
    setUsers(prev => prev.map(u => (u.id === currentUserId ? { ...u, name: trimmed } : u)));
  };

  // アバター画像をアップロードする（設定ページのプロフィールセクションから呼ばれる）。
  // Supabase Storageの`avatars`バケット（supabase-migration-profile.sql参照）に
  // 「<自分のuser_id>/avatar」という固定パスでアップロードし（upsert:trueで毎回上書き、
  // 別ファイルが増え続けないようにする）、公開URLをprofiles.avatar_urlに保存する。
  // 同じパスを使い回すと同じURLになりブラウザ/CDNのキャッシュが残りやすいため、
  // 保存するURLの末尾にタイムスタンプを付けてキャッシュを回避する
  const handleUploadAvatar = async (file: File) => {
    const path = `${currentUserId}/avatar`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const bustedUrl = `${data.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: bustedUrl }).eq('id', currentUserId);
    if (updateError) throw updateError;

    setUsers(prev => prev.map(u => (u.id === currentUserId ? { ...u, avatarUrl: bustedUrl } : u)));
  };

  // ログイン中にパスワードを変更する（設定ページのプロフィールセクションから呼ばれる。
  // メールリンク経由のResetPassword.tsxとは別の入り口）。
  // Supabaseの`updateUser`はアクティブなセッションがあれば現在のパスワードを知らなくても
  // 更新できてしまうため、なりすまし対策として「現在のパスワード」で一度サインインし直す
  // （＝本人確認）ことを必須にしてから更新する
  const handleChangePassword = async (currentPassword: string, newPassword: string): Promise<string | null> => {
    const email = session?.user.email;
    if (!email) return 'ログイン情報を確認できませんでした。再度ログインし直してください。';

    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthError) return '現在のパスワードが正しくありません。';

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) return updateError.message;

    return null;
  };

  // 退会（アカウント削除。設定ページの「データ」タブから呼ばれる）。
  // Supabaseのanonキーではauth.usersを直接削除できないため、あらかじめ用意した
  // security definer関数`delete_own_account()`（supabase-migration-account-deletion.sql
  // 参照）をRPC経由で呼ぶ。パスワード変更と同様、実行前に現在のパスワードで再認証して
  // 本人確認する。削除成功後はローカルのセッションもクリアするためsignOutを呼んでおく
  // （auth.users自体は既に消えているため、サーバー側には既にセッションは存在しない）
  const handleDeleteAccount = async (password: string): Promise<string | null> => {
    const email = session?.user.email;
    if (!email) return 'ログイン情報を確認できませんでした。再度ログインし直してください。';

    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password });
    if (reauthError) return 'パスワードが正しくありません。';

    const { error: rpcError } = await supabase.rpc('delete_own_account');
    if (rpcError) return '削除に失敗しました: ' + rpcError.message;

    await supabase.auth.signOut();
    return null;
  };

  // ログアウト（設定ページやSidebarのログアウトボタンから呼ばれる）。
  // 誤タップでのログアウトを防ぐため、実行前に確認ダイアログを挟む
  const handleLogout = async () => {
    if (!window.confirm('ログアウトしますか？')) return;
    await supabase.auth.signOut();
  };

  // タスクデータをサンプルタスクにリセットする（設定ページの「データ」セクションから呼ばれる）。
  // 複数人でタスクを共有する構成に変わったため、「自分が作成したタスクだけ」を削除して
  // 作り直す（他のユーザーが作成したタスクは削除しない）。元に戻せない操作のため、
  // 実行前に必ず確認ダイアログを挟む。
  // 削除自体はこれまで通りプロジェクトを跨いで（自分が作成した全タスクを対象に）行うが
  // （プロジェクト単位への変更は見送り。要件定義書§5）、作り直す1件のサンプルタスクには
  // project_idが必須（NOT NULL制約）なので、選択中プロジェクトへ作成する
  const handleResetSampleData = async () => {
    if (!currentProjectId) {
      alert('プロジェクトが選択されていません。サイドバーからプロジェクトを選択してください。');
      return;
    }

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
        project_id: currentProjectId,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      alert('サンプルタスクの作成に失敗しました: ' + (insertError?.message ?? '不明なエラー'));
      return;
    }

    await supabase.from('task_assignees').insert({ task_id: inserted.id, user_id: currentUserId });
    await refreshTasks();
    await refreshNotificationTasks(); // 【ステップ8】リセットで自分のタスクが入れ替わるため通知も更新
  };

  // ヘッダーのテーマ切替メニューに表示するラベル一覧（AppTheme各値 → 表示名）
  // 2026-08-25：ダーク系に偏りすぎているという指摘を受け、視認性が低かった
  // TERRACOTTA・COFFEEを廃止し、ライト系（クリーム・オフホワイト基調）を6種類に拡充
  // （ダーク6種・ライト6種の計12種。ライト系はどれも刺激の強い純白は避けている）。
  // GRAPHITEをデフォルト兼先頭に変更（オブジェクトのプロパティ順＝設定画面での表示順）
  const themeLabels: Record<AppTheme, string> = {
    'graphite-dark': 'GRAPHITE', 'sage-dark': 'SAGE', 'bronze-dark': 'BRONZE',
    'ocean-dark': 'OCEAN', 'amethyst-dark': 'AMETHYST', 'lime-dark': 'LIME',
    'cream-light': 'CREAM', 'linen-light': 'LINEN', 'mist-light': 'MIST',
    'pearl-light': 'PEARL', 'stone-light': 'STONE', 'sand-light': 'SAND',
  };

  // ダッシュボード／タスクボード／スケジュールでプロジェクト未選択の間に出す案内
  // （「近日公開」プレースホルダーと同じ見た目に揃える。要件定義書§2.1）
  const projectNotSelectedNotice = (
    <div className="bg-card p-12 rounded-2xl border border-border-card text-center animate-fade-in">
      <h2 className="text-md font-bold uppercase tracking-wider mb-2 text-accent">プロジェクトを選択してください</h2>
      <p className="text-xs text-text-sub">サイドバーの「プロジェクト管理」から、表示するプロジェクトを選んでください。</p>
    </div>
  );

  // 初回のセッション確認が終わるまでは、何も出さず待つ（ログイン画面がちらつくのを防ぐ）
  // h-dvh/w-dvw：iOS Safariのアドレスバー分だけ100vhが実際の表示領域より大きくなり、
  // 下端が隠れたりスクロール挙動がおかしくなる不具合対策（100vhではなく動的ビューポート単位を使う）
  if (authLoading) {
    return (
      <div className="flex h-dvh w-dvw items-center justify-center bg-base text-text-sub text-xs font-bold tracking-widest uppercase">
        読み込み中…
      </div>
    );
  }

  // パスワード再設定メールのリンクを踏んだ直後は、認証済み（一時セッション）であっても
  // 通常のダッシュボードへは進ませず、新しいパスワードの入力画面を優先して表示する。
  // 更新が完了したらonDoneでこのフラグをfalseに戻し、通常のダッシュボードへ進む
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
            {/* 選択中プロジェクト名の常時表示バッジ（ユーザー要望：2026-08-29）。ヘッダーはサイドバーと
                違いスマホでも常に表示され続けるため、ここに置くのが最も「常時」に近い。
                幅の余裕が無いスマホ幅では省略し、sm以上でのみ表示する */}
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

              {/* 【ステップ8追加要望：2026-08-29】通知が全プロジェクト横断になり、件数が増えると
                  このドロップダウンだけでは（幅288px・高さ最大384pxで内部スクロール）狭く、
                  どのプロジェクトの通知か分かりにくいという指摘を受け、ここは直近6件だけの
                  「プレビュー」に徹する構成へ変更した。プロジェクト名タグを追加し、全件は
                  「すべて見る→」から専用画面（NotificationsView.tsx・currentView='notifications'）
                  へ遷移して確認する2段構えにした */}
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

            {/* アバター：avatar_urlが設定されていれば画像を、無ければ自分のprofiles.display_nameの
                先頭2文字を表示（未取得時は空欄）。<img>にコンテナと全く同じw-7/h-7 md:w-8/h-8を
                指定しているのは、`w-full h-full`のような親依存サイズだと画像の実サイズによって
                このflexアイテムの自動最小サイズが押し上げられ、正円が崩れて巨大化する不具合
                （Safari等で顕著）があるため。ピクセル固定サイズにして完全に無関係にしている。
                画像が設定されている場合のみクリック可能にし、ImageLightboxで原寸表示する
                （X/Instagramのプロフィール画像タップと同じ挙動のイメージ） */}
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
        )}

        {/* メインビュー領域（独立スクロール）
            高さは h-[calc(...)] のような固定値ではなく flex-1 + min-h-0 で計算しており、
            ヘッダーやフィルターバーの実際の高さ（スマホ幅で折り返して増える等）に
            関わらず、残り領域を正しく埋める。
            `@container`：KanbanBoard.tsx側でタスクボードのレイアウト（横スクロール式の
            固定幅カラム表示 ⇔ 4等分グリッド表示）の切り替えを、ビューポート幅ではなく
            「実際にこのmainに残っている横幅」基準（コンテナクエリ）で判定できるようにする。
            サイドバー開閉で実際の幅が変わるため、ビューポート幅（md:等）だけで判定すると、
            タブレット幅でサイドバーを開いた状態のときにボードが崩れる不具合があった */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 bg-base/50 @container">
          <div className="max-w-7xl mx-auto w-full h-full">
            {tasksLoading && tasks.length === 0 && (
              <p className="text-[11px] text-text-sub font-bold tracking-wider mb-4">タスクを読み込み中…</p>
            )}
            {currentView === 'dashboard' ? (
              !currentProjectId ? projectNotSelectedNotice : (
                <div className="animate-fade-in pb-8">
                  <DashboardView tasks={tasks} users={users} filterUser={filterUser} filterCategory={filterCategory} filterPriority={filterPriority} />
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
