/**
 * src/hooks/useViewNavigation.ts
 * 画面切り替え（一面集約型SPAのcurrentView文字列）・サイドバー開閉・
 * アバター拡大表示（ImageLightbox）の開閉状態をまとめて扱うフック。
 */
import { useState } from 'react';

export function useViewNavigation() {
  // 現在表示中のビュー（'dashboard' | 'tasks' | その他）。文字列切替による一面集約型ルーティング
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // ヘッダーのアバター画像をクリックしたときの拡大表示（ImageLightbox）の開閉状態
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState<boolean>(false);

  // サイドバーの項目選択によるビュー切り替え。スマホ幅（オーバーレイ表示）で選択した場合は、
  // 選択と同時にサイドバーを閉じてメイン画面が見えるようにする（PC幅では常時表示のため閉じない）
  const handleViewChange = (view: string) => {
    setCurrentView(view);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  return {
    currentView,
    setCurrentView,
    isSidebarOpen,
    setIsSidebarOpen,
    isAvatarPreviewOpen,
    setIsAvatarPreviewOpen,
    handleViewChange,
  };
}
