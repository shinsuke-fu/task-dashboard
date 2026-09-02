/**
 * src/components/TaskForm.tsx
 * タスクの新規作成・編集モーダルフォーム。editingTaskの有無で新規／編集の両モードを兼ね、
 * 送信はonAddTaskに委譲する。担当者・確認者・プロジェクト（編集時のみ表示）の候補は、
 * 選択中プロジェクトのメンバーに絞り込む（規約①：状態はApp.tsx側に一元化）。
 */
import { useState, useEffect } from 'react';
import type { Task, User, Subtask, Project } from '../types/task';
import { getTodayJstDateString } from '../utils/date';

interface ProjectMemberInfo {
  userId: string;
  role: string;
}

interface TaskFormProps {
  isOpen: boolean;
  editingTask?: Task;
  users: User[];
  currentUserId: string;
  // 参加しているプロジェクト一覧（「プロジェクト」欄の選択肢）とプロジェクトごとのメンバー
  // 一覧（担当者・確認者候補の絞り込みに使用）
  projects: Project[];
  projectMembers: Record<string, ProjectMemberInfo[]>;
  // 新規作成時、タスクの所属プロジェクトは常にこれに固定する
  currentProjectId: string | null;
  onClose: () => void;
  // createdBy（作成者）はこのフォームでは扱わない。App.tsx側が挿入時にcurrentUserIdから
  // 設定するため、ここではOmitで除外している
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

