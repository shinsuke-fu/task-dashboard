// src/components/dashboard/DashboardView.tsx
import React, { useMemo } from 'react';
import { KpiCards } from './KpiCards';
import { ProgressChart } from './ProgressChart';
import { GanttChart } from './GanttChart';
import type { Task, User } from '../../types/task';

interface DashboardViewProps {
  tasks: Task[]; // 親から直通した大元の生のタスク配列
  users: User[];
  filterUser: string; // 💡 追加：親の共通バーの選択状態
  filterCategory: string; // 💡 追加：親の共通バーの選択状態
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
  tasks, 
  users, 
  filterUser, 
  filterCategory 
}) => {

  // 💡 【バグ・重複の完全破壊】親の共通バーと100%リアルタイム連動するフィルタリング
  const displayTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.assignees) return filterUser === 'all';
      
      const matchesUser = filterUser === 'all' || task.assignees.some(a => {
        if (a === filterUser) return true;
        if (filterUser === 'u1' && a === '自分（作業者）') return true;
        if (filterUser === 'u2' && a === '山田（開発）') return true;
        if (filterUser === 'u3' && a === '佐藤（上司・レビュアー）') return true;
        return false;
      });

      const matchesCategory = filterCategory === 'all' || task.category === filterCategory;
      return matchesUser && matchesCategory;
    });
  }, [tasks, filterUser, filterCategory]);

  return (
    <div className="space-y-6 md:space-y-7">
      
      {/* 重複していた独自の高機能フィルターバーは完全撤去済み */}

      {/* ＝ KPI SUMMARY CARDS ＝ */}
      {/* 絞り込まれた displayTasks と、全タスク件数カウンター用の tasks をバインド */}
      <KpiCards filteredTasks={displayTasks} totalTasksCount={tasks.length} />

      {/* ＝ VISUALIZATION GRIDS ＝ */}
      <ProgressChart tasks={displayTasks} users={users} />

      {/* ＝ TIMELINE MATRIX ＝ */}
      <GanttChart tasks={displayTasks} users={users} />
      
    </div>
  );
};
