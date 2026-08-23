/**
 * src/lib/supabaseClient.ts
 * -----------------------------------------------------------------------
 * 【役割】
 *   Supabaseクライアントのインスタンスを1つだけ生成し、アプリ全体で使い回す
 *   ための入り口。App.tsx・Login.tsxなど、Supabaseにアクセスするすべての
 *   ファイルはここから`supabase`をimportして使う（複数箇所でクライアントを
 *   作り直さない）。
 *
 * 【環境変数】
 *   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY は、プロジェクトルートの
 *   `.env`ファイルに設定する（`.env.example`をコピーして`.env`を作成し、
 *   Supabaseダッシュボード → Settings → API に表示される値を入れる）。
 *   `.env`はGitにコミットしない（.gitignoreで除外済み）。anon keyは
 *   「公開しても安全なキー」として設計されている（実際のアクセス制御は
 *   DB側のRLSポリシーが担う）が、念のためコードに直書きせず環境変数経由にしている。
 * -----------------------------------------------------------------------
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
