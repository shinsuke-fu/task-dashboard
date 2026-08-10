import { useState, useEffect, useRef } from 'react';
import type { Task, AppTheme, User } from './types/task';
import Sidebar from './components/Sidebar';
import KanbanBoard from './components/KanbanBoard';
import TaskForm from './components/TaskForm';
import { DashboardView } from './components/dashboard/DashboardView'; // 🔥 フェーズ2追加

const mockUsers: User[] = [
  { id: 'u1', name: '自分（作業者）' },
  { id: 'u2', name: '山田（開発）' },
  { id: 'u3', name: '佐藤（上司・レビュアー）' },
];

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
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [theme, setTheme] = useState<AppTheme>('sage-dark');
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [theme]);

  const handleSaveTask = (taskData: Omit<Task, 'id' | 'status'>) => {
    if (editingTask) {
      setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...taskData } : t));
    } else {
      const newTask: Task = { 
        ...taskData, 
        id: crypto.randomUUID(), 
        status: 'todo' 
      };
      setTasks([newTask, ...tasks]);
    }
    setIsModalOpen(false);
    setEditingTask(undefined);
  };

  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  const handleUpdateStatus = (id: string, newStatus: Task['status']) => {
    setTasks(tasks.map(task => {
      if (task.id !== id) return task;
      if (newStatus !== 'doing') {
        return { ...task, status: newStatus, returnReason: undefined };
      }
      return { ...task, status: newStatus };
    }));
  };

  const handleProcessAction = (id: string, action: 'apply' | 'approve' | 'reject', reason?: string) => {
    setTasks(tasks.map(task => {
      if (task.id !== id) return task;
      if (action === 'apply') return { ...task, status: 'review', returnReason: undefined };
      if (action === 'approve') return { ...task, status: 'done', returnReason: undefined };
      if (action === 'reject') return { ...task, status: 'doing', returnReason: reason || '要修正項目があります。' };
      return task;
    }));
  };

  const handleStartEdit = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const themeLabels: Record<AppTheme, string> = {
    'sage-dark': 'SAGE',
    'terracotta-dark': 'TERRACOTTA',
    'bronze-dark': 'BRONZE',
    'ocean-dark': 'OCEAN',
    'amethyst-dark': 'AMETHYST',
    'graphite-dark': 'GRAPHITE',
    'lime-dark': 'LIME',
    'light': 'LIGHT',
    'coffee-dark': 'COFFEE',
  };

  return (
    <div className="flex h-screen w-screen bg-base text-text-main font-sans transition-colors duration-300 overflow-hidden relative">
      
      {/* 左側：サイドバーメニュー */}
      <div className={`fixed md:sticky top-0 bottom-0 z-50 h-full transition-transform duration-300 md:translate-x-0 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:w-20'
      }`}>
        <Sidebar 
          currentView={currentView} 
          onViewChange={setCurrentView} 
          theme={theme} 
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />
      </div>

      {/* スマホ用：サイドバーオープン時の背景シールド */}
      {isSidebarOpen && (
        <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 md:hidden cursor-pointer" />
      )}

      {/* 右側：メインコンテンツ領域（h-screenかつ独立したフレックス縦並び） */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        
        {/* ＝ 💡 スマホ完全対応：共通グローバルヘッダー ＝ */}
        <header className="h-16 border-b border-border-card px-4 md:px-8 flex items-center justify-between bg-card/30 backdrop-blur-md flex-shrink-0 z-30 select-none">
          
          {/* 左側：メニューボタン ＆ 現在のビュー名 */}
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => { setIsSidebarOpen(!isSidebarOpen); setIsThemeMenuOpen(false); }}
              className="p-2 rounded-xl bg-card border border-border-card text-text-sub hover:text-text-main md:hidden cursor-pointer flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-[10px] md:text-xs font-black tracking-widest uppercase text-accent truncate max-w-[100px] sm:max-w-none">
              {currentView === 'dashboard' ? 'ANALYTICS' : currentView === 'tasks' ? 'BOARD' : 'EXTENSION'}
            </span>
          </div>

          {/* 右側：アクションエリア */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* 新規作成ボタン */}
            <button
              onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }}
              className="h-9 px-3 md:px-4 bg-accent hover:bg-accent/90 text-slate-950 font-black text-xs tracking-wider rounded-xl shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="新規タスクを作成"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">新規作成</span>
            </button>

            {/* カスタムドロップダウン */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                className="h-9 bg-card border border-border-card rounded-xl px-2.5 md:px-4 flex items-center justify-between text-text-main text-[10px] md:text-xs font-extrabold tracking-wide hover:border-border-card/80 transition-all cursor-pointer min-w-[75px] md:min-w-32 active:scale-98"
              >
                <span>{themeLabels[theme]}</span>
                <svg className={`w-3 h-3 text-text-sub ml-1 md:ml-2 flex-shrink-0 transition-transform duration-200 ${isThemeMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* テーマ選択メニュー */}
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

            {/* 通知ベルアイコン */}
            <button className="text-text-sub hover:text-text-main transition relative cursor-pointer p-1.5 flex items-center justify-center" title="通知">
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500 ring-1 ring-card" />
            </button>

            {/* ユーザープロフィールアバター */}
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-border-card border border-accent/30 flex items-center justify-center font-bold text-[8px] md:text-[10px] flex-shrink-0">
              USR
            </div>
          </div>
        </header>

        {/* ＝ 💡 改善の核心：メインビュー領域のみを完全独立スクロール化 ＝ */}
        <main className="flex-1 h-[calc(100vh-64px)] overflow-y-auto p-4 md:p-6 lg:p-8 bg-base/50">
          <div className="max-w-7xl mx-auto w-full h-full">
            {currentView === 'dashboard' ? (
              <div className="animate-fade-in pb-8">
                <DashboardView tasks={tasks} users={mockUsers} />
              </div>
            ) : currentView === 'tasks' ? (
              <div className="space-y-6 animate-fade-in pb-8">
                <KanbanBoard 
                  tasks={tasks}
                  onUpdateStatus={handleUpdateStatus}
                  onProcessAction={handleProcessAction}
                  onDeleteTask={handleDeleteTask}
                  onStartEdit={handleStartEdit}
                />
              </div>
            ) : (
              <div className="bg-card backdrop-blur-md p-12 rounded-2xl border border-border-card text-center animate-fade-in">
                <h2 className="text-md font-bold uppercase tracking-wider mb-2 text-accent">COMING SOON</h2>
                <p className="text-text-sub text-xs">
                  現在選択されているビュー項目: <span className="font-mono font-bold text-text-main">{currentView === 'schedule' ? 'スケジュール' : 'プロジェクト管理'}</span>
                </p>
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
    </div>
  );
}