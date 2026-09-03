/**
 * src/hooks/useUsers.ts
 * 担当者一覧（Supabaseの`profiles`テーブル）の取得と、自分自身のプロフィール更新
 * （表示名・アバター）をまとめて扱うフック。
 */
import { useEffect, useState } from 'react';
import type { User } from '../types/task';
import { supabase } from '../lib/supabaseClient';

export function useUsers(isAuthenticated: boolean, currentUserId: string) {
  // 担当者一覧（Supabaseの`profiles`テーブルから取得）。ログインしていなければ空配列
  const [users, setUsers] = useState<User[]>([]);

  // ログイン状態が変わったら担当者一覧を取得し直す
  useEffect(() => {
    if (!isAuthenticated) {
      setUsers([]);
      return;
    }

    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('担当者一覧の取得に失敗しました:', error);
          return;
        }
        setUsers((data ?? []).map((p) => ({ id: p.id, name: p.display_name, avatarUrl: p.avatar_url ?? undefined })));
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // 表示名を変更する（設定ページのプロフィールセクションから呼ばれる）。
  // profiles.display_nameを更新し、担当者一覧（users）にも即座に反映する
  // （users配列を作り直すためだけにrefreshし直すのは無駄が多いため、ローカルでも更新する）
  const handleUpdateDisplayName = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('profiles').update({ display_name: trimmed }).eq('id', currentUserId);
    if (error) throw error;
    setUsers(prev => prev.map(u => (u.id === currentUserId ? { ...u, name: trimmed } : u)));
  };

  // アバターアップロード。`avatars`バケットへ固定パス（upsert:trueで毎回上書き）で
  // 保存する。同じパスだとCDNキャッシュが残るため、URL末尾にタイムスタンプを付けて
  // キャッシュを回避する
  const handleUploadAvatar = async (file: File) => {
    const path = `${currentUserId}/avatar`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const bustedUrl = `${data.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase.from('profiles').update({ avatar_url: bustedUrl }).eq('id', currentUserId);
    if (updateError) throw updateError;

    setUsers(prev => prev.map(u => (u.id === currentUserId ? { ...u, avatarUrl: bustedUrl } : u)));
  };

  return { users, handleUpdateDisplayName, handleUploadAvatar };
}
