import {
  researchIssuers,
  findResearchIssuers,
  stockEdges,
} from "./stock-catalog";
import type { FinanceNewsEvent } from "./research-types";
import type { StockCandidate } from "./stock-types";

export function discoverStockCandidates(
  events: FinanceNewsEvent[],
  now = new Date(),
): StockCandidate[] {
  const map = new Map<string, StockCandidate>();
  const sorted = events
    .filter(
      (e) =>
        Date.parse(e.publishedAt) <= now.getTime() &&
        Date.parse(e.capturedAt) <= now.getTime() &&
        Date.parse(e.publishedAt) >= now.getTime() - 30 * 86400000,
    )
    .sort(
      (a, b) =>
        b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id),
    );
  const add = (symbol: string, event: FinanceNewsEvent, indirect = false) => {
    const issuer = researchIssuers.find((i) => i.symbol === symbol);
    if (!issuer) return;
    const candidate =
      map.get(symbol) ??
      ({
        symbol,
        name: issuer.name,
        cik: issuer.cik,
        exchange: issuer.exchange,
        origin: indirect ? "related" : "direct",
        events: [],
        links: [],
      } as StockCandidate);
    if (!indirect) candidate.origin = "direct";
    if (
      !candidate.events.some((e) => e.id === event.id) &&
      candidate.events.length < 3
    )
      candidate.events.push({
        id: event.id,
        title: event.title,
        url: event.url,
        sourceName: event.sourceName,
        publishedAt: event.publishedAt,
      });
    map.set(symbol, candidate);
    return candidate;
  };
  for (const event of sorted) {
    const text = `${event.title}. ${event.excerpt}`;
    const mentioned = new Set([
      ...event.companies.map((c) => c.symbol),
      ...findResearchIssuers(text).map((i) => i.symbol),
    ]);
    if (/\b(heydude|hey dude)\b/i.test(text)) mentioned.add("HEYDUDE");
    for (const symbol of mentioned) add(symbol, event);
    for (const edge of stockEdges) {
      // Primary disclosure must predate the article. Never create a relationship
      // merely from co-mentions, a rumour or a shared industry.
      if (
        !mentioned.has(edge.fromSymbol) ||
        !edge.trigger.test(text) ||
        edge.sourceDate > event.publishedAt.slice(0, 10)
      )
        continue;
      const candidate = add(edge.toSymbol, event, true);
      if (candidate && !candidate.links.some((l) => l.id === edge.id)) {
        const { toSymbol: _to, trigger: _trigger, ...link } = edge;
        void _to;
        void _trigger;
        candidate.links.push(link);
      }
    }
  }
  return [...map.values()]
    .sort(
      (a, b) =>
        Number(b.links.length > 0) - Number(a.links.length > 0) ||
        b.events[0].publishedAt.localeCompare(a.events[0].publishedAt) ||
        a.symbol.localeCompare(b.symbol),
    )
    .slice(0, 6);
}
