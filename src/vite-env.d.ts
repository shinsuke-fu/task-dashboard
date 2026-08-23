/// <reference types="vite/client" />

/**
 * .envファイルで定義するVITE_接頭辞つきの環境変数に、きちんとした型を付ける。
 * これが無くても`import.meta.env.VITE_SUPABASE_URL`は`any`として動作はするが、
 * 規約.mdの「型定義を安易に緩めない」方針に合わせて明示的に型を付けている。
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
