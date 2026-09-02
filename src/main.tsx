/**
 * src/main.tsx
 * アプリのエントリーポイント。index.htmlの#root要素にルートコンポーネント<App />を
 * マウントするだけのファイル。
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
