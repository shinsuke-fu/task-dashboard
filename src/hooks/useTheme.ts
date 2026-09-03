/**
 * src/hooks/useTheme.ts
 * 配色テーマ（12種類）の状態管理。個人の見た目の好みのためlocalStorageにのみ保存する
 * （Supabase化はしていない）。テーマ変更時は<html>のdata-theme属性も反映する。
 */
import { useEffect, useState } from 'react';
import type { AppTheme } from '../types/task';

// テーマ切替メニューのラベル一覧。ダーク6種・ライト6種の計12種（純白は避けている）。
// GRAPHITEがデフォルト兼先頭（オブジェクトのプロパティ順＝表示順）
export const themeLabels: Record<AppTheme, string> = {
  'graphite-dark': 'GRAPHITE', 'sage-dark': 'SAGE', 'bronze-dark': 'BRONZE',
  'ocean-dark': 'OCEAN', 'amethyst-dark': 'AMETHYST', 'lime-dark': 'LIME',
  'cream-light': 'CREAM', 'linen-light': 'LINEN', 'mist-light': 'MIST',
  'pearl-light': 'PEARL', 'stone-light': 'STONE', 'sand-light': 'SAND',
};

// onMobileAutoClose：テーマ変更時、スマホ幅では自動的にサイドバーを閉じるためのコールバック
// （サイドバーの開閉状態自体は現時点でもApp.tsx側が保持しているため、setter関数を注入する形にする）
export function useTheme(onMobileAutoClose: () => void) {
  // 配色テーマ（12種類）。これは複数人で共有する必要のない「個人の見た目の好み」なので、
  // 引き続きこのブラウザのlocalStorageにのみ保存する（Supabase化はしていない）。
  // デフォルトはGRAPHITE（src/index.cssの`:root`側もGRAPHITEに合わせてある）
  const [theme, setTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem('dashboard_theme') as AppTheme) || 'graphite-dark';
  });

  // テーマ変更時：localStorageへ保存＋<html>にdata-theme属性を反映（CSS変数切替）。
  // 併せて、スマホ幅では自動的にサイドバーを閉じる
  useEffect(() => {
    localStorage.setItem('dashboard_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);

    if (window.innerWidth < 768) {
      onMobileAutoClose();
    }
  }, [theme]);

  return { theme, setTheme };
}
