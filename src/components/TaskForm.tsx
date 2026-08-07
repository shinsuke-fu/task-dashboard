import { useState, useEffect } from 'react';
import type { Task, TaskCategory, TaskPriority, User } from '../types/task';

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
  const [category, setCategory] = useState<TaskCategory>('開発');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [endDate, setEndDate] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 💡 編集モードと新規作成モードの切り替え時の初期化ロジックを完全クリーンアップ
  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        setTitle(editingTask.title);
        setDescription(editingTask.description || '');
        setCategory(editingTask.category);
        setPriority(editingTask.priority);
        setEndDate(editingTask.endDate);
        setAssignees(editingTask.assignees || []);
      } else {
        setTitle('');
        setDescription('');
        setCategory('開発');
        setPriority('medium');
        // 日付を文字列（YYYY-MM-DD）として正しくセット
        setEndDate(new Date().toISOString().split('T')[0]);
        setAssignees(['u1']); // 初期アサインは自分
      }
      setSearchQuery('');
    }
  }, [editingTask, isOpen]);

  if (!isOpen) return null;

  // 検索クエリに基づいてユーザーをフィルタリング
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 担当者の追加・削除（トグル）処理
  const handleToggleAssignee = (userId: string) => {
    setAssignees(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAddTask({
      title,
      description: description.trim() ? description : undefined,
      category,
      priority,
      startDate: editingTask ? editingTask.startDate : new Date().toISOString().split('T')[0],
      endDate,
      assignees,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <form onSubmit={handleSubmit} className="w-full max-w-lg bg-card border border-border-card rounded-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* ヘッダー */}
        <div className="flex items-center justify-between pb-2 border-b border-border-card/40">
          <h3 className="font-extrabold text-xs tracking-wider text-text-main">
            {editingTask ? '📝 タスクの編集' : '✨ 新しいタスクの追加'}
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

          {/* 検索機能付き担当者追加UI */}
          <div>
            <label className="block text-[10px] font-black text-text-sub uppercase mb-1">担当者の検索・アサイン</label>
            <input 
              type="text" 
              placeholder="名前でメンバーを検索..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full h-8 bg-base border border-border-card rounded-lg px-3 mb-2 text-text-main focus:outline-none focus:border-accent text-[11px]" 
            />
            <div className="flex flex-wrap gap-1.5 p-2 bg-base rounded-xl border border-border-card max-h-24 overflow-y-auto">
              {filteredUsers.map(user => {
                const isChecked = assignees.includes(user.id);
                return (
                  <button 
                    type="button" 
                    key={user.id} 
                    onClick={() => handleToggleAssignee(user.id)} 
                    className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold cursor-pointer transition select-none ${
                      isChecked ? 'border-accent bg-accent/10 text-accent' : 'border-border-card text-text-sub hover:bg-card'
                    }`}
                  >
                    {user.name} {isChecked ? '✓' : '+'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-black text-text-sub uppercase mb-1">カテゴリ</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as TaskCategory)} className="w-full h-9 bg-base border border-border-card rounded-xl px-2 font-bold text-text-main cursor-pointer">
                <option value="開発">開発</option>
                <option value="デザイン">デザイン</option>
                <option value="マーケ">マーケ</option>
                <option value="その他">その他</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-text-sub uppercase mb-1">優先度</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="w-full h-9 bg-base border border-border-card rounded-xl px-2 font-bold text-text-main cursor-pointer">
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-text-sub uppercase mb-1">期日</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full h-9 bg-base border border-border-card rounded-xl px-2 font-bold font-mono text-text-main cursor-pointer" />
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
