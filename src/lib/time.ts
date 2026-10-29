export const TIME_ZONE = "America/Mexico_City";
export function editionFor(date = new Date()): {
  key: string;
  date: string;
  slot: "AM" | "PM";
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (key: string) => parts.find((p) => p.type === key)!.value;
  const day = `${value("year")}-${value("month")}-${value("day")}`;
  const slot = Number(value("hour")) < 12 ? "AM" : "PM";
  return { key: `${day}-${slot}`, date: day, slot };
}
export function relativeTime(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  if (mins < 1440) return `Hace ${Math.floor(mins / 60)} h`;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}
export function dateLabel(date = new Date()) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
