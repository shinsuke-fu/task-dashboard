/**
 * src/components/kanban/TaskCard.test.tsx
 * -----------------------------------------------------------------------
 * 【役割】
 *   TaskCard.tsxの回帰テスト。特に規約.md③「遅延最優先ルール」――期日超過
 *   タスクは、他のどの状態（差し戻し中・査読待ち等）よりも優先して
 *   遅延表示（赤枠）を適用しなければならない、という絶対厳守ルールが
 *   壊れていないかを確認する。
 *
 * 【テストの狙い】
 *   「差し戻し中（doing・差し戻し理由あり）」かつ「期日超過」の両方に
 *   該当するタスクは、isRejectedとisOverdueが両方trueになる。この場合に
 *   差し戻し用の枠線ではなく、遅延（最優先）の枠線が適用されることを
 *   確認することで、if/else ifの優先順位が将来のリファクタで
 *   入れ替わってしまう事故を検知できるようにする。
 * -----------------------------------------------------------------------
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskCard } from './TaskCard';
import type { Task } from '../../types/task';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
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

const noop = () => {
  /* テスト用の何もしないコールバック */
};

describe('TaskCard - 規約③ 遅延最優先ルール', () => {
  beforeEach(() => {
    // 「今日」を2026-08-29に固定する
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T03:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('差し戻し中かつ期日超過の場合、差し戻しではなく遅延の枠線スタイルが優先される', () => {
    const task = makeTask({
      status: 'doing',
      endDate: '2026-08-20', // 今日(08-29)より過去 → 期日超過
      returnReason: '差し戻しテスト理由', // これだけならisRejectedもtrueになる条件
    });

    const { container } = render(
      <TaskCard
        task={task}
        currentUserId="u1"
        onStartEdit={noop}
        onUpdateStatus={noop}
        onProcessAction={noop}
        onTriggerReject={noop}
        onDeleteTask={noop}
      />
    );

    const card = container.firstElementChild as HTMLElement;

    // 遅延（最優先）の枠線クラスが適用されている
    expect(card.className).toContain('border-rose-600/80');
    // 差し戻し専用の枠線クラスには上書きされていない
    expect(card.className).not.toContain('border-rose-500/50');
    // 遅延バッジも表示されている
    expect(screen.getByText('遅延')).toBeInTheDocument();
  });

  it('期日間近（3日以内）だが超過はしていない場合は、期日間近バッジが表示される', () => {
    const task = makeTask({
      status: 'todo',
      endDate: '2026-08-31', // 今日(08-29)から2日後
    });

    render(
      <TaskCard
        task={task}
        currentUserId="u1"
        onStartEdit={noop}
        onUpdateStatus={noop}
        onProcessAction={noop}
        onTriggerReject={noop}
        onDeleteTask={noop}
      />
    );

    expect(screen.getByText('残り 2 日')).toBeInTheDocument();
    expect(screen.queryByText('遅延')).not.toBeInTheDocument();
  });
});
