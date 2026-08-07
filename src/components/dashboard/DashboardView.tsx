// src/components/dashboard/DashboardView.tsx
import React, { useState, useMemo } from 'react';
import { KpiCards } from './KpiCards'; // 独立コンポーネントのみを使用
import { ProgressChart } from './ProgressChart';
import { GanttChart } from './GanttChart';
import type { Task, User } from '../../types/task';

interface DashboardViewProps {
  tasks: Task[];
  users: User[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ tasks, users }) => {
  // クエリ・カスタマイズ用のState管理
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // ユニークなカテゴリー一覧を動的に抽出
  const categories = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => { if (t.category) set.add(t.category); });
    return Array.from(set);
  }, [tasks]);

  // フィルタリングのコアロジック（個人・複数人・カテゴリ対応）
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // 担当者フィルター
      const matchUser = selectedUser === 'all' || 
        task.assignees?.some(a => a === selectedUser || users.find(u => u.id === selectedUser)?.name === a);
      
      // カテゴリーフィルター
      const matchCategory = selectedCategory === 'all' || task.category === selectedCategory;
      
      return matchUser && matchCategory;
    });
  }, [tasks, selectedUser, selectedCategory, users]);

  return (
    <div className="space-y-6 md:space-y-7">
      
      {/* ＝ 🎛️ HIGH-FUNCTIONAL FILTER BAR (個人・複数人の分析カスタマイズエリア) ＝ */}
      <div className="bg-card border border-border-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs select-none">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-3.5 bg-accent rounded-full" />
          <span className="text-xs font-black tracking-wider text-text-main uppercase">Analytics Filter</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* 担当者セレクト */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-sub font-bold uppercase tracking-wider">Member:</span>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="bg-surface border border-border-card text-text-main text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-accent/50 cursor-pointer min-w-32 transition-colors"
            >
              <option value="all">チーム全体 (ALL)</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* カテゴリーセレクト */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-sub font-bold uppercase tracking-wider">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-surface border border-border-card text-text-main text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-accent/50 cursor-pointer min-w-28 transition-colors"
            >
              <option value="all">全カテゴリ</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ＝ KPI SUMMARY CARDS (古い直書きコードを完全消去し、子コンポーネントに一本化) ＝ */}
      <KpiCards filteredTasks={filteredTasks} totalTasksCount={tasks.length} />

      {/* ＝ VISUALIZATION GRIDS ＝ */}
      <ProgressChart tasks={filteredTasks} users={users} />

      {/* ＝ TIMELINE MATRIX ＝ */}
      <GanttChart tasks={filteredTasks} users={users} />
      
    </div>
  );
};
