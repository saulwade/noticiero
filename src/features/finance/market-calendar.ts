// NYSE regular equity holidays. Publication checks deliberately wait until20:00
// New York even on13:00 sessions: an exchange close is not provider availability.
// Source: https://www.nyse.com/markets/hours-calendars
const DAY = 86_400_000;
export function validDay(day: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(`${day}T12:00:00Z`)) &&
    new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day
  );
}
const dayString = (date: Date) => date.toISOString().slice(0, 10);
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const shift = (day: string, n: number) =>
  dayString(new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY));
const fixed = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
function nthWeekday(year: number, month: number, weekDay: number, n: number) {
  const first = fixed(year, month, 1);
  return fixed(
    year,
    month,
    1 + ((weekDay - weekday(first) + 7) % 7) + 7 * (n - 1),
  );
}
function lastMonday(year: number, month: number) {
  const last = dayString(new Date(Date.UTC(year, month, 0, 12)));
  return shift(last, -((weekday(last) + 6) % 7));
}
function observed(day: string, newYear = false) {
  const w = weekday(day);
  // NYSE remains open Dec31 when Jan1 is Saturday (e.g.2021).
  return w === 6 && !newYear ? shift(day, -1) : w === 0 ? shift(day, 1) : day;
}
function goodFriday(year: number) {
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    q = h + l - 7 * m + 114;
  const easter = fixed(year, Math.floor(q / 31), (q % 31) + 1);
  return shift(easter, -2);
}
const specialClosures = new Set([
  "2001-09-11",
  "2001-09-12",
  "2001-09-13",
  "2001-09-14",
  "2004-06-11",
  "2007-01-02",
  "2012-10-29",
  "2012-10-30",
  "2018-12-05",
  "2025-01-09",
]);
const holidayCache = new Map<number, Set<string>>();
function holidays(year: number) {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const values = new Set([
    observed(fixed(year, 1, 1), true),
    nthWeekday(year, 1, 1, 3),
    nthWeekday(year, 2, 1, 3),
    goodFriday(year),
    lastMonday(year, 5),
    observed(fixed(year, 7, 4)),
    nthWeekday(year, 9, 1, 1),
    nthWeekday(year, 11, 4, 4),
    observed(fixed(year, 12, 25)),
  ]);
  if (year >= 2022) values.add(observed(fixed(year, 6, 19)));
  holidayCache.set(year, values);
  return values;
}
export function isUsTradingDay(day: string): boolean {
  if (!validDay(day)) return false;
  const w = weekday(day);
  return (
    w !== 0 &&
    w !== 6 &&
    !holidays(Number(day.slice(0, 4))).has(day) &&
    !specialClosures.has(day)
  );
}
export function usSessionCloseHour(day: string): 13 | 16 | undefined {
  if (!isUsTradingDay(day)) return undefined;
  const year = Number(day.slice(0, 4));
  return day === shift(nthWeekday(year, 11, 4, 4), 1) ||
    day === fixed(year, 12, 24) ||
    day === fixed(year, 7, 3)
    ? 13
    : 16;
}
export function expectedUsClose(now: Date): string {
  if (!Number.isFinite(now.getTime()))
    throw new Error("Fecha de consulta inválida.");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  let day = `${part("year")}-${part("month")}-${part("day")}`;
  if (Number(part("hour")) < 20) day = shift(day, -1);
  for (let n = 0; n < 20; n++, day = shift(day, -1))
    if (isUsTradingDay(day)) return day;
  throw new Error("No se pudo determinar una sesión reciente.");
}
