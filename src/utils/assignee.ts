/**
 * src/utils/assignee.ts
 * -----------------------------------------------------------------------
 * 【役割】
 *   担当者（assignee）まわりの処理を集約した共通ユーティリティ。
 *   DashboardView / KanbanBoard / GanttChart / ProgressChart に
 *   重複していたロジックを一本化したもので、挙動は元のインライン実装
 *   から一切変更していない（引き算リファクタのみ）。
 *
 * 【主な処理】
 *   1. resolveAssigneeName          … 担当者ID/名前 → 表示名の解決
 *   2. filterTasksByUserAndCategory … 担当者・カテゴリでのタスク絞り込み
 * -----------------------------------------------------------------------
 */
import type { Task, User } from '../types/task';

/**
 * 担当者の参照文字列（User.id または User.name のいずれか）から、
 * 画面表示用の名前を解決する。
 * 元々 GanttChart.getAssigneeNames と ProgressChart の集計ループに
 * ほぼ同一のロジックが重複していたため共通化。
 */
export function resolveAssigneeName(assigneeRef: string, users: User[]): string {
  const found = users.find((u) => u.id === assigneeRef || u.name === assigneeRef);
  return found ? found.name : assigneeRef;
}

/**
 * グローバル操作フィルターバー（担当者・カテゴリ）に基づくタスク絞り込み。
 * 元々 DashboardView と KanbanBoard の useMemo 内に完全に同一のロジックが
 * 重複していたため共通化。
 * ※ 過去データ形式（assignees に ID ではなく名前文字列が入っているケース）への
 *   後方互換フォールバックも既存仕様のまま維持。
 */
export function filterTasksByUserAndCategory(
  tasks: Task[],
  filterUser: string,
  filterCategory: string
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
    return matchesUser && matchesCategory;
  });
}
