/**
 * src/components/settings/AboutSection.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   設定画面の「アプリについて」タブ。アプリ名・バージョン・技術スタック・
 *   主な機能・リポジトリ/本番サイトへのリンクをまとめた簡易的な紹介カード。
 *   社内の共有会等でこのアプリを軽く紹介する際に、画面をそのまま見せれば
 *   説明が済むようにする目的で用意している（値はsrc/constants/app.tsに集約）。
 *
 * 【主な処理】
 *   表示内容（バージョン・紹介文・技術スタック・機能一覧・公開URL等）は
 *   すべてsrc/constants/app.tsの定数を参照するだけで、このファイル自体に
 *   ロジックはほぼ無い。公開URLは動的取得（window.location.origin）ではなく
 *   固定値にしている（ローカル開発中にこのタブを開くとlocalhost等が
 *   表示されてしまい、共有会等で見せる際に紛らわしいため）。
 * -----------------------------------------------------------------------
 */
import React from 'react';
import { APP_NAME, APP_NAME_JA, APP_TAGLINE, APP_VERSION, GITHUB_REPO_URL, PRODUCTION_URL, TECH_STACK, KEY_FEATURES } from '../../constants/app';

export const AboutSection: React.FC = () => {
  return (
    <div className="bg-card border border-border-card rounded-xl p-5 md:p-6 shadow-xs space-y-6">
      <label className="block text-[10px] font-black text-text-sub uppercase">アプリについて</label>

      {/* ロゴ・アプリ名・バージョン。これはプロフィール画像のようなアバターではなく
          「ブランドロゴ」なので、Sidebar.tsx・Login.tsxのW+ロゴと同じrounded-xl
          （角丸四角）・文字色（黒固定のtext-slate-950）に統一している。ロゴは装飾要素
          として黒固定で問題ない、という判断（可読性を気にする必要があるボタン等の
          文字色は--theme-on-accent。index.css参照） */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-gradient-to-br from-accent to-sky-500 flex items-center justify-center font-black text-base text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.25)] tracking-tighter">
          W+
        </div>
        <div>
          <h3 className="font-extrabold text-sm tracking-wider text-text-main uppercase">{APP_NAME}</h3>
          <p className="text-[10px] text-text-sub font-bold tracking-widest">{APP_NAME_JA} ・ v{APP_VERSION}</p>
        </div>
      </div>

      <p className="text-xs text-text-sub leading-relaxed">{APP_TAGLINE}</p>

      {/* 技術スタック */}
      <div>
        <label className="block text-[10px] font-black text-text-sub uppercase mb-2">技術スタック</label>
        <div className="flex flex-wrap gap-1.5">
          {TECH_STACK.map((tech) => (
            <span
              key={tech}
              className="px-2.5 py-1 rounded-lg bg-base border border-border-card text-[10px] font-bold text-text-main"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* 主な機能 */}
      <div>
        <label className="block text-[10px] font-black text-text-sub uppercase mb-2">主な機能</label>
        <ul className="space-y-1.5">
          {KEY_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-[11px] text-text-sub leading-relaxed">
              <span className="text-accent mt-0.5 flex-shrink-0">・</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* リンク */}
      <div>
        <label className="block text-[10px] font-black text-text-sub uppercase mb-2">リンク</label>
        <div className="flex flex-col gap-1.5">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-accent hover:underline break-all"
          >
            GitHubリポジトリ：{GITHUB_REPO_URL}
          </a>
          <a
            href={PRODUCTION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-accent hover:underline break-all"
          >
            公開URL：{PRODUCTION_URL}
          </a>
        </div>
      </div>
    </div>
  );
};
