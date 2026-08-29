/**
 * src/utils/date.test.ts
 * -----------------------------------------------------------------------
 * 【役割】
 *   date.tsのユニットテスト。特にgetDaysDiffFromTodayは、実行環境の
 *   タイムゾーンによって結果がズレると期日超過（isOverdue）の判定自体が
 *   狂うため、「今日」を固定した上で境界値（今日・未来・過去・年またぎ）を
 *   確認する。
 * -----------------------------------------------------------------------
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getDaysDiffFromToday, getTodayJstDateString } from './date';

describe('getDaysDiffFromToday', () => {
  beforeEach(() => {
    // 「今日」を 2026-08-29 12:00 JST（= 2026-08-29T03:00:00Z）に固定する
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T03:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('今日の日付を渡すと0になる', () => {
    expect(getDaysDiffFromToday('2026-08-29')).toBe(0);
  });

  it('未来の日付を渡すと正の日数になる', () => {
    expect(getDaysDiffFromToday('2026-09-03')).toBe(5);
  });

  it('過去の日付（期日超過）を渡すと負の日数になる', () => {
    expect(getDaysDiffFromToday('2026-08-20')).toBe(-9);
  });

  it('年をまたぐ日付でも正しく計算できる', () => {
    // このテスト自身が「production側と同じ計算式」にならないよう、
    // 期待値はDate.UTCの単純な差分から独立に算出する
    const expected = Math.round(
      (Date.UTC(2027, 0, 1) - Date.UTC(2026, 7, 29)) / (1000 * 60 * 60 * 24)
    );
    expect(getDaysDiffFromToday('2027-01-01')).toBe(expected);
  });
});

describe('getTodayJstDateString', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('UTCでは日付が変わっていても、JST基準の日付を返す（日本時間の朝9時=UTC前日深夜0時のケース）', () => {
    // UTC 2026-08-28T15:30:00Z は JSTでは 2026-08-29T00:30 なので、
    // JST基準では既に29日になっているはず
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T15:30:00Z'));
    expect(getTodayJstDateString()).toBe('2026-08-29');
  });
});
