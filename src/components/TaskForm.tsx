/**
 * src/components/TaskForm.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   タスクの新規作成・編集を行うモーダルフォーム。isOpen=trueの間だけ
 *   描画され、editingTaskの有無で「新規作成」「編集」の両モードを兼ねる。
 *
 * 【主な処理】
 *   1. isOpenがtrueになった瞬間にフォーム項目を初期化（新規 or 編集内容）
 *   2. 作業担当者・確認者は、検索付きコンボボックス（UserPicker.tsx）で選択する
 *      （担当者は複数選択可・最低1人必須、確認者は単一選択。2026-09-02、
 *      feature/assignee-reviewer-picker。人数が増えるとチェックボックス列挙・
 *      ネイティブ<select>では選びにくいという指摘を受けて置き換えた）
 *   3. 確認者（レビュアー）は、作業担当者に選ばれていないユーザーの中から選択
 *   4. サブタスク（チェックリスト）の追加・チェック切替・削除を管理する
 *      （承認フローには関与しない、担当者向けの簡易メモという位置づけ）
 *   5. 送信時にonAddTaskを呼び出し、実際の保存処理はApp.tsx側に委譲
 *
 * 【Supabase移行後の変更】
 *   ・currentUserId はApp.tsx側（Supabaseの認証セッション）からpropとして
 *     受け取る形に変更。このコンポーネント内でのハードコードは廃止した。
 *   ・担当者・確認者のデータはSupabase（task_assignees / tasksテーブル）に
 *     保存され、他ユーザーとも共有される。
 *
 * 【ステップ6：プロジェクト移動欄（プロジェクト管理機能_要件定義書.md §2.5）】
 *   ・作業担当者・確認者の選択候補は、常に「選択中プロジェクト」のメンバーに絞り込む
 *     （プロジェクト機能導入前は全登録ユーザーが対象だったが、プロジェクトという境界が
 *     できた以上、担当できる人もそのプロジェクトのメンバーに限定するのが自然なため）
 *   ・編集画面にのみ「プロジェクト」欄を表示し、自分が参加している他のプロジェクトへ
 *     タスクを移動できる（新規作成時は常にcurrentProjectId固定で、欄自体を出さない）
 *   ・プロジェクトを変更すると、移動先のメンバーでなくなる担当者・確認者は自動的に
 *     選択から外れる（§8.3で仮決めした「自動でクリアする」方式。全リセットではなく、
 *     メンバーでなくなった人だけを外す）
 * -----------------------------------------------------------------------
 */
import { useState, useEffect } from 'react';
import type { Task, User, Subtask, Project } from '../types/task';
import { getTodayJstDateString } from '../utils/date';
import UserPicker from './UserPicker';

interface ProjectMemberInfo {
  userId: string;
  role: string;
}

interface TaskFormProps {
  isOpen: boolean;
  editingTask?: Task;
  users: User[];
  currentUserId: string;
  // 【ステップ6】自分が参加しているプロジェクト一覧（「プロジェクト」欄の選択肢）と、
  // プロジェクトごとのメンバー一覧（担当者・確認者の候補の絞り込みに使用）
  projects: Project[];
  projectMembers: Record<string, ProjectMemberInfo[]>;
  // 新規作成時、タスクの所属プロジェクトは常にこれに固定する
  currentProjectId: string | null;
  onClose: () => void;
  // createdBy（作成者）はこのフォームでは扱わない。新規作成時はApp.tsx側が
  // 挿入時にcurrentUserIdから設定するため、ここではOmitで除外している
  onAddTask: (task: Omit<Task, 'id' | 'status' | 'createdBy'>) => void;
}

