/**
 * src/components/settings/DangerZoneSection.tsx
 * 設定画面の「データ」タブ最下部にある退会（アカウント削除）機能。パスワード入力＋
 * window.confirmの二重確認の後、`security definer`のPostgres関数`delete_own_account()`
 * をRPC経由で呼び出す（Supabaseのanonキーでは自分自身のauth.usersも直接削除できないため）。
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
