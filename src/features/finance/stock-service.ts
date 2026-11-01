import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  financeHistories,
  financeResearch,
  financeSync,
  usage,
} from "@/db/schema";
import { assertFinanceCapacity } from "./capacity";
import { discoverStockCandidates } from "./stock-discovery";
import { fetchWeeklyHistory } from "./automatic-providers";
import { collectCompanyFacts } from "./sec";
import { collectStockFacts } from "./stock-fundamentals";
import type { FinanceNewsEvent } from "./research-types";
import type { StockContext } from "./stock-types";
import type { FinanceSyncState, Instrument } from "./types";

const DAY = 86400000,
  lock = sql`SELECT pg_advisory_xact_lock(7202633)`;
export type StockProviders = {
  facts: typeof collectCompanyFacts;
  history: typeof fetchWeeklyHistory;
};
const defaults: StockProviders = {
  facts: collectStockFacts,
  history: fetchWeeklyHistory,
};
/** Service-only. GET and browser render never invoke this bounded network batch. */
export async function prepareStockContext(
  events: FinanceNewsEvent[],
  now = new Date(),
  providers: StockProviders = defaults,
): Promise<StockContext> {
  const db = await getDb(),
    candidates = discoverStockCandidates(events, now);
  const [storedFacts, storedHistory] = await Promise.all([
    db.select().from(financeResearch),
    db.select().from(financeHistories),
  ]);
  const warnings: string[] = [];
  let factsCalls = 0,
    historyCalls = 0;
  for (const candidate of candidates) {
    const instrumentId = `research-issuer:${candidate.cik}`;
    candidate.facts = storedFacts
      .map((r) => r.data)
      .filter(
        (r) =>
          r.instrumentId === instrumentId &&
          Date.parse(r.capturedAt) <= now.getTime(),
      )
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
    candidate.history = storedHistory
      .map((r) => r.data)
      .filter(
        (r) =>
          r.symbol === candidate.symbol &&
          Date.parse(r.capturedAt) <= now.getTime(),
      )
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];
    for (const kind of ["facts", "history"] as const) {
      const id = `stock-${kind}:${candidate.symbol}`;
      const budget = kind === "facts" ? factsCalls < 3 : historyCalls < 1;
      const cached = kind === "facts" ? candidate.facts : candidate.history;
      const token = `${now.toISOString()}:${candidate.symbol}:${kind}`;
      const reserved =
        budget &&
        (await db.transaction(async (tx) => {
          await tx.execute(lock);
          const previous = (
            await tx.select().from(financeSync).where(eq(financeSync.id, id))
          )[0]?.data;
          if (
            (previous?.status === "running" &&
              Date.parse(previous.leaseUntil ?? "") > now.getTime()) ||
            (previous?.status === "error" &&
              now.getTime() - Date.parse(previous.lastAttempt ?? "") < DAY) ||
            (previous?.status === "configuration" &&
              previous.session === now.toISOString().slice(0, 10)) ||
            (cached &&
              now.getTime() -
                Date.parse(previous?.lastSuccess ?? cached.capturedAt) <
                7 * DAY)
          )
            return false;
          const state: FinanceSyncState = {
            ...previous,
            id,
            label: "Investigación automática de acciones",
            provider:
              kind === "facts"
                ? "SEC EDGAR / Alpha Vantage"
                : "Alpha Vantage + Frankfurter",
            status: "running",
            message: "Preparando evidencia financiera pública.",
            lastAttempt: now.toISOString(),
            leaseToken: token,
            leaseUntil: new Date(now.getTime() + 5 * 60000).toISOString(),
          };
          await tx
            .insert(financeSync)
            .values({ id, data: state })
            .onConflictDoUpdate({
              target: financeSync.id,
              set: { data: state },
            });
          return true;
        }));
      if (!reserved) continue;
      if (kind === "facts") factsCalls++;
      else historyCalls++;
      try {
        const instrument: Instrument = {
          id: instrumentId,
          ...candidate,
          kind: "stock",
          currency: "USD",
          fractional: false,
          createdAt: now.toISOString(),
        };
        const observation =
          kind === "facts"
            ? await providers.facts(instrument, now)
            : await providers.history(
                {
                  symbol: candidate.symbol,
                  name: candidate.name,
                  role: "global-equity",
                  currency: "USD",
                  sourceUrl: `https://www.sec.gov/edgar/browse/?CIK=${candidate.cik}`,
                },
                now,
              );
        const persisted = await db.transaction(async (tx) => {
          await tx.execute(lock);
          const state = (
            await tx.select().from(financeSync).where(eq(financeSync.id, id))
          )[0]?.data;
          if (state?.leaseToken !== token) return undefined;
          let saved = observation;
          if (kind === "facts") {
            const fact = observation as NonNullable<typeof candidate.facts>;
            const existing = await tx.select().from(financeResearch);
            const prior = existing.find((row) => row.id === fact.id)?.data;
            if (!prior && existing.length >= 1000) throw new Error("capacity");
            await tx
              .insert(financeResearch)
              .values({ id: fact.id, data: fact })
              .onConflictDoNothing();
            saved = prior ?? fact;
          } else {
            const history = observation as NonNullable<
              typeof candidate.history
            >;
            await tx
              .insert(financeHistories)
              .values({ id: history.id, data: history })
              .onConflictDoUpdate({
                target: financeHistories.id,
                set: { data: history },
              });
          }
          const next = {
            ...state,
            status: "ok" as const,
            lastSuccess: now.toISOString(),
            leaseToken: undefined,
            leaseUntil: undefined,
            message:
              "Evidencia pública archivada; no constituye posición ni recomendación.",
          };
          await tx
            .insert(financeSync)
            .values({ id, data: next })
            .onConflictDoUpdate({
              target: financeSync.id,
              set: { data: next },
            });
          await assertFinanceCapacity(tx);
          return saved;
        });
        if (persisted) {
          if (kind === "facts")
            candidate.facts = persisted as NonNullable<typeof candidate.facts>;
          else
            candidate.history = persisted as NonNullable<
              typeof candidate.history
            >;
        }
      } catch {
        await db.transaction(async (tx) => {
          await tx.execute(lock);
          const state = (
            await tx.select().from(financeSync).where(eq(financeSync.id, id))
          )[0]?.data;
          if (state?.leaseToken !== token) return;
          const budget = (
            await tx
              .select()
              .from(usage)
              .where(eq(usage.key, `quote:${now.toISOString().slice(0, 10)}`))
          )[0];
          const exhausted = (budget?.amount ?? 0) >= 20;
          const next = {
            ...state,
            status: exhausted ? ("configuration" as const) : ("error" as const),
            session: exhausted ? now.toISOString().slice(0, 10) : undefined,
            leaseToken: undefined,
            leaseUntil: undefined,
            message: exhausted
              ? "Cuota gratuita compartida agotada; la investigación adicional se retoma tras el reinicio UTC, conservando la evidencia anterior."
              : "Fuente de investigación pendiente; se conserva la evidencia anterior y se reintentará con enfriamiento.",
          };
          await tx
            .insert(financeSync)
            .values({ id, data: next })
            .onConflictDoUpdate({
              target: financeSync.id,
              set: { data: next },
            });
        });
      }
    }
  }
  const relevant = new Set(
    candidates.flatMap((candidate) => [
      `stock-facts:${candidate.symbol}`,
      `stock-history:${candidate.symbol}`,
    ]),
  );
  const states = (await db.select().from(financeSync))
    .filter((row) => relevant.has(row.id))
    .map((row) => row.data);
  if (states.some((state) => state.status === "configuration"))
    warnings.push(
      "Cuota gratuita compartida en pausa: los datos adicionales pendientes se reintentan después del reinicio UTC. No se contrata capacidad ni se inventan cifras.",
    );
  if (states.some((state) => state.status === "error"))
    warnings.push(
      "Parte de las fuentes de investigación quedó pendiente; se conserva la evidencia anterior y se reintentará con enfriamiento.",
    );
  warnings.push(
    "Cobertura inicial acotada de emisores y relaciones documentadas; no representa todas las empresas ni identifica automáticamente todos los proveedores. Las relaciones no prueban dirección bursátil ni ingresos de un proyecto.",
  );
  if (candidates.some((c) => !c.facts || !c.history))
    warnings.push(
      "La cobertura se completa por lotes: hasta tres consultas de fundamentales y un histórico por ciclo, con caché semanal y cuota Alpha compartida. Un dato ausente no se sustituye por cero.",
    );
  return {
    version: 1,
    asOf: now.toISOString(),
    candidates: candidates.map((candidate) => ({
      ...candidate,
      ...(candidate.history
        ? {
            history: {
              ...candidate.history,
              points: candidate.history.points.slice(-156),
            },
          }
        : {}),
    })),
    warnings,
  };
}
