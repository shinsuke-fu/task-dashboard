/**
 * src/components/settings/ProfileSection.tsx
 * 設定ページ最上部の「プロフィール」セクション。アバター画像・表示名・パスワードという
 * 3つの独立した非同期処理（それぞれ保存中/成功/失敗の状態を持つ）をまとめて扱う。
 */
import React, { useEffect, useRef, useState } from 'react';
import { ImageLightbox } from '../ImageLightbox';

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

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [isAvatarPreviewOpen, setIsAvatarPreviewOpen] = useState(false);

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
    <>
    <div className="bg-card border border-border-card rounded-xl p-5 md:p-6 shadow-xs space-y-6">
      <label className="block text-[10px] font-black text-text-sub uppercase">プロフィール</label>

      <div className="flex items-center gap-4">
        {/* コンテナと<img>両方にw-14/h-14を固定指定。親依存のサイズだと画像の実サイズで
            正円が崩れる不具合（Safari等）があるため、px固定にして左右されないようにしている */}
        <button
          type="button"
          onClick={() => { if (avatarUrl) setIsAvatarPreviewOpen(true); }}
          className={`w-14 h-14 rounded-full bg-base border border-border-card flex items-center justify-center font-bold text-sm text-text-sub flex-shrink-0 min-w-0 overflow-hidden ${avatarUrl ? 'cursor-pointer' : 'cursor-default'}`}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-14 h-14 object-cover" />
          ) : (
            displayName.slice(0, 2)
          )}
        </button>
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
            className="h-9 px-4 bg-accent/10 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed text-accent hover:text-on-accent font-bold text-[11px] rounded-lg transition cursor-pointer border border-accent/20 flex-shrink-0"
          >
            {nameSaving ? '保存中…' : '保存'}
          </button>
        </div>
        {nameMessage && <p className="text-[10px] text-text-sub mt-1.5">{nameMessage}</p>}
      </div>

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
            className="h-9 px-4 bg-accent/10 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed text-accent hover:text-on-accent font-bold text-[11px] rounded-lg transition cursor-pointer border border-accent/20"
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
    {isAvatarPreviewOpen && avatarUrl && (
      <ImageLightbox
        src={avatarUrl}
        alt={displayName}
        onClose={() => setIsAvatarPreviewOpen(false)}
      />
    )}
    </>
  );
};
