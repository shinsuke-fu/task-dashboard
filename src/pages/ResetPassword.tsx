/**
 * src/pages/ResetPassword.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   パスワード再設定メール内のリンクをクリックした後に表示する、
 *   「新しいパスワードを入力する」ための画面。
 *
 * 【表示されるタイミング】
 *   Login.tsx の「パスワードをお忘れですか？」から送信された再設定メールの
 *   リンクをクリックすると、SupabaseがURL内のトークンを検知して一時的な
 *   セッションを確立し、`supabase.auth.onAuthStateChange`が
 *   `PASSWORD_RECOVERY`イベントを発火する。App.tsx側はこれを検知して
 *   `isPasswordRecovery`をtrueにし、通常のログイン画面／ダッシュボードの
 *   代わりにこのコンポーネントを表示する（詳しくはApp.tsx参照）。
 *
 * 【主な処理】
 *   1. 新しいパスワードを2回入力させ、一致・6文字以上であることを確認
 *   2. `supabase.auth.updateUser({ password })` でパスワードを更新
 *   3. 成功したら親（App.tsx）にonDoneで通知し、通常のダッシュボード画面へ
 *      戻す（この時点ですでに再設定後のパスワードでセッションが確立済みのため、
 *      改めてサインインし直す必要はない）
 * -----------------------------------------------------------------------
 */
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface ResetPasswordProps {
  onDone: () => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ onDone }) => {
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 6) {
      setErrorMessage('パスワードは6文字以上で入力してください。');
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMessage('パスワードが一致しません。');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setIsDone(true);
  };

  if (isDone) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-900 bg-zinc-900/30 p-8 backdrop-blur-xl shadow-2xl text-center">
          <div className="h-9 w-9 mx-auto rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-center mb-4">
            <div className="h-3 w-3 rounded-sm bg-white" />
          </div>
          <h2 className="text-sm font-medium text-zinc-200 mb-2">パスワードを更新しました</h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            新しいパスワードでの再設定が完了しました。このまま続けて利用できます。
          </p>
          <button
            type="button"
            onClick={onDone}
            className="mt-6 w-full h-9 bg-zinc-200 hover:bg-white text-zinc-950 text-xs font-medium rounded-lg transition-all active:scale-[0.99]"
          >
            続ける
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-900 bg-zinc-900/30 p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col items-center justify-center text-center mb-8">
          <div className="h-9 w-9 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-center mb-3">
            <div className="h-3 w-3 rounded-sm bg-white" />
          </div>
          <h2 className="text-sm font-medium text-zinc-200">WORK PLUS</h2>
          <p className="mt-1 text-xs text-zinc-500">新しいパスワードの設定</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">新しいパスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-zinc-950/60 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700/50 transition-all font-mono"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">新しいパスワード（確認）</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-zinc-950/60 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700/50 transition-all font-mono"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          {errorMessage && (
            <p className="text-[11px] text-rose-400 leading-relaxed">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-9 mt-2 bg-zinc-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 text-xs font-medium rounded-lg transition-all active:scale-[0.99]"
          >
            {isSubmitting ? '処理中…' : 'パスワードを更新する'}
          </button>
        </form>
      </div>
    </div>
  );
};
