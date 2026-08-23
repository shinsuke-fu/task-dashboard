/**
 * src/components/TaskForm.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   タスクの新規作成・編集を行うモーダルフォーム。isOpen=trueの間だけ
 *   描画され、editingTaskの有無で「新規作成」「編集」の両モードを兼ねる。
 *
 * 【主な処理】
 *   1. isOpenがtrueになった瞬間にフォーム項目を初期化（新規 or 編集内容）
 *   2. 作業担当者はチェックボックスで複数選択可能（新規作成時は自分のみ
 *      選択された状態が初期値。0人にはできない）
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
 * -----------------------------------------------------------------------
 */
import { useState, useEffect } from 'react';
import type { Task, User, Subtask } from '../types/task';
import { getTodayJstDateString } from '../utils/date';

interface TaskFormProps {
  isOpen: boolean;
  editingTask?: Task;
  users: User[];
  currentUserId: string;
  onClose: () => void;
  onAddTask: (task: Omit<Task, 'id' | 'status'>) => void;
}

export default function TaskForm({ isOpen, editingTask, users, currentUserId, onClose, onAddTask }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'開発' | 'デザイン' | 'マーケ' | 'その他'>('開発');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [endDate, setEndDate] = useState('');

  // 作業担当者（複数選択可）。新規作成時は自分のみを選択した状態を初期値とする
  const [assigneeIds, setAssigneeIds] = useState<string[]>([currentUserId]);

  // 確認者（レビュアー）を管理するステート（デフォルトは自分以外の先頭ユーザー）
  const [reviewerId, setReviewerId] = useState<string>(
    users.find((u) => u.id !== currentUserId)?.id ?? ''
  );

  // サブタスク（チェックリスト）。承認フローとは独立した、担当者向けの簡易メモ
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  // 新規サブタスク入力欄の値
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // isOpen が「true になった瞬間」だけ確実に初期化し、編集中の中途半端な上書きループを徹底遮断
  useEffect(() => {
    if (!isOpen) return;

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
      // 既存タスクに確認者が設定されていればそれをセット（無ければ自分以外の先頭ユーザー）
      setReviewerId(editingTask.reviewerId || users.find((u) => u.id !== currentUserId)?.id || '');
      // 既存タスクのサブタスクをセット（無ければ空リスト）
      setSubtasks(editingTask.subtasks || []);
    } else {
      setTitle('');
      setDescription('');
      setCategory('開発');
      setPriority('medium');
      setEndDate(getTodayJstDateString()); // 期日の初期値は「今日」（JST基準）
      setAssigneeIds([currentUserId]); // 担当者初期値：自分のみ
      setReviewerId(users.find((u) => u.id !== currentUserId)?.id ?? ''); // デフォルト確認者：自分以外の先頭ユーザー
      setSubtasks([]); // サブタスクは空から開始
    }
    setNewSubtaskTitle(''); // 入力欄は常にリセット
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // 依存配列を isOpen のみに絞ることで、送信時の逆流リセットバグを完全消滅させます（currentUserId/usersは意図的に含めない）

  // 担当者チェックボックスの選択・解除を切り替える。
  // 担当者は最低1人必須のため、残り1人の状態からの解除操作は無視する
  const handleToggleAssignee = (userId: string) => {
    setAssigneeIds(prev => {
      if (prev.includes(userId)) {
        if (prev.length === 1) return prev; // 最後の1人は解除させない
        return prev.filter(id => id !== userId);
      }
      return [...prev, userId];
    });
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

  // 確認者（レビュアー）が、直後に自分自身が担当者として選ばれてしまった場合に
  // 「担当者＝確認者」という矛盾状態にならないよう、選べる候補から自動的に外す
  useEffect(() => {
    if (assigneeIds.includes(reviewerId)) {
      const fallback = users.find(user => !assigneeIds.includes(user.id));
      if (fallback) setReviewerId(fallback.id);
    }
  }, [assigneeIds, reviewerId, users]);

  if (!isOpen) return null;

  // 担当者に選ばれていないユーザーのみを確認者（レビュアー）候補として抽出
  // （自分で自分の作業を承認できてしまう状態を防ぐため）
  // 既知の制約：全ユーザーを担当者に選んだ場合、確認者の候補が0人になる。
  // 登録ユーザー数が少ないうちは起こり得るため、将来的には候補ゼロを防ぐ
  // 制御（例：最低1人は担当者から除外させる等）を検討する想定。
  const reviewerCandidates = users.filter(user => !assigneeIds.includes(user.id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (assigneeIds.length === 0) return; // 担当者は最低1人必須（通常はUI側で常に保証済み）

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

          {/* サブタスク（チェックリスト）：承認フローとは独立した、担当者向けの簡易メモ */}
          <div>
            <label className="block text-[10px] font-black text-text-sub uppercase mb-1">
              サブタスク（任意・チェックリスト）
            </label>
            {subtasks.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {subtasks.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2 bg-base border border-border-card rounded-lg px-2.5 h-8">
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
                      onClick={() => handleRemoveSubtask(sub.id)}
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

          {/* 作業担当者（複数選択可）：チェックボックスでユーザーを選択 */}
          <div>
            <label className="block text-[10px] font-black text-text-sub uppercase mb-1">
              作業担当者（複数選択可）
            </label>
            <div className="flex flex-wrap gap-2">
              {users.map(user => {
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
              ※選択した担当者にはSupabase上でタスクが共有されます（保存時にtask_assigneesテーブルへ反映）。
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
          <button type="submit" className="h-9 px-5 bg-accent hover:bg-accent/90 text-slate-950 font-black text-xs rounded-xl cursor-pointer shadow-md">
            {editingTask ? '変更を保存' : 'タスクを作成'}
          </button>
        </div>
      </form>
    </div>
  );
}
