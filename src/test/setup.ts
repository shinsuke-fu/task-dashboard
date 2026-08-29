/**
 * src/test/setup.ts
 * -----------------------------------------------------------------------
 * 【役割】
 *   Vitestの全テスト実行前に読み込まれる共通セットアップ。
 * 【主な処理】
 *   1. @testing-library/jest-domのカスタムマッチャー（toBeInTheDocument等）を
 *      vitestのexpectに追加する。これを読み込まないと、TaskCard.test.tsx等で
 *      使っているtoBeInTheDocument()のようなマッチャーが型エラー・実行時エラーになる。
 *   2. 各テスト終了後に@testing-library/reactのcleanup()を呼び、前のテストで
 *      render()したコンポーネントをDOMから確実に取り除く。Testing Libraryは
 *      本来テストごとに自動でcleanupされるが、それはvitest.config.tsの
 *      `test.globals: true`（グローバルにafterEach等が生える設定）が前提の
 *      仕組みで、このプロジェクトではvitest本体からdescribe/it/expect等を
 *      明示的にimportする方針（globals: false）にしているため自動cleanupが
 *      効かない。ここで明示的に呼ぶことで、あるテストで描画したDOMが次の
 *      テストに残ってしまい、誤って「前のテストの要素」を検出してしまう事故
 *      （TaskCard.test.tsxで実際に発生した）を防ぐ。
 * -----------------------------------------------------------------------
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
