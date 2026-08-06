import { useState } from 'react'

interface Task {
  id: number;
  title: string;
  category: string;
  dueDate: string;
  status: '未着手' | '進行中' | '完了';
}

export default function App() {
  const [tasks] = useState<Task[]>([
    { id: 1, title: '第1四半期 収支データの集計・確認', category: '財務会計', dueDate: '2026-08-10', status: '未着手' },
    { id: 2, title: '新規事業ダッシュボードのUI/UX設計', category: 'デザイン', dueDate: '2026-08-12', status: '進行中' },
    { id: 3, title: 'Vite + React + Tailwind v4 環境構築', category: 'システム', dueDate: '2026-08-06', status: '完了' },
  ]);

  return (
    // シックなリッチグレー（slate-900）の背景
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        
        {/* ヘッダーエリア：洗練されたタイポグラフィ */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-6 mb-10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Task Management System</h1>
            <p className="text-slate-400 text-sm mt-1">業務タスクの進捗とステータスを統合管理します。</p>
          </div>
          <div className="mt-4 md:mt-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              System Active
            </span>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            {/* テーブルヘッダー */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/80 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-400">Current Tasks</h2>
              <span className="text-xs text-slate-500">{tasks.length} tasks allocated</span>
            </div>

            {/* タスクリスト（テーブル風デザイン） */}
            <div className="divide-y divide-slate-800">
              {tasks.map((task) => (
                <div 
                  key={task.id} 
                  className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-white">{task.title}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                        {task.category}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      <span>期日:</span>
                      <span className="font-mono">{task.dueDate}</span>
                    </div>
                  </div>
                  
                  {/* シックな色使いのステータスバッジ */}
                  <div>
                    <span className={`inline-block px-3 py-1 rounded text-xs font-medium tracking-wide border ${
                      task.status === '完了' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50' :
                      task.status === '進行中' ? 'bg-amber-950/40 text-amber-400 border-amber-800/50' :
                      'bg-slate-900 text-slate-400 border-slate-700'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

      </div>
    </div>
  )
}