export default function TaskForm({
  isOpen,
  editingTask,
  users,
  currentUserId,
  projects,
  projectMembers,
  currentProjectId,
  onClose,
  onAddTask,
}: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'開発' | 'デザイン' | 'マーケ' | 'その他'>('開発');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [endDate, setEndDate] = useState('');

  // 【ステップ6】タスクが属するプロジェクト。編集画面の「プロジェクト」欄でのみ変更できる
  const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProjectId ?? '');

  // 作業担当者（複数選択可）。新規作成時は自分のみを選択した状態を初期値とする
  const [assigneeIds, setAssigneeIds] = useState<string[]>([currentUserId]);

  // 確認者（レビュアー）を管理するステート（実際の初期値はisOpenの副作用でセットする。
  // プロジェクトのメンバーに絞り込む必要があるため、初期化ロジックを下のuseEffectへ統一した）
  const [reviewerId, setReviewerId] = useState<string>('');

  // サブタスク（チェックリスト）。承認フローとは独立した、担当者向けの簡易メモ
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  // 新規サブタスク入力欄の値
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // isOpen が「true になった瞬間」だけ確実に初期化し、編集中の中途半端な上書きループを徹底遮断
  useEffect(() => {
    if (!isOpen) return;

    // 【ステップ6】このタスクが属するプロジェクト（編集時は既存の値、新規作成時は
    // currentProjectId固定）。担当者・確認者の初期候補も、このプロジェクトのメンバーに絞る
    const initialProjectId = editingTask ? editingTask.projectId : (currentProjectId ?? '');
    setSelectedProjectId(initialProjectId);
    const initialMemberIds = new Set((projectMembers[initialProjectId] ?? []).map((m) => m.userId));
    const initialCandidates = users.filter((u) => initialMemberIds.has(u.id));

    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setCategory(editingTask.category || '開発');
      setPriority(editingTask.priority || 'medium');
      setEndDate(editingTask.endDate);

      // 既存タスクの担当者をセット（データ不整合等で空の場合は自分のみにフォールバック）
      setAssigneeIds(
        editingTask.assignees && editingTask.assignees.length > 0
          ? editingTask.assignees
          : [currentUserId]
      );
      // 既存タスクに確認者が設定されていればそれをセット（無ければプロジェクトメンバーの中から自分以外の先頭ユーザー）
      setReviewerId(editingTask.reviewerId || initialCandidates.find((u) => u.id !== currentUserId)?.id || '');
      // 既存タスクのサブタスクをセット（無ければ空リスト）
      setSubtasks(editingTask.subtasks || []);
    } else {
      setTitle('');
      setDescription('');
      setCategory('開発');
      setPriority('medium');
      setEndDate(getTodayJstDateString()); // 期日の初期値は「今日」（JST基準）
      setAssigneeIds([currentUserId]); // 担当者初期値：自分のみ
      setReviewerId(initialCandidates.find((u) => u.id !== currentUserId)?.id ?? ''); // デフォルト確認者：プロジェクトメンバーの中から自分以外の先頭ユーザー
      setSubtasks([]); // サブタスクは空から開始
    }
    setNewSubtaskTitle(''); // 入力欄は常にリセット
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // 依存配列を isOpen のみに絞ることで、送信時の逆流リセットバグを完全消滅させます（currentUserId/users/projects/projectMembers/currentProjectIdは意図的に含めない）

  // UserPicker.tsx（検索付きコンボボックス）からの選択変更を受け取る。
  // 担当者は最低1人必須のため、0人にしようとする変更は無視する
  // （UserPicker自体は汎用部品としてこの業務ルールを持たないため、ここで担保する）
  const handleAssigneeChange = (ids: string[]) => {
    if (ids.length === 0) return;
    setAssigneeIds(ids);
  };

  // 【ステップ6】プロジェクト移動欄（編集時のみ表示）の変更処理。移動先プロジェクトの
  // メンバーでなくなる担当者・確認者は自動的に選択から外す（§8.3・全リセットではなく
  // メンバーでなくなった人だけを外す方式）
  const handleProjectChange = (newProjectId: string) => {
    setSelectedProjectId(newProjectId);
    const newMemberIds = new Set((projectMembers[newProjectId] ?? []).map((m) => m.userId));
    setAssigneeIds((prev) => prev.filter((id) => newMemberIds.has(id)));
    setReviewerId((prev) => (newMemberIds.has(prev) ? prev : ''));
  };

  // サブタスクを1件追加する（入力欄が空・空白のみの場合は何もしない）
  const handleAddSubtask = () => {
    // タスク名の state（title）と紛らわしいので、あえて別名にしている
    const trimmedTitle = newSubtaskTitle.trim();
    if (!trimmedTitle) return;
    setSubtasks(prev => [...prev, { id: crypto.randomUUID(), title: trimmedTitle, done: false }]);
    setNewSubtaskTitle('');
  };

  // サブタスクのチェック状態を切り替える
  const handleToggleSubtask = (id: string) => {
    setSubtasks(prev => prev.map(s => (s.id === id ? { ...s, done: !s.done } : s)));
  };

  // サブタスクを1件削除する
  const handleRemoveSubtask = (id: string) => {
    setSubtasks(prev => prev.filter(s => s.id !== id));
  };

  // 【ステップ6】担当者・確認者の候補は、選択中プロジェクトのメンバーに絞り込む
  // （プロジェクト機能導入前は全登録ユーザーが対象だったが、§2.5対応にあわせて変更）
  const projectMemberIds = new Set((projectMembers[selectedProjectId] ?? []).map((m) => m.userId));
  const assigneeCandidates = users.filter((u) => projectMemberIds.has(u.id));

  // 確認者（レビュアー）が、直後に自分自身が担当者として選ばれてしまった場合に
  // 「担当者＝確認者」という矛盾状態にならないよう、選べる候補から自動的に外す
  useEffect(() => {
    if (assigneeIds.includes(reviewerId)) {
      const fallback = assigneeCandidates.find(user => !assigneeIds.includes(user.id));
      if (fallback) setReviewerId(fallback.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assigneeIds, reviewerId, selectedProjectId]);

  if (!isOpen) return null;

  // 担当者に選ばれていないユーザーのみを確認者（レビュアー）候補として抽出
  // （自分で自分の作業を承認できてしまう状態を防ぐため）
  // 既知の制約：プロジェクトの全メンバーを担当者に選んだ場合、確認者の候補が0人になる。
  // メンバー数が少ないうちは起こり得るため、将来的には候補ゼロを防ぐ
  // 制御（例：最低1人は担当者から除外させる等）を検討する想定。
  const reviewerCandidates = assigneeCandidates.filter(user => !assigneeIds.includes(user.id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (assigneeIds.length === 0) return; // 担当者は最低1人必須（通常はUI側で常に保証済み）
    if (!selectedProjectId) return; // プロジェクト未選択では保存させない（新規作成時のガードはApp.tsx側のalertで別途表示済み）

    // 親の型定義(string等)に安全に適合させ、最新の値を確実に最優先で送信
    onAddTask({
      title: title.trim(),
      description: description.trim() ? description.trim() : undefined,
      category: category,
      priority: priority,
      startDate: editingTask?.startDate ? editingTask.startDate : getTodayJstDateString(), // 新規作成時は今日を開始日にする
      endDate: endDate,
      assignees: assigneeIds,  // チェックボックスで選択された担当者ID配列をそのまま送信
      reviewerId: reviewerId,  // 選択した確認者（レビュアー）のIDを直通バインド
      subtasks: subtasks,      // サブタスク（チェックリスト）をそのまま送信
      projectId: selectedProjectId, // 【ステップ6】所属プロジェクト（編集時は「プロジェクト」欄の選択値）
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <form onSubmit={handleSubmit} className="w-full max-w-lg bg-card border border-border-card rounded-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* ヘッダー */}
        <div className="flex items-center justify-between pb-2 border-b border-border-card/40">
          <h3 className="font-extrabold text-xs tracking-wider text-text-main">
            {editingTask ? 'タスクの編集' : '新しいタスクの追加'}
          </h3>
        </div>

        <div className="space-y-4 text-xs">
          {/* タスク名入力 */}
          <div>
            <label className="block text-[10px] font-black text-text-sub uppercase mb-1">タスク名</label>
            <input 
              type="text" 
              placeholder="例：ログイン画面のマークアップ" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="w-full h-10 bg-base border border-border-card rounded-xl px-4 text-text-main focus:outline-none focus:border-accent" 
              required 
            />
          </div>

          {/* 詳細説明入力 */}
          <div>
            <label className="block text-[10px] font-black text-text-sub uppercase mb-1">詳細説明</label>
            <textarea 
              placeholder="タスクの詳しい要件やメモ..." 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              rows={2} 
              className="w-full bg-base border border-border-card rounded-xl p-3 text-text-main focus:outline-none focus:border-accent resize-none leading-relaxed" 
            />
          </div>

          {/* 【ステップ6】プロジェクト移動欄：編集時のみ表示（新規作成時は常にcurrentProjectId固定）。
              §2.5・要件定義書。移動先のメンバーでなくなる担当者・確認者は自動的に選択から外れる */}
          {editingTask && (
            <div>
              <label className="block text-[10px] font-black text-text-sub uppercase mb-1">プロジェクト</label>
              <select
                value={selectedProjectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full h-9 bg-base border border-border-card rounded-xl px-2 font-bold text-text-main cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-text-sub mt-1.5 pl-1 font-medium">
                ※移動先プロジェクトのメンバーでなくなる担当者・確認者は自動的に選択から外れます。
              </p>
            </div>
          )}

          {/* サブタスク（チェックリスト）：承認フローとは独立した、担当者向けの簡易メモ */}
          <div>
            <label className="block text-[10px] font-black text-text-sub uppercase mb-1">
              サブタスク（任意・チェックリスト）
            </label>
            {subtasks.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {subtasks.map((sub) => (
                  // 行全体をクリックしてもチェックを切り替えられるようにする（チェックボックス自体への
                  // クリックはネイティブのonChangeと二重発火してしまうため、行のonClickでは
                  // input[type=checkbox]上でのクリックだけ除外する）。削除ボタンはstopPropagationで
                  // 行のトグルに巻き込まれないようにする
                  <div
                    key={sub.id}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).tagName === 'INPUT') return;
                      handleToggleSubtask(sub.id);
                    }}
                    className="flex items-center gap-2 bg-base border border-border-card rounded-lg px-2.5 h-8 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={sub.done}
                      onChange={() => handleToggleSubtask(sub.id)}
                      className="w-3.5 h-3.5 accent-accent cursor-pointer flex-shrink-0"
                    />
                    <span className={`flex-1 text-[11px] font-medium truncate ${sub.done ? 'line-through text-text-sub' : 'text-text-main'}`}>
                      {sub.title}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSubtask(sub.id);
                      }}
                      className="text-text-sub hover:text-rose-400 transition cursor-pointer flex-shrink-0 text-[10px] px-1"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  // Enterキーでの「フォーム全体の送信」を防ぎ、サブタスク追加だけを行う
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="サブタスクを追加..."
                className="flex-1 h-8 bg-base border border-border-card rounded-lg px-2.5 text-[11px] text-text-main focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="h-8 px-3 bg-surface hover:bg-base border border-border-card/50 rounded-lg text-[10px] font-bold text-text-sub hover:text-text-main transition cursor-pointer"
              >
                追加
              </button>
            </div>
            <p className="text-[10px] text-text-sub mt-1.5 pl-1 font-medium">
              ※サブタスクは担当者向けの簡易チェックリストです。期日は親タスクのものをそのまま
              使います。承認申請・差し戻し・承認完了といった承認フローには影響しません。
            </p>
          </div>

          {/* 作業担当者（複数選択可）：検索しながら選べるコンボボックス（UserPicker.tsx） */}
          <div>
            <label className="block text-[10px] font-black text-text-sub uppercase mb-1">
              作業担当者（複数選択可）
            </label>
            <UserPicker
              mode="multi"
              users={assigneeCandidates}
              value={assigneeIds}
              onChange={handleAssigneeChange}
              placeholder="担当者を検索..."
              emptyMessage="追加できる候補がいません"
            />
            <p className="text-[10px] text-text-sub mt-1.5 pl-1 font-medium">
              ※選択できるのはこのプロジェクトのメンバーのみです。選択した担当者にはSupabase上で
              タスクが共有されます（保存時にtask_assigneesテーブルへ反映）。
            </p>
          </div>

          {/* 確認者（レビュアー）：作業担当者に選ばれているユーザーは候補から自動的に除外される */}
          <div>
            <label className="block text-[10px] font-black text-text-sub uppercase mb-1">
              タスクの確認者・承認者（上司・レビュアー）
            </label>
            <UserPicker
              mode="single"
              users={reviewerCandidates}
              value={reviewerId ? [reviewerId] : []}
              onChange={(ids) => setReviewerId(ids[0] ?? '')}
              placeholder="確認者を検索..."
              emptyMessage="選べる候補がいません（担当者を全員選ぶと0人になります）"
            />
          </div>

          {/* メタデータ選択（カテゴリ・優先度・期日）：スマホ幅では窮屈になるため縦積みにし、
              sm以上（640px〜）で従来通り横3列に並べる */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-black text-text-sub uppercase mb-1">カテゴリ</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value as '開発' | 'デザイン' | 'マーケ' | 'その他')} 
                className="w-full h-9 bg-base border border-border-card rounded-xl px-2 font-bold text-text-main cursor-pointer"
              >
                <option value="開発">開発</option>
                <option value="デザイン">デザイン</option>
                <option value="マーケ">マーケ</option>
                <option value="その他">その他</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-text-sub uppercase mb-1">優先度</label>
              <select 
                value={priority} 
                onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')} 
                className="w-full h-9 bg-base border border-border-card rounded-xl px-2 font-bold text-text-main cursor-pointer"
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-text-sub uppercase mb-1">期日</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                className="w-full h-9 bg-base border border-border-card rounded-xl px-2 font-bold font-mono text-text-main cursor-pointer" 
              />
            </div>
          </div>
        </div>

        {/* 下部アクションボタン */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border-card/30">
          <button type="button" onClick={onClose} className="h-9 px-4 bg-surface hover:bg-base text-text-sub font-bold text-xs rounded-xl cursor-pointer border border-border-card/50 transition">
            キャンセル
          </button>
          <button type="submit" className="h-9 px-5 bg-accent hover:bg-accent/90 text-on-accent font-black text-xs rounded-xl cursor-pointer shadow-md">
            {editingTask ? '変更を保存' : 'タスクを作成'}
          </button>
        </div>
      </form>
    </div>
  );
}
