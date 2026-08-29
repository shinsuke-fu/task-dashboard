/**
 * src/components/settings/DangerZoneSection.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   設定画面の「データ」タブ最下部に置く、退会（アカウント削除）機能。
 *   取り返しがつかない操作のため、他の破壊的操作（タスク削除・サンプル
 *   データリセット）よりもさらに一段階、安全策を重ねている：
 *     1. パスワード入力欄が空の間はボタン自体をdisabledにする
 *     2. ボタン押下時にwindow.confirmで最終確認
 *     3. 実際の削除処理（App.tsx側）に進む前に、入力されたパスワードで
 *        本人確認（signInWithPassword）してから実行する
 *
 * 【実処理について】
 *   Supabaseの匿名/anonキーからは他ユーザーはもちろん自分自身の
 *   auth.usersレコードも直接は削除できない（管理者権限が必要）ため、
 *   `security definer`のPostgres関数`delete_own_account()`をRPC経由で
 *   呼び出す方式にしている（supabase-migration-account-deletion.sql参照）。
 *   この関数側で「自分1人だけがオーナーのプロジェクトの削除」「自分が作成した
 *   タスクの削除」「自分がreviewerに設定されている他人のタスクのreviewer_id解除」
 *   「auth.usersからの削除（profilesへのカスケードも含む）」までまとめて行う。
 *
 * 【ステップ7：オーナー引き継ぎとの関係】
 *   このコンポーネントは、自分がオーナーかつ他にもメンバーがいるプロジェクトが
 *   0件のときだけ表示される（1件以上ある場合はSettingsView.tsx側の分岐で
 *   OwnershipHandoverSection.tsxに差し替わる）。そのため、ここでの退会実行時に
 *   巻き込まれるオーナープロジェクトは「自分1人だけ」のものだけで済む
 * -----------------------------------------------------------------------
 */
import React, { useState } from 'react';

interface DangerZoneSectionProps {
  onDeleteAccount: (password: string) => Promise<string | null>;
}

export const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({ onDeleteAccount }) => {
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDelete = async () => {
    setErrorMessage(null);

    const confirmed = window.confirm(
      '本当にアカウントを削除しますか？\n\n' +
      'あなたが作成したタスク・プロフィール・ログイン情報がすべて削除され、元に戻すことはできません。\n' +
      'また、あなたが1人だけでオーナーを務めているプロジェクトは、タスクごと削除されます。'
    );
    if (!confirmed) return;

    setDeleting(true);
    const error = await onDeleteAccount(password);
    setDeleting(false);

    if (error) {
      setErrorMessage(error);
    }
    // 成功時はApp.tsx側でサインアウトされ、自動的にログイン画面に遷移するため
    // ここで追加の状態更新は不要
  };

  return (
    <div className="bg-card border border-rose-500/20 rounded-xl p-5 md:p-6 shadow-xs mt-6">
      <label className="block text-[10px] font-black text-rose-400 uppercase mb-3">退会（アカウント削除）</label>
      <p className="text-[10px] text-text-sub mb-3 leading-relaxed">
        アカウントとあなたが作成したタスク・プロフィールをすべて削除します。あなたが1人だけで
        オーナーを務めているプロジェクトも、タスクごと削除されます。この操作は元に戻せません。
      </p>
      <div className="flex flex-col sm:flex-row gap-2 max-w-sm">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="確認のため、パスワードを入力"
          className="w-full h-9 px-3 rounded-lg border border-border-card bg-base text-xs text-text-main focus:outline-none focus:border-rose-400 transition"
        />
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting || !password}
          className="h-9 px-4 bg-rose-500/10 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-rose-400 hover:text-white font-bold text-[11px] rounded-lg transition cursor-pointer border border-rose-500/20 flex-shrink-0 whitespace-nowrap"
        >
          {deleting ? '削除中…' : 'アカウントを削除する'}
        </button>
      </div>
      {errorMessage && <p className="text-[10px] text-rose-400 mt-2">{errorMessage}</p>}
    </div>
  );
};
