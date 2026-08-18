/**
 * src/components/RejectReasonModal.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   カンバンで「査読・承認待ち(review)」のタスクを差し戻す際に、
 *   その場で理由を自由入力できるモーダル。isOpen=trueの間だけ描画される。
 *
 * 【主な処理】
 *   1. isOpenがtrueになるたびに入力欄をリセット
 *   2. 送信時、理由が未入力ならデフォルト文言で補完してonSubmitへ渡す
 *      （実際のタスク更新処理はApp.tsx側のhandleConfirmRejectが担当）
 * -----------------------------------------------------------------------
 */
import React, { useState, useEffect } from 'react';

interface RejectReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export const RejectReasonModal: React.FC<RejectReasonModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(reason.trim() || '要修正項目があります。');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-card border border-border-card rounded-2xl p-5 space-y-4 shadow-2xl select-none">
        <div>
          <h3 className="font-extrabold text-xs tracking-wider text-rose-400 uppercase flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            差し戻し理由の記入
          </h3>
          <p className="text-[10px] text-text-sub font-medium mt-1">修正が必要な要件やフィードバックを入力してください。</p>
        </div>

        <div>
          <textarea
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例：デザインガイドラインに沿った余白調整をお願いします。"
            rows={3}
            className="w-full bg-base border border-border-card rounded-xl p-3 text-xs text-text-main focus:outline-none focus:border-rose-500/50 placeholder-text-sub/40 resize-none leading-relaxed"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1 border-t border-border-card/40">
          <button type="button" onClick={onClose} className="h-8 px-3.5 bg-surface hover:bg-base text-text-sub font-bold text-[11px] rounded-lg transition border border-border-card/40 cursor-pointer">
            キャンセル
          </button>
          <button type="submit" className="h-8 px-4 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[11px] rounded-lg shadow-md cursor-pointer transition">
            差し戻しを確定
          </button>
        </div>
      </form>
    </div>
  );
};
