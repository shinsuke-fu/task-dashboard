/**
 * src/main.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   アプリのエントリーポイント。index.html の #root 要素に
 *   ルートコンポーネント <App /> をマウントするだけのファイル。
 *   通常はここに機能追加は行わない。
 * -----------------------------------------------------------------------
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
