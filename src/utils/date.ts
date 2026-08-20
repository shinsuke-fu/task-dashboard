/**
 * src/utils/date.ts
 * -----------------------------------------------------------------------
 * 【役割】
 *   日付まわりの共通処理を集約するユーティリティ。「今日の日付」や
 *   「期日までの残り日数」を、実行環境のタイムゾーン設定に左右されず
 *   常に同じ結果になるように計算するための関数をここにまとめる。
 *
 * 【主な処理】
 *   1. getTodayJstDateString … 実行時点の「今日」を日本時間（JST）基準の
 *      YYYY-MM-DD文字列で取得する
 *   2. getDaysDiffFromToday … 期日文字列(YYYY-MM-DD)と「今日」との
 *      差分日数を計算する（マイナスなら期日超過）
 *
 * 【設計メモ】
 *   `new Date("YYYY-MM-DD")` はUTC基準で解釈されるため、その後に
 *   `setHours(0,0,0,0)`（ローカル時刻基準）を組み合わせると、実行環境の
 *   タイムゾーンによっては日付が1日ズレる可能性がある。この関数群では
 *   年・月・日の数値だけを取り出して比較することで、その種のズレを
 *   構造的に起こらないようにしている。
 * -----------------------------------------------------------------------
 */

// 実行時点の「今日」をJST（日本時間）基準の YYYY-MM-DD 文字列で取得する
export function getTodayJstDateString(): string {
  return new Date()
    .toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\//g, '-');
}

// 'YYYY-MM-DD' 形式の日付文字列を、年月日の数値に分解する
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
