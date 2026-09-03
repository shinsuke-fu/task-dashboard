/**
 * src/hooks/useAuthSession.ts
 * Supabase Authのセッション管理と、アカウントのライフサイクル操作（ログアウト・
 * パスワード変更・退会）をまとめて扱うフック。App.tsxのコンポーネントインスタンス内で
 * useStateが呼ばれ続けるため、規約①のSSOT（状態の所有権はApp.tsxに一元化）とは
 * 矛盾しない（引継ぎメモ.md⑤参照）。
 */
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  // 初回のセッション確認が終わるまでは、ログイン画面を一瞬出さないようにするためのフラグ
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // パスワード再設定メールのリンクを踏んだ直後かどうか。trueの間は、ログイン後でも
  // 通常のダッシュボードではなく「新しいパスワードを入力する」画面（ResetPassword.tsx）を
  // 優先して表示する（App.tsx側の画面出し分けを参照）
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    // セッション変化を購読し続ける。パスワード再設定リンクを踏むと、Supabaseが自動的に
    // 一時セッションを確立し'PASSWORD_RECOVERY'イベントが届く
    // （このタイミングでは新しいパスワードはまだ設定されていない）
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const isAuthenticated = session !== null;
  // 自分（ログインユーザー）のID。通知ベルの「自分宛て」判定や、
  // タスク作成時のcreated_by／デフォルト担当者に使用する
  const currentUserId = session?.user.id ?? '';

  // 自分自身のauth.usersを削除した直後にsignOut()を呼ぶとuser_not_foundエラーになる
  // Supabase Auth既知の挙動（経緯：学習ノート.md8.6）。実害はないためscope: 'local'で
  // エラーを無視する。退会・ゲストログアウトの両方で共通して使う
  const signOutAfterAccountDeletion = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // 上記コメント参照：想定内のため何もしない
    }
  };

  // パスワード変更（ResetPassword.tsxのメールリンク経由とは別の入り口）。updateUserは
  // セッションさえあれば現パスワードなしで更新できてしまうため、現在のパスワードでの
  // 再サインインを必須にしてから更新する（なりすまし対策）
  const handleChangePassword = async (currentPassword: string, newPassword: string): Promise<string | null> => {
    const email = session?.user.email;
    if (!email) return 'ログイン情報を確認できませんでした。再度ログインし直してください。';

    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthError) return '現在のパスワードが正しくありません。';

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) return updateError.message;

    return null;
  };

  // 退会（アカウント削除）。anonキーではauth.usersを直接削除できないため、security
  // definer関数`delete_own_account()`をRPC経由で呼ぶ。実行前に現在のパスワードで
  // 本人確認し、削除後はsignOutAfterAccountDeletionでセッションをクリアする
  const handleDeleteAccount = async (password: string): Promise<string | null> => {
    const email = session?.user.email;
    if (!email) return 'ログイン情報を確認できませんでした。再度ログインし直してください。';

    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password });
    if (reauthError) return 'パスワードが正しくありません。';

    const { error: rpcError } = await supabase.rpc('delete_own_account');
    if (rpcError) return '削除に失敗しました: ' + rpcError.message;

    await signOutAfterAccountDeletion();
    return null;
  };

  // ログアウト。誤タップ防止に確認ダイアログを挟む。ゲスト（匿名）アカウントの場合は
  // 先にdelete_own_account()でデモデータごと削除してからサインアウトする
  // （匿名アカウントがDBに溜まり続けるのを防ぐため）
  const handleLogout = async () => {
    if (!window.confirm('ログアウトしますか？')) return;
    if (session?.user.is_anonymous) {
      const { error } = await supabase.rpc('delete_own_account');
      if (error) console.error('ゲストデータの削除に失敗しました:', error);
      await signOutAfterAccountDeletion();
      return;
    }
    await supabase.auth.signOut();
  };

  return {
    session,
    authLoading,
    isPasswordRecovery,
    setIsPasswordRecovery,
    isAuthenticated,
    currentUserId,
    handleChangePassword,
    handleDeleteAccount,
    handleLogout,
  };
}
