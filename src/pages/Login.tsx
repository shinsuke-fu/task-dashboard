/**
 * src/pages/Login.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   ログイン画面。App.tsx で isAuthenticated が false のときにのみ表示される。
 *
 * 【主な処理】
 *   1. Supabase Authの signInWithPassword / signUp をそのまま呼び出す
 *      （認証・DB設計書.md 3章の方針通り、メールアドレス＋パスワード方式）
 *   2. サインイン／新規登録はタブで切り替える。新規登録時は表示名も入力する
 *      （その値はDB側のトリガーで`profiles.display_name`に自動反映される）
 *   3. 新規登録が成功したら、メールアドレス確認が必須のため（Supabase Authの
 *      デフォルト設定）「確認メールを送信しました」という案内画面に切り替える
 *   4. サインイン成功後の画面遷移は、このコンポーネントでは行わない。
 *      App.tsx側がSupabaseの`onAuthStateChange`を購読しており、セッションが
 *      できた時点で自動的にログイン後の画面へ切り替わる
 *   5. 「パスワードをお忘れですか？」から遷移するパスワード再設定リクエスト
 *      （メールアドレスのみ入力→ `resetPasswordForEmail` で再設定用メールを送信）。
 *      メール内リンクをクリックした後の「新しいパスワードを入力する」画面は
 *      別コンポーネント（`ResetPassword.tsx`）が担当し、App.tsx側で
 *      `onAuthStateChange`の`PASSWORD_RECOVERY`イベントを検知して出し分ける
 *   6. 【ゲストログイン・2026-08-31】ポートフォリオ経由の訪問者が登録なしで
 *      試せるよう、Supabaseの匿名認証（signInAnonymously）を使った「ゲストとして
 *      ログイン」ボタンを用意。このコンポーネントの役割はsignInAnonymously()を呼ぶだけで、
 *      デモ用プロジェクト・サンプルタスクの自動投入はApp.tsx側で行う
 *      （App.tsx冒頭のコメント・seedGuestDemoData参照）。
 *      【不具合修正・2026-08-31】当初はこのコンポーネント内で投入まで完結させていたが、
 *      signInAnonymously()成功と同時にApp.tsx側のログイン検知（onAuthStateChange）が走り、
 *      「プロジェクト一覧の取得」と「デモデータの作成」が競合し、取得の方が先に終わって
 *      新規プロジェクトが画面に反映されない、という再現性の低い不具合があった。
 *      App.tsx側に処理を寄せることで、「初回のプロジェクト一覧取得が完了した後に
 *      デモデータを作成し、作成完了後に明示的に再取得する」という順序を保証している
 * -----------------------------------------------------------------------
 */
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Mode = 'signIn' | 'signUp' | 'resetRequest';

