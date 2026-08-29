/**
 * src/components/project/ProjectFormModal.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   プロジェクトの新規作成・編集を行うモーダルフォーム。isOpen=trueの間だけ
 *   描画され、editingProjectの有無で「新規作成」「編集」の両モードを兼ねる
 *   （TaskForm.tsxと同じ構造・作法に揃えている）。
 *
 * 【主な処理】
 *   1. isOpenがtrueになった瞬間にフォーム項目を初期化（新規 or 編集内容）
 *   2. 入力項目はプロジェクト名（必須）／説明（任意）／ステータス
 *      （進行中・完了・アーカイブの3値。プロジェクト管理機能_要件定義書.md §2.2）
 *   3. 送信時にonSubmitを呼び出し、実際のSupabaseへの保存はApp.tsx側に委譲する
 * -----------------------------------------------------------------------
 */
import { useState, useEffect } from 'react';
import type { Project, ProjectStatus } from '../../types/task';

interface ProjectFormModalProps {
  isOpen: boolean;
  editingProject?: Project;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string; status: ProjectStatus }) => void;
}

export default function ProjectFormModal({ isOpen, editingProject, onClose, onSubmit }: ProjectFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');

  // isOpenが「trueになった瞬間」だけ初期化する（TaskForm.tsxと同じ理由：
  // 編集中の中途半端な上書きループを防ぐため、依存配列はisOpenのみに絞る）
  useEffect(() => {
    if (!isOpen) return;

    if (editingProject) {
      setName(editingProject.name);
      setDescription(editingProject.description || '');
      setStatus(editingProject.status);
    } else {
      setName('');
      setDescription('');
      setStatus('active');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() ? description.trim() : undefined,
      status,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <form onSubmit={handleSubmit} className="w-full max-w-lg bg-card border border-border-card rounded-2xl p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* ヘッダー */}
        <div className="flex items-center justify-between pb-2 border-b border-border-card/40">
          <h3 className="font-extrabold text-xs tracking-wider text-text-main">
            {editingProject ? 'プロジェクトを編集' : '新しいプロジェクトを作成'}
          </h3>
        </div>

        <div className="space-y-4 text-xs">
          {/* プロジェクト名入力 */}
          <div>
            <label className="block text-[10px] font-black text-text-sub uppercase mb-1">プロジェクト名</label>
            <input
              type="text"
              placeholder="例：コーポレートサイトリニューアル"
              value={name}
              onChange={(e) => setName(e.target.value)}
              // ブラウザの自動入力候補（オートコンプリート）を出さないようにする。過去に保存された
              // 別表記（全角/半角違い等）の候補を選んでしまい、意図と異なる表記で保存される
              // 事故を避けるための予防策（ユーザー報告：2026-08-29）
              autoComplete="off"
              className="w-full h-10 bg-base border border-border-card rounded-xl px-4 text-text-main focus:outline-none focus:border-accent"
              required
            />
          </div>

          {/* 説明入力 */}
          <div>
            <label className="block text-[10px] font-black text-text-sub uppercase mb-1">説明（任意）</label>
            <textarea
              placeholder="プロジェクトの概要やメモ..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-base border border-border-card rounded-xl p-3 text-text-main focus:outline-none focus:border-accent resize-none leading-relaxed"
            />
          </div>

          {/* ステータス選択 */}
          <div>
            <label className="block text-[10px] font-black text-text-sub uppercase mb-1">ステータス</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="w-full h-9 bg-base border border-border-card rounded-xl px-2 font-bold text-text-main cursor-pointer"
            >
              <option value="active">進行中</option>
              <option value="completed">完了</option>
              <option value="archived">アーカイブ</option>
            </select>
            <p className="text-[10px] text-text-sub mt-1.5 pl-1 font-medium">
              ※「アーカイブ」にすると、サイドバーや一覧のデフォルト表示から隠れます
              （一覧の「アーカイブ済みを表示」から確認できます）。
            </p>
          </div>
        </div>

        {/* 下部アクションボタン */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border-card/30">
          <button type="button" onClick={onClose} className="h-9 px-4 bg-surface hover:bg-base text-text-sub font-bold text-xs rounded-xl cursor-pointer border border-border-card/50 transition">
            キャンセル
          </button>
          <button type="submit" className="h-9 px-5 bg-accent hover:bg-accent/90 text-on-accent font-black text-xs rounded-xl cursor-pointer shadow-md">
            {editingProject ? '変更を保存' : 'プロジェクトを作成'}
          </button>
        </div>
      </form>
    </div>
  );
}