  // タスクが属するプロジェクト。編集画面の「プロジェクト」欄でのみ変更できる
  const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProjectId ?? '');

  // 作業担当者（複数選択可）。新規作成時は自分のみを選択した状態を初期値とする
  const [assigneeIds, setAssigneeIds] = useState<string[]>([currentUserId]);

  // 確認者の初期値はisOpenの副作用（下のuseEffect）でまとめてセットする
  const [reviewerId, setReviewerId] = useState<string>('');

  // サブタスク（チェックリスト）。承認フローとは独立した、担当者向けの簡易メモ
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // isOpenが「trueになった瞬間」だけ初期化し、編集中の中途半端な上書きループを防ぐ
  useEffect(() => {
    if (!isOpen) return;

    // このタスクが属するプロジェクト（編集時は既存値、新規作成時はcurrentProjectId固定）。
    // 担当者・確認者の初期候補もこのプロジェクトのメンバーに絞る
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
      setSubtasks(editingTask.subtasks || []);
    } else {
      setTitle('');
      setDescription('');
      setCategory('開発');
      setPriority('medium');
      setEndDate(getTodayJstDateString());
      setAssigneeIds([currentUserId]);
      // デフォルト確認者：プロジェクトメンバーの中から自分以外の先頭ユーザー
      setReviewerId(initialCandidates.find((u) => u.id !== currentUserId)?.id ?? '');
      setSubtasks([]);
    }
    setNewSubtaskTitle('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // 依存配列はisOpenのみに絞る（他の値の変化で誤って再初期化されるのを防ぐため）

  // 担当者は最低1人必須のため、残り1人の状態からの解除操作は無視する
  const handleToggleAssignee = (userId: string) => {
    setAssigneeIds(prev => {
      if (prev.includes(userId)) {
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== userId);
      }
      return [...prev, userId];
    });
  };

  // 移動先プロジェクトのメンバーでなくなる担当者・確認者は自動的に選択から外す（§8.3。
  // 全リセットではなく、メンバーでなくなった人だけを外す）
  const handleProjectChange = (newProjectId: string) => {
    setSelectedProjectId(newProjectId);
    const newMemberIds = new Set((projectMembers[newProjectId] ?? []).map((m) => m.userId));
    setAssigneeIds((prev) => prev.filter((id) => newMemberIds.has(id)));
    setReviewerId((prev) => (newMemberIds.has(prev) ? prev : ''));
  };

  const handleAddSubtask = () => {
    // タスク名の state（title）と紛らわしいので、あえて別名にしている
    const trimmedTitle = newSubtaskTitle.trim();
    if (!trimmedTitle) return;
    setSubtasks(prev => [...prev, { id: crypto.randomUUID(), title: trimmedTitle, done: false }]);
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (id: string) => {
    setSubtasks(prev => prev.map(s => (s.id === id ? { ...s, done: !s.done } : s)));
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(prev => prev.filter(s => s.id !== id));
  };

  // 担当者・確認者の候補は選択中プロジェクトのメンバーに絞り込む
  const projectMemberIds = new Set((projectMembers[selectedProjectId] ?? []).map((m) => m.userId));
  const assigneeCandidates = users.filter((u) => projectMemberIds.has(u.id));

  // 担当者に選ばれた人が確認者のままだと「担当者＝確認者」の矛盾状態になるため、自動的に外す
  useEffect(() => {
    if (assigneeIds.includes(reviewerId)) {
      const fallback = assigneeCandidates.find(user => !assigneeIds.includes(user.id));
      if (fallback) setReviewerId(fallback.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assigneeIds, reviewerId, selectedProjectId]);

  if (!isOpen) return null;

  // 担当者に選ばれていないユーザーのみを確認者候補にする（自己承認を防ぐため）。全メンバーを
  // 担当者に選ぶと確認者候補が0人になる既知の制約がある
  const reviewerCandidates = assigneeCandidates.filter(user => !assigneeIds.includes(user.id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (assigneeIds.length === 0) return; // 担当者は最低1人必須（通常はUI側で常に保証済み）
    if (!selectedProjectId) return; // プロジェクト未選択では保存させない（新規作成時のガードはApp.tsx側のalertで別途表示済み）

    onAddTask({
      title: title.trim(),
      description: description.trim() ? description.trim() : undefined,
      category: category,
      priority: priority,
      startDate: editingTask?.startDate ? editingTask.startDate : getTodayJstDateString(), // 新規作成時は今日を開始日にする
      endDate: endDate,
      assignees: assigneeIds,
      reviewerId: reviewerId,
      subtasks: subtasks,
      projectId: selectedProjectId,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <form onSubmit={handleSubmit} className="w-full max-w-lg bg-card border border-border-card rounded-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        
        <div className="flex items-center justify-between pb-2 border-b border-border-card/40">
          <h3 className="font-extrabold text-xs tracking-wider text-text-main">
            {editingTask ? 'タスクの編集' : '新しいタスクの追加'}
          </h3>
        </div>

        <div className="space-y-4 text-xs">
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

          {/* 編集時のみ表示（新規作成時は常にcurrentProjectId固定）。移動先のメンバーでなくなる
              担当者・確認者は自動的に選択から外れる（§2.5） */}
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
                  // 行クリックでもチェック切替できるようにする（checkbox自体はonChangeと二重発火
                  // するため、input要素上のクリックだけ除外する）。削除ボタンはstopPropagationで
                  // 巻き込まれないようにする
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

          <div>
            <label className="block text-[10px] font-black text-text-sub uppercase mb-1">
              作業担当者（複数選択可）
            </label>
            <div className="flex flex-wrap gap-2">
              {assigneeCandidates.map(user => {
                const isSelected = assigneeIds.includes(user.id);
                return (
                  <label
                    key={user.id}
                    className={`flex items-center gap-1.5 h-8 px-3 rounded-xl border text-[11px] font-bold cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-accent/10 border-accent/40 text-accent'
                        : 'bg-base border-border-card text-text-sub hover:text-text-main'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleAssignee(user.id)}
                      className="w-3 h-3 accent-current cursor-pointer"
                    />
                    {user.name}
                  </label>
                );
              })}
            </div>
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
            <select
              value={reviewerId}
              onChange={(e) => setReviewerId(e.target.value)}
              className="w-full h-9 bg-base border border-border-card rounded-xl px-2 font-bold text-text-main cursor-pointer"
            >
              {reviewerCandidates.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          {/* スマホ幅では窮屈になるため縦積みにし、sm以上で横3列に並べる */}
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
