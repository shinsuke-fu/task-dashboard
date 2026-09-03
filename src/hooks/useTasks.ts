/**
 * src/hooks/useTasks.ts
 * タスク一覧のCRUD（保存・削除・ステータス変更・承認フロー・サンプルリセット）と、
 * 通知ベル用の全プロジェクト横断タスク取得・20秒ポーリングをまとめて扱うフック。
 *
 * editingTask・setIsModalOpen・setEditingTask（タスク編集モーダルの開閉状態）はまだ
 * 別フックに切り出していないため、呼び出し元（App.tsx）から状態・コールバックとして注入する。
 */
import { useEffect, useState } from 'react';
import type { Task, User } from '../types/task';
import { supabase } from '../lib/supabaseClient';

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

// 20秒ごとのポーリングで内容が変わっていないのにsetTasks/setNotificationTasksを
// 呼んでしまうと、配列・オブジェクトの参照が毎回新しくなるため無駄な再レンダリングが
// 起きる。内容が完全に同じ場合はstate更新自体をスキップするための簡易比較
// （この規模のアプリではJSON文字列比較で十分）
const tasksEqual = (a: Task[], b: Task[]) => JSON.stringify(a) === JSON.stringify(b);

export function useTasks(
  isAuthenticated: boolean,
  currentUserId: string,
  currentProjectId: string | null,
  users: User[],
  editingTask: Task | undefined,
  setIsModalOpen: (open: boolean) => void,
  setEditingTask: (task: Task | undefined) => void,
) {
  // タスク一覧本体（Supabaseの`tasks`テーブル＋担当者・サブタスクの結合データから取得）
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState<boolean>(false);

  // 通知ベルの判定専用に、選択中プロジェクトに絞らず「自分が参加している全プロジェクト」の
  // タスクを保持する（docs/要件定義書.md§6）。tasks（画面表示用。currentProjectIdで
  // 絞り込み）とは別に持つ理由は、通知ベルだけは選択中プロジェクトに関係なく
  // 全プロジェクト横断で気づけるようにするため
  const [notificationTasks, setNotificationTasks] = useState<Task[]>([]);

  // tasksを担当者・サブタスクごと結合して取得し直す共通関数。毎回サーバーから読み直す
  // 方式（楽観的更新はしない）。currentProjectId未選択の間は取得しない
  // （project_idがNOT NULL制約のため。docs/要件定義書_プロジェクト管理機能.md§1・§4）。
  // opts.silentはポーリングからの呼び出し時に使い、ローディング表示を出さないようにする
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
      // created_atだけだと返却順が不安定になり、ポーリングのたびに並びが入れ替わって
      // 見えるため、idを二次キーにして安定させる
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

  // 通知ベル用に、project_idで絞り込まず全タスクを取得する共通関数。RLSが自動的に
  // 参加プロジェクト分だけを返すため、クライアント側の絞り込みは不要
  const refreshNotificationTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_assignees(user_id), task_subtasks(id, title, done)')
      // refreshTasksと同様、二次キーで並び順を確定させる
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });

    if (error) {
      console.error('通知用タスクの取得に失敗しました:', error);
      return;
    }
    const next = ((data ?? []) as SupabaseTaskRow[]).map(mapRowToTask);
    setNotificationTasks((prev) => (tasksEqual(prev, next) ? prev : next));
  };

  // ログイン状態、または選択中プロジェクトが変わるたびにタスク一覧を取得し直す
  // （サイドバーのアコーディオンでプロジェクトを切り替えた瞬間もここで再取得される）
  useEffect(() => {
    if (!isAuthenticated) {
      setTasks([]);
      return;
    }
    refreshTasks();
  }, [isAuthenticated, currentProjectId]);

  // ログイン状態が変わったら、通知タスク一覧を取得し直す（参加プロジェクト一覧は
  // useProjects.ts側の、担当者一覧はuseUsers.ts側の、同じisAuthenticated依存のeffectで
  // 並行して取得される。通知ベルは選択中プロジェクトに関係なく全プロジェクト横断で必要な
  // ため、currentProjectIdが未選択・未確定の間も取得しておく）
  useEffect(() => {
    if (!isAuthenticated) {
      setNotificationTasks([]);
      return;
    }
    refreshNotificationTasks();
  }, [isAuthenticated]);

  // Supabase Realtime未導入のため、他ユーザーの変更を拾う暫定策として一定間隔で
  // ポーリングする（本格対応はTODO.md参照）。currentProjectIdを依存配列に含めるのは、
  // クロージャが古いrefreshTasksを握ったままにならないようにするため。通知ベルは全
  // プロジェクト横断のため同じタイマーに相乗りさせている。.order()の二次キー（id）は
  // 返却順を安定させ、ポーリングのたびに並びが入れ替わるのを防ぐため
  useEffect(() => {
    if (!isAuthenticated) return;
    const intervalId = setInterval(() => {
      refreshTasks({ silent: true }); // バックグラウンド更新なのでローディング表示は出さない
      refreshNotificationTasks();
    }, 20000); // 20秒間隔（頻度を上げすぎるとAPI呼び出しが増えるため、通知用途としてはこの程度で妥協）
    return () => clearInterval(intervalId);
  }, [isAuthenticated, currentProjectId]);

  // ---- タスク操作ハンドラー（子コンポーネントへPropsとして配布。すべてSupabase経由の非同期処理） ----

  // タスクの新規作成／編集保存。担当者・サブタスクは差分計算せず「全削除してから作り直す」
  // 方式（docs/詳細設計書_認証DB編.md2.3）。createdByは受け取らず、新規作成時はここで
  // currentUserIdから設定する（TaskForm.tsx側もOmitで除外）
  const handleSaveTask = async (taskData: Omit<Task, 'id' | 'status' | 'createdBy'>) => {
    // 新規作成時はcurrentProjectIdが必須（project_idがNOT NULL制約のため。
    // docs/要件定義書_プロジェクト管理機能.md§3.3）。編集時はTaskForm.tsxの「プロジェクト」欄
    // （§2.5）でtaskData.projectIdが他プロジェクトIDに変わり得るため、そのまま含める
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
    await refreshNotificationTasks(); // 保存したタスクが他プロジェクトの場合もあるため通知も更新
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  // タスクの削除（task_assignees・task_subtasksはcascadeで自動的に消える）。RLS上、
  // 削除は作成者のみ可能（docs/詳細設計書_認証DB編.md3.1）。他人のタスクを削除しようとすると
  // RLSに除外されて「0件削除」で成功扱いになるため、件数を確認して理由を伝える
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
    await refreshNotificationTasks(); // 削除したタスクの通知も即座に消す
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
    await refreshNotificationTasks(); // ステータス変更（遅延解消等）を通知へ即座に反映
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
    await refreshNotificationTasks(); // 承認申請・承認・差し戻しを通知へ即座に反映
  };

  // サンプルタスクへのリセット（docs/要件定義書.md§7）。複数人で共有するため「自分が
  // 作成したタスクだけ」を削除して作り直す。削除はプロジェクトを跨ぐが、作り直す1件は
  // project_idが必須のため選択中プロジェクトへ作成する
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
    await refreshNotificationTasks(); // リセットで自分のタスクが入れ替わるため通知も更新
  };

  return {
    tasks,
    tasksLoading,
    notificationTasks,
    refreshTasks,
    refreshNotificationTasks,
    handleSaveTask,
    handleDeleteTask,
    handleUpdateStatus,
    handleProcessAction,
    handleResetSampleData,
  };
}
