/**
 * src/test/setup.ts
 * Vitestの全テスト実行前に読み込まれる共通セットアップ。jest-domのカスタムマッチャーを
 * 追加し、各テスト後にcleanup()を呼ぶ（このプロジェクトはvitest.config.tsで
 * test.globals: falseにしているため自動cleanupが効かず、明示的な呼び出しが必要）。
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
