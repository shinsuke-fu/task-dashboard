/**
 * vitest.config.ts
 * -----------------------------------------------------------------------
 * 【役割】
 *   Vitest（ユニットテスト実行環境）の設定。vite.config.tsとは別ファイルに
 *   している理由は、テストにはTailwind CSSのビルド処理（@tailwindcss/vite）
 *   が不要で、本番ビルド設定と混ぜると余計な依存関係が増えるため。
 * 【主な処理】
 *   ・Reactプラグイン：TaskCard.test.tsx等のJSX/TSXをテスト実行時に変換する
 *   ・environment: 'jsdom'：ブラウザのDOM APIをNode.js上で模倣し、
 *     Testing Libraryでのコンポーネントレンダリングを可能にする
 *   ・setupFiles：全テスト共通のセットアップ（src/test/setup.ts）を読み込む
 * -----------------------------------------------------------------------
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
