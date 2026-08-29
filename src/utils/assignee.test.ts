/**
 * src/utils/assignee.test.ts
 * -----------------------------------------------------------------------
 * 【役割】
 *   assignee.tsのユニットテスト。resolveAssigneeName（ID/名前どちらからでも
 *   名前解決できるか）と、filterTasks（担当者・カテゴリ・優先度の絞り込み、
 *   および旧データ形式への後方互換フォールバック）を確認する。
 * -----------------------------------------------------------------------
 */
import { describe, it, expect } from 'vitest';
import { resolveAssigneeName, filterTasks } from './assignee';
import type { Task, User } from '../types/task';

const users: User[] = [
  { id: 'u1', name: '自分（作業者）' },
  { id: 'u2', name: '山田（開発）' },
  { id: 'u3', name: '佐藤（上司・レビュアー）' },
];

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'default-id',
    title: 'テストタスク',
    status: 'todo',
    category: '開発',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    priority: 'medium',
    assignees: ['u1'],
    createdBy: 'u1',
    ...overrides,
  };
}

describe('resolveAssigneeName', () => {
  it('IDが一致すれば名前を返す', () => {
    expect(resolveAssigneeName('u2', users)).toBe('山田（開発）');
  });

  it('名前そのものが渡された場合も名前を返す（後方互換）', () => {
    expect(resolveAssigneeName('山田（開発）', users)).toBe('山田（開発）');
  });

  it('該当するユーザーがいない場合は渡された文字列をそのまま返す', () => {
    expect(resolveAssigneeName('存在しないID', users)).toBe('存在しないID');
  });
});

describe('filterTasks', () => {
  const tasks: Task[] = [
    makeTask({ id: 't1', assignees: ['u1'], category: '開発', priority: 'high' }),
    makeTask({ id: 't2', assignees: ['u2'], category: 'デザイン', priority: 'low' }),
    makeTask({ id: 't3', assignees: ['u1', 'u3'], category: '開発', priority: 'medium' }),
  ];

  it('filterUserが"all"なら全件を返す', () => {
    expect(filterTasks(tasks, 'all', 'all', 'all').map((t) => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('担当者IDで絞り込める', () => {
    expect(filterTasks(tasks, 'u2', 'all', 'all').map((t) => t.id)).toEqual(['t2']);
  });

  it('担当者・カテゴリ・優先度を組み合わせて絞り込める', () => {
    expect(filterTasks(tasks, 'u1', '開発', 'high').map((t) => t.id)).toEqual(['t1']);
  });

  it('旧データ形式（名前文字列がassigneesに入っている）でも一致判定できる', () => {
    const legacyTask = makeTask({ id: 't4', assignees: ['山田（開発）'] });
    expect(filterTasks([legacyTask], 'u2', 'all', 'all').map((t) => t.id)).toEqual(['t4']);
  });

  it('assigneesが無いタスクは、filterUserが"all"のときだけ含まれる', () => {
    const noAssignee = makeTask({ id: 't5', assignees: undefined as unknown as string[] });
    expect(filterTasks([noAssignee], 'all', 'all', 'all').map((t) => t.id)).toEqual(['t5']);
    expect(filterTasks([noAssignee], 'u1', 'all', 'all')).toEqual([]);
  });
});
