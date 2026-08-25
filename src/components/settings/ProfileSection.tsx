/**
 * src/components/settings/ProfileSection.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   設定ページ（SettingsView.tsx）の最上部に表示する「プロフィール」セクション。
 *   アバター画像・表示名・パスワードという、3つの独立した非同期処理
 *   （それぞれ保存中/成功/失敗の状態を持つ）をまとめて扱うため、
 *   SettingsView.tsxから切り出した専用コンポーネントにしている。
 *
 * 【主な処理】
 *   1. アバター画像：ファイル選択→即アップロード。画像ファイルかどうか・
 *      サイズ（2MBまで）をアップロード前にフロント側でチェックする
 *   2. 表示名：入力欄を編集し「保存」ボタンで確定。未入力・変更なしの場合は
 *      ボタンをdisabledにする
 *   3. パスワード変更：現在のパスワード／新しいパスワード／確認の3つを入力。
 *      新しいパスワードが6文字未満、または確認と不一致の場合はフロント側で弾く。
 *      現在のパスワードが正しいかどうかはApp.tsx側（Supabase再サインイン）で検証される
 * -----------------------------------------------------------------------
 */
import React, { useEffect, useRef, useState } from 'react';

interface ProfileSectionProps {
  displayName: string;
  avatarUrl?: string;
  onUpdateDisplayName: (name: string) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
}

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  displayName,
  avatarUrl,
  onUpdateDisplayName,
  onUploadAvatar,
  onChangePassword,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 表示名 ---
  const [nameInput, setNameInput] = useState(displayName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  // 親から渡されるdisplayNameが（他画面での更新等で）変わったら入力欄も追従させる
  useEffect(() => setNameInput(displayName), [displayName]);

  const handleSaveName = async () => {
    setNameMessage(null);
    setNameSaving(true);
    try {
      await onUpdateDisplayName(nameInput);
      setNameMessage('保存しました');
    } catch {
      setNameMessage('保存に失敗しました');
    } finally {
      setNameSaving(false);
    }
  };

  // --- アバター画像 ---
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 同じファイルを連続で選び直しても onChange が発火するようにリセット
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarMessage('画像ファイルを選択してください');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarMessage('画像サイズは2MBまでです');
      return;
    }

    setAvatarMessage(null);
    setAvatarUploading(true);
    try {
      await onUploadAvatar(file);
      setAvatarMessage('画像を更新しました');
    } catch {
      setAvatarMessage('アップロードに失敗しました');
    } finally {
      setAvatarUploading(false);
    }
  };

  // --- パスワード変更 ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleChangePassword = async () => {
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: '新しいパスワードは6文字以上で入力してください。' });
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordMessage({ type: 'error', text: '新しいパスワード（確認）が一致しません。' });
      return;
    }

    setPasswordSaving(true);
    const errorMessage = await onChangePassword(currentPassword, newPassword);
    setPasswordSaving(false);

    if (errorMessage) {
      setPasswordMessage({ type: 'error', text: errorMessage });
      return;
    }
    setPasswordMessage({ type: 'success', text: 'パスワードを変更しました' });
    setCurrentPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
  };

  return (
    <div className="bg-card border border-border-card rounded-xl p-5 md:p-6 shadow-xs space-y-6">
      <label className="block text-[10px] font-black text-text-sub uppercase">プロフィール</label>

      {/* アバター画像 */}
      <div className="flex items-center gap-4">
        {/* w-14 h-14（56px）の正円で固定。<img>にもコンテナと全く同じw-14/h-14を指定しているのは、
            flexコンテナ内で`w-full h-full`のように親依存のサイズ指定にすると、画像の実サイズ
            （特に大きな写真）によってこの要素の自動最小サイズが押し上げられ、正円が崩れて
            巨大化する不具合（Safari等で顕著）があったため。ピクセル固定サイズにすることで
            画像の実サイズに一切左右されないようにしている */}
        <div className="w-14 h-14 rounded-full bg-base border border-border-card flex items-center justify-center font-bold text-sm text-text-sub flex-shrink-0 min-w-0 overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-14 h-14 object-cover" />
          ) : (
            displayName.slice(0, 2)
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="h-8 px-4 bg-base hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed text-text-main text-[11px] font-bold rounded-lg transition cursor-pointer border border-border-card"
          >
            {avatarUploading ? 'アップロード中…' : '画像を変更'}
          </button>
          {avatarMessage && (
            <p className="text-[10px] text-text-sub mt-1.5">{avatarMessage}</p>
          )}
          <p className="text-[9px] text-text-sub mt-1">JPEG/PNG等の画像ファイル、2MBまで</p>
        </div>
      </div>

      {/* 表示名 */}
      <div>
        <label className="block text-[10px] font-black text-text-sub uppercase mb-1.5">表示名</label>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={40}
            className="w-full sm:w-64 h-9 px-3 rounded-lg border border-border-card bg-base text-xs text-text-main focus:outline-none focus:border-accent transition"
          />
          <button
            type="button"
            onClick={handleSaveName}
            disabled={nameSaving || !nameInput.trim() || nameInput.trim() === displayName}
            className="h-9 px-4 bg-accent/10 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed text-accent hover:text-slate-950 font-bold text-[11px] rounded-lg transition cursor-pointer border border-accent/20 flex-shrink-0"
          >
            {nameSaving ? '保存中…' : '保存'}
          </button>
        </div>
        {nameMessage && <p className="text-[10px] text-text-sub mt-1.5">{nameMessage}</p>}
      </div>

      {/* パスワード変更 */}
      <div>
        <label className="block text-[10px] font-black text-text-sub uppercase mb-1.5">パスワードの変更</label>
        <div className="space-y-2 max-w-xs">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="現在のパスワード"
            className="w-full h-9 px-3 rounded-lg border border-border-card bg-base text-xs text-text-main focus:outline-none focus:border-accent transition"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="新しいパスワード"
            className="w-full h-9 px-3 rounded-lg border border-border-card bg-base text-xs text-text-main focus:outline-none focus:border-accent transition"
          />
          <input
            type="password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            placeholder="新しいパスワード（確認）"
            className="w-full h-9 px-3 rounded-lg border border-border-card bg-base text-xs text-text-main focus:outline-none focus:border-accent transition"
          />
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={passwordSaving || !currentPassword || !newPassword || !newPasswordConfirm}
            className="h-9 px-4 bg-accent/10 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed text-accent hover:text-slate-950 font-bold text-[11px] rounded-lg transition cursor-pointer border border-accent/20"
          >
            {passwordSaving ? '変更中…' : 'パスワードを変更する'}
          </button>
          {passwordMessage && (
            <p className={`text-[10px] mt-1 ${passwordMessage.type === 'error' ? 'text-rose-400' : 'text-text-sub'}`}>
              {passwordMessage.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
