/**
 * src/utils/date.ts
 * 日付まわりの共通処理（「今日」の取得・期日までの残り日数）を、実行環境のタイムゾーンに
 * 左右されず常に同じ結果になるように計算する。
 */

// 実行時点の「今日」をJST（日本時間）基準の YYYY-MM-DD 文字列で取得する
export function getTodayJstDateString(): string {
  return new Date()
    .toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\//g, '-');
}

function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

// 期日文字列(YYYY-MM-DD)と「今日」(JST基準)との差分日数を計算する。
// 0以上なら残り日数、マイナスなら期日超過（遅延）を表す。
export function getDaysDiffFromToday(dateStr: string): number {
  const today = parseDateString(getTodayJstDateString());
  const target = parseDateString(dateStr);

  // 時刻情報を持たない「日付だけ」のUTCミリ秒値同士を比較することで、
  // タイムゾーンの影響を受けない差分計算にする
  const todayMs = Date.UTC(today.year, today.month - 1, today.day);
  const targetMs = Date.UTC(target.year, target.month - 1, target.day);

  return Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));
}
