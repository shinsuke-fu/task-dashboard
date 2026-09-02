/**
 * src/components/UserPicker.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   ユーザーを検索しながら選択する共通コンボボックス部品。TaskForm.tsxの
 *   作業担当者（複数選択）・確認者（単一選択）で使う（担当者・確認者選択の
 *   UI/UX再設計。2026-09-02、feature/assignee-reviewer-picker）。
 *   人数が増えるとチェックボックス列挙・ネイティブ<select>では選びにくく
 *   なるという指摘を受け、入力しながら絞り込む方式に変更した。
 *
 * 【主な処理】
 *   1. 検索入力欄に文字を入力すると、name（部分一致・大文字小文字を区別しない）で
 *      候補を絞り込んでドロップダウン表示する
 *   2. 候補をクリックすると選択に追加する。multiモードは連続して複数選べるよう
 *      ドロップダウンを開いたままにし、singleモードは1人選ぶと自動的に閉じる
 *   3. 選択済みユーザーはアバター付きのタグとして表示し、×クリックで解除できる
 *      （アバターの見た目はMemberManagementModal.tsxと同じパターンを踏襲）
 *   4. ドロップダウンの外側をクリックすると閉じる（App.tsxの通知ドロップダウンと
 *      同じ「外側クリックで閉じる」パターンを使用）
 *
 * 【あえて持たせていないロジック】
 *   「最低1人は必須」「担当者と確認者は重複できない」等の業務ルールは、この部品を
 *   複数箇所で使い回せるよう、あえて持たせていない。呼び出し側（TaskForm.tsx）の
 *   onChangeラッパーで担保すること。
 * -----------------------------------------------------------------------
 */
import { useState, useRef, useEffect } from 'react';
import type { User } from '../types/task';

interface UserPickerProps {
  mode: 'multi' | 'single';
  users: User[]; // 選択候補（呼び出し側でプロジェクトメンバー等に絞り込み済みのものを渡す）
  value: string[]; // 選択中のuser id。singleモードでも配列で統一し、0〜1件を表す
  onChange: (ids: string[]) => void;
  placeholder?: string;
  emptyMessage?: string; // 候補が0件のときにドロップダウンへ表示する案内文
}

export default function UserPicker({
  mode,
  users,
  value,
  onChange,
  placeholder = 'ユーザーを検索...',
  emptyMessage = '候補がいません',
}: UserPickerProps) {
  const [searchText, setSearchText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる（App.tsxの通知ドロップダウンと同じパターン）
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedUsers = value
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is User => !!u);
  const selectedIds = new Set(value);

  // 検索テキストで絞り込み（部分一致・大文字小文字を区別しない）。選択済みは候補から除外する
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredCandidates = users.filter(
    (u) => !selectedIds.has(u.id) && (normalizedSearch === '' || u.name.toLowerCase().includes(normalizedSearch))
  );

  const handleSelect = (userId: string) => {
    if (mode === 'single') {
      onChange([userId]);
      setSearchText('');
      setIsOpen(false);
    } else {
      onChange([...value, userId]);
      setSearchText('');
    }
  };

  const handleRemove = (userId: string) => {
    onChange(value.filter((id) => id !== userId));
  };

  const renderAvatar = (user: User) => (
    <span className="w-5 h-5 rounded-full bg-border-card flex items-center justify-center font-bold text-[8px] text-text-main flex-shrink-0 overflow-hidden">
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.name} className="w-5 h-5 object-cover" />
      ) : (
        user.name.slice(0, 2)
      )}
    </span>
  );

  // singleモードで既に1人選択済みのときは、検索欄の代わりに「変更する」ボタンだけ出す
  // （選び直したくなったらクリックして検索欄を出す）
  const showSearchInput = mode === 'multi' || selectedUsers.length === 0 || isOpen;

  return (
    <div ref={containerRef} className="relative">
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {selectedUsers.map((user) => (
            <span
              key={user.id}
              className="flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-full border bg-accent/10 border-accent/40 text-accent text-[11px] font-bold"
            >
              {renderAvatar(user)}
              {user.name}
              <button
                type="button"
                onClick={() => handleRemove(user.id)}
                aria-label={`${user.name}を解除`}
                className="text-accent/70 hover:text-accent cursor-pointer leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {showSearchInput ? (
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            // Escapeキーでドロップダウンを閉じる（フォーム全体の送信には影響させない）
            if (e.key === 'Escape') setIsOpen(false);
          }}
          placeholder={placeholder}
          className="w-full h-9 bg-base border border-border-card rounded-xl px-3 text-text-main focus:outline-none focus:border-accent"
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="h-8 px-3 rounded-lg border border-border-card text-[10px] font-bold text-text-sub hover:text-accent hover:border-accent/40 transition cursor-pointer"
        >
          変更する
        </button>
      )}

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto bg-card border border-border-card rounded-xl shadow-lg py-1">
          {filteredCandidates.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-text-sub font-medium">{emptyMessage}</p>
          ) : (
            filteredCandidates.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelect(user.id)}
                className="w-full flex items-center gap-2 px-3 h-8 hover:bg-accent/10 transition text-left cursor-pointer"
              >
                {renderAvatar(user)}
                <span className="text-[11px] font-bold text-text-main truncate">{user.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