export const Login: React.FC = () => {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signupEmailSent, setSignupEmailSent] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isGuestSubmitting, setIsGuestSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    if (mode === 'signIn') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErrorMessage(translateAuthError(error.message));
      // 成功時は何もしない：App.tsx側のonAuthStateChangeが検知して自動的に画面が切り替わる
    } else if (mode === 'signUp') {
      if (!displayName.trim()) {
        setErrorMessage('表示名を入力してください。');
        setIsSubmitting(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName.trim() } },
      });
      if (error) {
        setErrorMessage(translateAuthError(error.message));
      } else {
        setSignupEmailSent(true); // 「確認メールを送信しました」画面へ切り替える
      }
    } else {
      // mode === 'resetRequest'：パスワード再設定メールの送信リクエスト。
      // redirectToはこのアプリ自身のURL（開発中はlocalhost、本番デプロイ後はそのドメイン）。
      // ※Supabaseダッシュボード側の「Authentication → URL Configuration → Redirect URLs」に
      //   このURLを許可リストとして登録しておく必要がある（未登録だとメールのリンクが弾かれる）
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) {
        setErrorMessage(translateAuthError(error.message));
      } else {
        setResetEmailSent(true); // 「再設定メールを送信しました」画面へ切り替える
      }
    }
    setIsSubmitting(false);
  };

  // 【ゲストログイン・2026-08-31】登録・パスワード不要でその場で試せる、匿名ログイン用ハンドラ。
  // 成功後の画面遷移・デモデータの自動投入は、いずれもApp.tsx側のonAuthStateChangeに任せる
  // （ファイル冒頭のコメント参照。以前はここでデモデータ作成まで行っていたが、競合を避けるため移動した）
  const handleGuestLogin = async () => {
    setErrorMessage(null);
    setIsGuestSubmitting(true);

    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      setErrorMessage(translateAuthError(error.message));
    }
    setIsGuestSubmitting(false);
  };

  // Supabaseのエラーメッセージ（英語）のうち、よくあるものだけ日本語に置き換える。
  // 該当しないものはそのまま表示する（原文情報を落とさないため）
  const translateAuthError = (message: string): string => {
    if (message.includes('Invalid login credentials')) {
      return 'メールアドレスまたはパスワードが正しくありません。';
    }
    if (message.includes('User already registered')) {
      return 'このメールアドレスは既に登録されています。サインインしてください。';
    }
    if (message.includes('Password should be at least')) {
      return 'パスワードは6文字以上で入力してください。';
    }
    if (message.includes('Email not confirmed')) {
      return 'メールアドレスの確認がまだ完了していません。届いた確認メールのリンクをクリックしてください。';
    }
    return message;
  };

  // モード切り替え時は、入力途中の値やエラー表示をきれいにリセットする
  const switchMode = (next: Mode) => {
    setMode(next);
    setErrorMessage(null);
    setPassword('');
  };

  // 新規登録直後：確認メール送信済みの案内画面
  if (signupEmailSent) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-900 bg-zinc-900/30 p-8 backdrop-blur-xl shadow-2xl text-center">
          <div className="h-9 w-9 mx-auto rounded-xl bg-gradient-to-br from-accent to-sky-500 flex items-center justify-center mb-4 font-black text-xs text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.25)] tracking-tighter">
            W+
          </div>
          <h2 className="text-sm font-medium text-zinc-200 mb-2">確認メールを送信しました</h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            <span className="text-zinc-300 font-mono">{email}</span> 宛てに確認メールを送信しました。
            メール内のリンクをクリックすると、登録が完了しサインインできるようになります。
          </p>
          <button
            type="button"
            onClick={() => { setSignupEmailSent(false); switchMode('signIn'); }}
            className="mt-6 w-full h-9 bg-zinc-200 hover:bg-white text-zinc-950 text-xs font-medium rounded-lg transition-all active:scale-[0.99]"
          >
            サインイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

  // パスワード再設定メール送信直後の案内画面
  if (resetEmailSent) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-900 bg-zinc-900/30 p-8 backdrop-blur-xl shadow-2xl text-center">
          <div className="h-9 w-9 mx-auto rounded-xl bg-gradient-to-br from-accent to-sky-500 flex items-center justify-center mb-4 font-black text-xs text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.25)] tracking-tighter">
            W+
          </div>
          <h2 className="text-sm font-medium text-zinc-200 mb-2">パスワード再設定メールを送信しました</h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            <span className="text-zinc-300 font-mono">{email}</span> 宛てに再設定用のメールを送信しました。
            メール内のリンクをクリックすると、新しいパスワードを設定する画面に進みます。
            メールが届かない場合は、迷惑メールフォルダもご確認ください。
          </p>
          <button
            type="button"
            onClick={() => { setResetEmailSent(false); switchMode('signIn'); }}
            className="mt-6 w-full h-9 bg-zinc-200 hover:bg-white text-zinc-950 text-xs font-medium rounded-lg transition-all active:scale-[0.99]"
          >
            サインイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-900 bg-zinc-900/30 p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col items-center justify-center text-center mb-8">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent to-sky-500 flex items-center justify-center mb-3 font-black text-xs text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.25)] tracking-tighter">
            W+
          </div>
          <h2 className="text-sm font-medium text-zinc-200">WORK PLUS</h2>
          <p className="mt-1 text-xs text-zinc-500">{mode === 'resetRequest' ? 'パスワード再設定' : 'ログイン認証'}</p>
        </div>

        {/* サインイン／新規登録の切り替えタブ（パスワード再設定モードのときは表示しない） */}
        {mode !== 'resetRequest' && (
          <div className="flex mb-5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-0.5">
            <button
              type="button"
              onClick={() => switchMode('signIn')}
              className={`flex-1 h-8 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                mode === 'signIn' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              サインイン
            </button>
            <button
              type="button"
              onClick={() => switchMode('signUp')}
              className={`flex-1 h-8 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                mode === 'signUp' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              新規登録
            </button>
          </div>
        )}

        {/* 【ゲストログイン・2026-08-31】登録・パスワード不要でその場で試せる案内。
            ポートフォリオ経由の訪問者向けの導線のため、パスワード再設定画面では表示しない */}
        {mode !== 'resetRequest' && (
          <div className="mb-5">
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={isGuestSubmitting || isSubmitting}
              className="w-full h-9 bg-zinc-900/60 hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-800 text-zinc-300 text-xs font-medium rounded-lg transition-all active:scale-[0.99] cursor-pointer"
            >
              {isGuestSubmitting ? '準備中…' : 'ゲストとしてログイン（登録不要）'}
            </button>
            <p className="mt-2 text-[10px] text-zinc-600 leading-relaxed text-center">
              サンプルデータ入りのデモ用アカウントですぐに操作を試せます。ログアウトすると
              作成したデータは自動的に削除されます。
            </p>
            <div className="flex items-center gap-2 mt-4 mb-1">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-[10px] text-zinc-600">または</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
          </div>
        )}

        {mode === 'resetRequest' && (
          <p className="text-[11px] text-zinc-500 leading-relaxed mb-4">
            登録済みのメールアドレスを入力してください。パスワード再設定用のリンクをメールで送信します。
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signUp' && (
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">表示名</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-zinc-950/60 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700/50 transition-all"
                placeholder="例：山田太郎"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-zinc-950/60 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700/50 transition-all font-mono"
              placeholder="name@example.com"
              required
            />
          </div>

          {/* パスワード欄：再設定リクエストモードでは不要（メールアドレスのみで送信） */}
          {mode !== 'resetRequest' && (
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">パスワード</label>
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
          )}

          {/* サインインモードのときだけ、パスワード再設定への導線を出す */}
          {mode === 'signIn' && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => switchMode('resetRequest')}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
              >
                パスワードをお忘れですか？
              </button>
            </div>
          )}

          {errorMessage && (
            <p className="text-[11px] text-rose-400 leading-relaxed">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-9 mt-2 bg-zinc-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 text-xs font-medium rounded-lg transition-all active:scale-[0.99]"
          >
            {isSubmitting
              ? '処理中…'
              : mode === 'signIn'
              ? 'サインイン'
              : mode === 'signUp'
              ? '新規登録する'
              : '再設定メールを送信'}
          </button>

          {mode === 'resetRequest' && (
            <button
              type="button"
              onClick={() => switchMode('signIn')}
              className="w-full text-center text-[11px] text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
            >
              サインイン画面に戻る
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
