/**
 * src/components/TaskForm.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   タスクの新規作成・編集を行うモーダルフォーム。isOpen=trueの間だけ
 *   描画され、editingTaskの有無で「新規作成」「編集」の両モードを兼ねる。
 *
 * 【主な処理】
 *   1. isOpenがtrueになった瞬間にフォーム項目を初期化（新規 or 編集内容）
 *   2. 作業担当者は常にログインユーザー本人（現状はu1固定）に自動セット
 *   3. 確認者（レビュアー）は自分以外のユーザーから選択
 *   4. 送信時にonAddTaskを呼び出し、実際の保存処理はApp.tsx側に委譲
 *
 * 【現状の制約（暫定）】
 *   currentUserId は 'u1' に固定されている。ログイン機能の実装後は、
 *   実際にログイン中のユーザーIDに置き換える必要がある。
 * -----------------------------------------------------------------------
 */
import { useState, useEffect } from 'react';
import type { Task, User } from '../types/task';

interface TaskFormProps {
  isOpen: boolean;
  editingTask?: Task;
  users: User[];
  onClose: () => void;
  onAddTask: (task: Omit<Task, 'id' | 'status'>) => void;
}

export default function TaskForm({ isOpen, editingTask, users, onClose, onAddTask }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'開発' | 'デザイン' | 'マーケ' | 'その他'>('開発');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [endDate, setEndDate] = useState('');
  
  // 自分（ログインユーザー）のIDを常に自動セットし、変更不可にします
  const currentUserId = 'u1'; 
  
  // 確認者（レビュアー）を管理するステートを新設（デフォルトは山田: u2）
  const [reviewerId, setReviewerId] = useState<string>('u2');

  // isOpen が「true になった瞬間」だけ確実に初期化し、編集中の中途半端な上書きループを徹底遮断
  useEffect(() => {
    if (!isOpen) return;

    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setCategory(editingTask.category || '開発');
      setPriority(editingTask.priority || 'medium');
      setEndDate(editingTask.endDate);
      
      // 既存タスクに確認者が設定されていればそれをセット
      setReviewerId(editingTask.reviewerId || 'u2');
    } else {
      setTitle('');
      setDescription('');
      setCategory('開発');
      setPriority('medium');
      setEndDate('2026-08-10'); // 2026年8月JST基準のデフォルト
      setReviewerId('u2'); // デフォルト確認者
    }
  }, [isOpen]); // 依存配列を isOpen のみに絞ることで、送信時の逆流リセットバグを完全消滅させます

  if (!isOpen) return null;

  // 自分以外の確認者（レビュアー）候補メンバーを抽出（自分をアサインから除外するため）
  const reviewerCandidates = users.filter(user => user.id !== currentUserId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // 親の型定義(string等)に安全に適合させ、最新の値を確実に最優先で送信
    onAddTask({
      title: title.trim(),
      description: description.trim() ? description.trim() : undefined,
      category: category,
      priority: priority,
      startDate: editingTask?.startDate ? editingTask.startDate : '2026-08-10',
      endDate: endDate,
      assignees: [currentUserId], // 担当者は常に自分「u1」を自動で100%固定代入
      reviewerId: reviewerId,     // 選択した確認者（レビュアー）のIDを直通バインド
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

          {/*「担当者アサイン」欄から、スマートで機能的な「確認者（レビュアー）指定」欄へ刷新 */}
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
            <p className="text-[10px] text-text-sub mt-1.5 pl-1 font-medium">
              ※ご自身の個人用ワークスペースのため、タスクの作業担当者は自動的に <span className="text-accent font-bold">あなた（自分）</span> に固定されます。
            </p>
          </div>

          {/* メタデータ選択（カテゴリ・優先度・期日） */}
          <div className="grid grid-cols-3 gap-3">
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
