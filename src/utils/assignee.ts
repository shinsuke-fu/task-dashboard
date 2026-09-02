/**
 * src/utils/assignee.ts
 * 担当者（assignee）まわりの処理を集約した共通ユーティリティ。DashboardView /
 * KanbanBoard / ScheduleViewに重複していたロジックを一本化したもの。
 */
import type { Task, User } from '../types/task';

/**
 * 担当者の参照文字列（User.idまたはUser.name）から、画面表示用の名前を解決する。
 */
export function resolveAssigneeName(assigneeRef: string, users: User[]): string {
  const found = users.find((u) => u.id === assigneeRef || u.name === assigneeRef);
  return found ? found.name : assigneeRef;
}

/**
 * グローバル操作フィルターバー（担当者・カテゴリ・優先度）に基づくタスク絞り込み。
 * 過去データ形式（assigneesにIDではなく名前文字列が入っているケース）への後方互換
 * フォールバックも維持している。
 */
export function filterTasks(
  tasks: Task[],
  filterUser: string,
  filterCategory: string,
  filterPriority: string
): Task[] {
  return tasks.filter((task) => {
    if (!task.assignees) return filterUser === 'all';

    const matchesUser =
      filterUser === 'all' ||
      task.assignees.some((a) => {
        if (a === filterUser) return true;
        if (filterUser === 'u1' && a === '自分（作業者）') return true;
        if (filterUser === 'u2' && a === '山田（開発）') return true;
        if (filterUser === 'u3' && a === '佐藤（上司・レビュアー）') return true;
        return false;
      });

    const matchesCategory = filterCategory === 'all' || task.category === filterCategory;
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    return matchesUser && matchesCategory && matchesPriority;
  });
}
