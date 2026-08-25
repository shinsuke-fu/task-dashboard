/**
 * src/components/ImageLightbox.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   アバター画像などをクリックしたときに、原寸に近いサイズで画像だけを
 *   全画面表示するための汎用ビューア（X/Instagramのプロフィール画像タップ時の
 *   挙動をイメージしている）。ヘッダーのアバターと、設定ページのプロフィール
 *   アバター（ProfileSection.tsx）の両方から利用する共通コンポーネント。
 *
 * 【主な処理】
 *   - 背景（黒の半透明オーバーレイ）をクリック、右上の閉じるボタンをクリック、
 *     または Escape キーで閉じる
 *   - 画像自体をクリックしても閉じない（`stopPropagation`で背景側のクリックに
 *     伝播させない）
 *   - `position: fixed`のオーバーレイなので、呼び出し元がどんなカード・
 *     コンテナの中にあっても画面全体に正しく重なる
 * -----------------------------------------------------------------------
 */
import React, { useEffect } from 'react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ src, alt, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in cursor-zoom-out"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 md:top-6 md:right-6 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition"
        aria-label="閉じる"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain cursor-default"
      />
    </div>
  );
};
