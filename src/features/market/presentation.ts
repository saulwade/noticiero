import type { Quote } from "@/lib/types";
export function quoteAfterStory(quote: Quote, publishedAt: string): boolean {
  const storyDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(publishedAt));
  if (quote.tradingDay !== storyDay) return quote.tradingDay > storyDay;
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(publishedAt)),
  );
  return hour < 16;
}
