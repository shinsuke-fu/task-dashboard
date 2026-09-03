/**
 * src/hooks/useTaskFilters.ts
 * グローバル操作フィルターバー（担当者・カテゴリ・優先度）の選択状態と、そこから
 * 導出する「抽出件数」「カテゴリ選択肢」をApp.tsxから切り出したフック。画面（タブ）
 * ごとには分けず、全画面共通のフィルターとして扱う方針は従来通り。
 */
import { useState } from 'react';
import type { Task } from '../types/task';

export function useTaskFilters(tasks: Task[]) {
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // フィルターバー右側に表示する「抽出件数」。担当者・カテゴリ・優先度の条件すべてに一致するタスク数
  const currentFilteredCount = tasks.filter((task) => {
    const matchesUser = filterUser === 'all' || task.assignees.includes(filterUser);
    const matchesCategory = filterCategory === 'all' || task.category === filterCategory;
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    return matchesUser && matchesCategory && matchesPriority;
  }).length;

  // カテゴリ絞り込みドロップダウンの選択肢。実際に使われているカテゴリ値から動的生成
  const availableCategories = Array.from(new Set(tasks.map((t) => t.category).filter(Boolean)));

  return {
    filterUser,
    setFilterUser,
    filterCategory,
    setFilterCategory,
    filterPriority,
    setFilterPriority,
    currentFilteredCount,
    availableCategories,
  };
}
