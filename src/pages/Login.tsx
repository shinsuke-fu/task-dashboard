import React, { useState } from 'react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      onLoginSuccess(); // 親(App.tsx)の状態をログイン済みに変更
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-900 bg-zinc-900/30 p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col items-center justify-center text-center mb-8">
          <div className="h-9 w-9 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-center mb-3">
            <div className="h-3 w-3 rounded-sm bg-white" />
          </div>
          <h2 className="text-sm font-medium text-zinc-200">プロジェクトダッシュボード</h2>
          <p className="mt-1 text-xs text-zinc-500">マットダーク仕様の統合認証</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-zinc-950/60 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700/50 transition-all font-mono"
              placeholder="name@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-zinc-800 bg-zinc-950/60 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700/50 transition-all font-mono"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full h-9 mt-2 bg-zinc-200 hover:bg-white text-zinc-950 text-xs font-medium rounded-lg transition-all active:scale-[0.99]"
          >
            サインイン
          </button>
        </form>
      </div>
    </div>
  );
};
