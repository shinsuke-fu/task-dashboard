/**
 * src/components/dashboard/DashboardView.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   「ダッシュボード」ビューの入れ物。KpiCards / ProgressChart /
 *   GanttChart を縦に並べて表示するだけのコンテナコンポーネント。
 *
 * 【主な処理】
 *   1. App.tsxから受け取ったtasksを、共通フィルター（filterTasks）で
 *      担当者・カテゴリ・優先度を絞り込み、displayTasksとして各子コンポーネントへ配布
 * -----------------------------------------------------------------------
 */
import React, { useMemo } from 'react';
import { KpiCards } from './KpiCards';
import { ProgressChart } from './ProgressChart';
import { GanttChart } from './GanttChart';
import type { Task, User } from '../../types/task';
import { filterTasks } from '../../utils/assignee';

interface DashboardViewProps {
  tasks: Task[];
  users: User[];
  filterUser: string;
  filterCategory: string;
  filterPriority: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  tasks,
  users,
  filterUser,
  filterCategory,
  filterPriority
}) => {

  // 親の共通バーと100%リアルタイム連動するフィルタリング（共通ユーティリティに一本化）
  const displayTasks = useMemo(
    () => filterTasks(tasks, filterUser, filterCategory, filterPriority),
    [tasks, filterUser, filterCategory, filterPriority]
  );

  return (
    <div className="space-y-6 md:space-y-7">
      
      {/* 重複していた独自の高機能フィルターバーは完全撤去済み */}

      {/* ＝ KPI SUMMARY CARDS ＝ */}
      {/* 絞り込まれた displayTasks をバインド（totalTasksCountは未使用のため廃止済み） */}
      <KpiCards filteredTasks={displayTasks} />

      {/* ＝ VISUALIZATION GRIDS ＝ */}
      <ProgressChart tasks={displayTasks} users={users} />

      {/* ＝ TIMELINE MATRIX ＝ */}
      <GanttChart tasks={displayTasks} users={users} />
      
    </div>
  );
};
