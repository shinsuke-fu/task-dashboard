import type { AppTheme } from '../types/task';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  theme: AppTheme;
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({ currentView, onViewChange, isOpen, onToggle }: SidebarProps) {
  // 💡 洗練されたカスタムSVGアイコンをメニューごとに定義
  const menuItems = [
    { 
      id: 'dashboard', 
      label: 'ダッシュボード',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V16zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V16z" />
        </svg>
      )
    },
    { 
      id: 'schedule', 
      label: 'スケジュール',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      id: 'project', 
      label: 'プロジェクト管理',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      )
    },
    { 
      id: 'tasks', 
      label: 'タスク一覧',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    },
  ];

  return (
    <aside 
      className={`bg-card border-r border-border-card flex flex-col justify-between min-h-screen sticky top-0 transition-all duration-300 ease-in-out select-none ${
        isOpen ? 'w-64' : 'w-20'
      }`}
    >
      <div>
        {/* ロゴエリア */}
        <div className="p-4 border-b border-border-card">
          <button
            onClick={onToggle}
            className={`w-full h-12 flex items-center rounded-xl text-left hover:bg-surface/50 active:scale-98 transition-all duration-200 group cursor-pointer ${
              isOpen ? 'px-3' : 'justify-center'
            }`}
            title={isOpen ? "メニューを折りたたむ" : "メニューを展開する"}
          >
            {/* 💡 お気に入りの「角丸の四角形ロゴ」を完全復刻 */}
            <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-accent to-sky-500 flex items-center justify-center font-black text-sm text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.25)] group-hover:shadow-[0_0_20px_rgba(56,189,248,0.5)] group-hover:scale-105 transition-all duration-300 tracking-tighter">
              T+
            </div>
            {isOpen && (
              <div className="ml-3 overflow-hidden whitespace-nowrap animate-fade-in">
                <h2 className="font-extrabold text-sm tracking-wider text-text-main group-hover:text-accent transition-colors duration-200 uppercase">
                  Telework Plus
                </h2>
                <p className="text-[9px] text-text-sub font-bold tracking-widest mt-0.5">社内タスク管理ツール</p>
              </div>
            )}
          </button>
        </div>

        {/* 💡 閉じても開いても美しい、高級ラインアイコンメニュー */}
        <nav className="p-4 space-y-1.5">
          {menuItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full h-11 rounded-xl text-xs font-bold tracking-wider transition-all duration-200 flex items-center cursor-pointer relative group ${
                  isOpen ? 'px-3 gap-3' : 'justify-center'
                } ${
                  isActive
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'text-text-sub hover:bg-surface hover:text-text-main border border-transparent'
                }`}
                title={!isOpen ? item.label : undefined}
              >
                {/* w-9 の中にアイコンの中心がバチッと収まり、ロゴの縦ラインと完全同期 */}
                <span className={`w-9 flex-shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-accent' : 'text-text-sub group-hover:text-text-main'}`}>
                  {item.icon}
                </span>
                {isOpen && <span className="overflow-hidden whitespace-nowrap font-semibold">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-border-card text-center overflow-hidden whitespace-nowrap text-text-sub text-[9px] font-bold tracking-widest">
        {isOpen ? 'VERSION 1.0.0 @ INTERNAL' : 'V1.0'}
      </div>
    </aside>
  );
}
