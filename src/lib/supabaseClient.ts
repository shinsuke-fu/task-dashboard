/**
 * src/lib/supabaseClient.ts
 * Supabaseクライアントのインスタンスを1つだけ生成し、アプリ全体で使い回す入り口。
 * Supabaseにアクセスするすべてのファイルはここから`supabase`をimportして使う。
 * 環境変数（VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY）は.envに設定する（.env.example参照）。
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // .envの設定漏れに気づきやすいよう、起動時にコンソールへ警告を出す
  console.error(
    '[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が設定されていません。' +
    ' .env.example をコピーして .env を作成し、Supabaseダッシュボード（Settings → API）の値を設定してください。'
  );
}

// ブラウザ／fetchの既定動作で同一URL・同一クエリのGETがキャッシュされ、保存後の
// refreshTasks()で古いデータが表示され続ける不具合があったため、fetchをラップし
// 常にcache: 'no-store'でネットワークへ問い合わせるようにしている
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  },
});
