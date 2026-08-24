/**
 * src/utils/assignee.ts
 * -----------------------------------------------------------------------
 * 【役割】
 *   担当者（assignee）まわりの処理を集約した共通ユーティリティ。
 *   DashboardView / KanbanBoard / ScheduleView に重複していたロジックを
 *   一本化したもの。
 *
 * 【主な処理】
 *   1. resolveAssigneeName … 担当者ID/名前 → 表示名の解決
 *   2. filterTasks         … グローバル操作フィルターバー（担当者・カテゴリ・
 *      優先度）に基づくタスク絞り込み。2026-08-22に優先度フィルターを追加した際、
 *      それまでの`filterTasksByUserAndCategory`という名前が実態と合わなくなった
 *      ため`filterTasks`に改名した（担当者・カテゴリの2軸だけの絞り込み関数
 *      ではなくなったため）
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
 * グローバル操作フィルターバー（担当者・カテゴリ・優先度）に基づくタスク絞り込み。
 * 元々 DashboardView と KanbanBoard の useMemo 内に完全に同一のロジックが
 * 重複していたため共通化。
 * ※ 過去データ形式（assignees に ID ではなく名前文字列が入っているケース）への
 *   後方互換フォールバックも既存仕様のまま維持。
 * ※ task.assignees が無い（不正データ等の）場合の早期returnは、従来
 *   filterUserの一致だけで判定していた挙動をそのまま維持している
 *   （filterCategory・filterPriorityはこの分岐では見ない）。
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
