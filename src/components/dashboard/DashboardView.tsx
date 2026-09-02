/**
 * src/components/dashboard/DashboardView.tsx
 * 「ダッシュボード」ビューの入れ物。App.tsxから受け取ったtasksを共通フィルター
 * （filterTasks）で絞り込み、KpiCards / ProgressChart / GanttChartへ配布する。
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

  const displayTasks = useMemo(
    () => filterTasks(tasks, filterUser, filterCategory, filterPriority),
    [tasks, filterUser, filterCategory, filterPriority]
  );

  return (
    <div className="space-y-6 md:space-y-7">
      <KpiCards filteredTasks={displayTasks} />
      <ProgressChart tasks={displayTasks} users={users} />
      <GanttChart tasks={displayTasks} users={users} />
    </div>
  );
};
