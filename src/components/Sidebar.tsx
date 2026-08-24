/**
 * src/components/Sidebar.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   画面左側のナビゲーションメニュー（開閉可能）。ロゴ／メニュー項目／
 *   ログアウトボタン・設定ボタンを表示するだけの見た目主体のコンポーネントで、
 *   状態は一切保持しない（表示中ビュー・開閉状態はApp.tsxからProps経由）。
 *
 * 【主な処理】
 *   1. menuItems配列を定義し、選択中(currentView)に応じてハイライト表示
 *   2. isOpen（開閉状態）に応じて、幅・ラベル表示・アイコンレイアウトを切替
 *   3. ログアウトボタン押下でonLogoutを呼び出す（実処理はApp.tsx側）
 *   4. 設定ボタン押下でonOpenSettingsを呼び出す（App.tsx側で currentView を 'settings' に
 *      切り替え、設定ページへ遷移する。ヘッダーのアバター横にある設定ボタンと同じ
 *      ページへ遷移する、2つ目の入り口）。currentView==='settings' のときは選択中と
 *      同じ見た目でハイライト表示する
 * -----------------------------------------------------------------------
 */

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
}

export default function Sidebar({
  currentView,
  onViewChange,
  isOpen,
  onToggle,
  onLogout,
  onOpenSettings
}: SidebarProps) {
  // ナビゲーション項目の定義（id は App.tsx の currentView と対応）
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
            <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-accent to-sky-500 flex items-center justify-center font-black text-sm text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.25)] group-hover:shadow-[0_0_20px_rgba(56,189,248,0.5)] group-hover:scale-105 transition-all duration-300 tracking-tighter">
              W+
            </div>
            {isOpen && (
              <div className="ml-3 overflow-hidden whitespace-nowrap animate-fade-in">
                <h2 className="font-extrabold text-sm tracking-wider text-text-main group-hover:text-accent transition-colors duration-200 uppercase">
                  WORK PLUS
                </h2>
                <p className="text-[9px] text-text-sub font-bold tracking-widest mt-0.5">ワークプラス</p>
              </div>
            )}
          </button>
        </div>

        {/* 高級ラインアイコンメニュー */}
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
                <span className={`w-9 flex-shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-accent' : 'text-text-sub group-hover:text-text-main'}`}>
                  {item.icon}
                </span>
                {isOpen && <span className="overflow-hidden whitespace-nowrap font-semibold">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* フッターエリア：ログアウトボタン＋設定ボタンを内蔵。
          展開時は横並び（ログアウトが幅可変、設定はアイコンのみの正方形）、
          折りたたみ時は幅が足りないため縦並びにする */}
      <div className="p-4 border-t border-border-card flex flex-col gap-3">
        <div className={`flex gap-2 ${isOpen ? 'flex-row' : 'flex-col'}`}>
          <button
            onClick={onLogout}
            className={`h-10 rounded-xl text-xs font-bold tracking-wider text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-200 flex items-center cursor-pointer group ${
              isOpen ? 'flex-1 px-3 gap-3' : 'w-full justify-center'
            }`}
            title={!isOpen ? "ログアウト" : undefined}
          >
            <span className="w-9 flex-shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
              <svg className="w-5 h-5 stroke-[2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </span>
            {isOpen && <span className="overflow-hidden whitespace-nowrap font-semibold">ログアウト</span>}
          </button>

          {/* 設定ボタン：ヘッダーのアバター横のボタンと同じ設定ページへ遷移する（2つ目の入り口） */}
          <button
            onClick={onOpenSettings}
            className={`h-10 flex-shrink-0 rounded-xl border transition-all duration-200 flex items-center justify-center cursor-pointer ${
              isOpen ? 'w-10' : 'w-full'
            } ${
              currentView === 'settings'
                ? 'bg-accent/10 text-accent border-accent/20'
                : 'text-text-sub hover:text-text-main hover:bg-surface border-transparent hover:border-border-card'
            }`}
            title="設定"
          >
            <svg className="w-5 h-5 stroke-[2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
        </div>

        <div className="text-center overflow-hidden whitespace-nowrap text-text-sub text-[9px] font-bold tracking-widest pt-1">
          {isOpen ? 'バージョン 1.0.0（β版）' : 'v1.0'}
        </div>
      </div>
    </aside>
  );
}
