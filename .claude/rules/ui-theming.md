---
paths:
  - "src/components/**/*.tsx"
  - "src/pages/**/*.tsx"
  - "src/App.tsx"
---

# UI・配色・レスポンシブのルール

- **色は必ずCSS変数経由**：`src/index.css`の`@theme`で定義した`bg-base` `bg-card`
  `text-accent` `border-border-card`等のみを使う。色をハードコードしない（`規約.md`③）
- **アクセント背景の上の文字は`text-on-accent`**：`bg-accent`等をベタ塗り背景として使う
  ボタン・バッジの文字色は`text-on-accent`にする（ダーク系テーマ＝黒／ライト系テーマ＝白に
  自動で切り替わり、可読性を確保する）
- **例外：W+ロゴは常に固定で黒（`text-slate-950`）**：ロゴは装飾目的のブランドマークであり
  機能的なテキストではないため、`text-on-accent`にせず固定色にする
  （`Sidebar.tsx` `Login.tsx` `ResetPassword.tsx` `AboutSection.tsx`が例）
- **幅が可変の領域（サイドバーの開閉で実質幅が変わる画面）はコンテナクエリを使う**：
  ビューポート幅基準の`md:` `sm:`ではなく、`App.tsx`の`<main>`に付けた`@container`を
  基準にした`@min-[Npx]:`を使う。サイドバー開閉で「実際に使える横幅」が変わるため、
  ビューポート幅だけで判定すると崩れる（`KanbanBoard.tsx` `ScheduleView.tsx`が例）
- **横スクロールより折り返し**：`overflow-x-auto`より`flex-wrap`を優先する
- **`<main>`直下の一面表示ページは自前で`mx-auto`を付ける**：`<main>`側では中央寄せされない
- **状態は`App.tsx`に一元化**：子コンポーネントは共有データを直接書き換えず、Props経由で
  親の更新関数を呼ぶ（`規約.md`①）
