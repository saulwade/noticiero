import { randomUUID } from "node:crypto";
import modelConfig from "./automatic-engine-version.json";
import { eq, sql } from "drizzle-orm";
import { getDb, resultRows } from "@/db/client";
import {
  financeAnalyses,
  financeAutomationInputs,
  financeHistories,
  financeInstruments,
  financeMarks,
  financeMovements,
  financeProfiles,
  financeSync,
  quotes,
} from "@/db/schema";
import { hash } from "@/features/news/normalize";
import { assertFinanceCapacity } from "./capacity";
import { calculatePortfolio, financeDay } from "./engine";
import { decimal, formatted, multiply } from "./decimal";
import { expectedUsClose } from "./market-calendar";
import { fetchDailyFx } from "./daily-providers";
import {
  AUTOMATION_ASSETS,
  fetchAutomationReference,
  fetchWeeklyHistory,
} from "./automatic-providers";
import {
  automationInputHash,
  automationProfileSchema,
  automationReportSchema,
  canonicalAutomation,
  validateAutomationReport,
} from "./automatic-validation";
import { getFinanceNewsWorkspace } from "./research-service";
import type {
  AutomationHistory,
  AutomationInput,
  AutomationReference,
  AutomationWorkspace,
} from "./automatic-types";
import type { FinanceMark, FinanceSyncState } from "./types";
import type { FinanceNewsEvent } from "./research-types";

type Db = Awaited<ReturnType<typeof getDb>>;
type Reader = Pick<Db, "select">;
const lock = sql`SELECT pg_advisory_xact_lock(7202633)`;
const stateId = "automatic-analysis",
  DAY = 86_400_000;
const failureMessage =
  "El análisis automático quedó pendiente. Se conserva el informe anterior; revisa conexión, datos, cuota y capacidad del archivo.";
const configuredMessage =
  "Falta configurar un perfil privado válido con capital, aportación, horizonte, reserva y costos pendientes o verificados.";
export function selectAutomationNews(
  events: FinanceNewsEvent[],
  now = new Date(),
): FinanceNewsEvent[] {
  const cutoff = now.getTime() - 30 * DAY;
  const financialPriority: Partial<
    Record<FinanceNewsEvent["eventKind"], number>
  > = {
    earnings: 400,
    regulation: 250,
    acquisition: 150,
    business: 100,
    funding: 75,
    security: 25,
    infrastructure: 20,
    products: 20,
  };
  return events
    .map((event) => {
      const published = Date.parse(event.publishedAt),
        captured = Date.parse(event.capturedAt);
      const macro =
        event.eventKind === "macro" ||
        /\b(?:federal reserve|fed|banxico|central bank|interest rates?|inflation|inflaci[oó]n|monetary policy|pol[ií]tica monetaria|tasas? de inter[eé]s|treasury yields?|bond yields?|tipo de cambio)\b/iu.test(
          `${event.title} ${event.topic}`,
        );
      const listed = event.companies.some((company) => !company.private);
      const financialSystem =
        event.eventKind === "security" &&
        /\b(?:banks?|banking|payment outages?|payment networks?|payment systems?|financial system|bancos?|bancari[oa]s?|sistema financiero|red de pagos)\b/iu.test(
          `${event.title} ${event.excerpt}`,
        );
      const material =
        macro || listed || event.eventKind === "earnings" || financialSystem;
      return {
        event,
        published,
        captured,
        score:
          (macro ? 1000 : 0) +
          (listed ? 200 : 0) +
          (financialPriority[event.eventKind] ?? 0),
        material,
      };
    })
    .filter(
      (row) =>
        row.material &&
        Number.isFinite(row.published) &&
        Number.isFinite(row.captured) &&
        row.published >= cutoff &&
        row.published <= now.getTime() &&
        row.captured <= now.getTime(),
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.published - a.published ||
        a.event.id.localeCompare(b.event.id),
    )
    .slice(0, 32)
    .map((row) => row.event);
}
export type AutomationProviders = {
  history: typeof fetchWeeklyHistory;
  reference: typeof fetchAutomationReference;
  fx: typeof fetchDailyFx;
};
const defaults: AutomationProviders = {
  history: fetchWeeklyHistory,
  reference: fetchAutomationReference,
  fx: fetchDailyFx,
};
const roundedMoney = (value: string) =>
  formatted(((decimal(value) + 500_000n) / 1_000_000n) * 1_000_000n);
async function ledger(reader: Reader, now: Date) {
  const [ir, mr, pr, profiles] = await Promise.all([
    reader.select().from(financeInstruments),
    reader.select().from(financeMovements),
    reader.select().from(financeMarks),
    reader.select().from(financeProfiles),
  ]);
  const instruments = ir
    .map((r) => r.data)
    .sort((a, b) => a.id.localeCompare(b.id));
  const movements = mr
    .map((r) => r.data)
    .sort((a, b) => a.id.localeCompare(b.id));
  const marks = pr.map((r) => r.data).sort((a, b) => a.id.localeCompare(b.id));
  const rawProfile = profiles
    .map((r) => r.data)
    .sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.version - a.version,
    )[0];
  const parsed = automationProfileSchema.safeParse(rawProfile),
    profile =
      parsed.success && Date.parse(parsed.data.updatedAt) <= now.getTime()
        ? parsed.data
        : undefined;
  const summary = calculatePortfolio(
    instruments,
    movements,
    marks,
    undefined,
    now,
  );
  const movementHash = hash(
    canonicalAutomation({ instruments, movements, marks }),
  );
  const fx = marks
    .filter(
      (m) =>
        m.kind === "fx" &&
        m.asOf <= financeDay(now) &&
        Date.parse(m.capturedAt) <= now.getTime(),
    )
    .sort(
      (a, b) =>
        b.asOf.localeCompare(a.asOf) ||
        b.capturedAt.localeCompare(a.capturedAt),
    )[0];
  const cashMxn =
    decimal(summary.cash.MXN) +
    (fx ? multiply(decimal(summary.cash.USD), decimal(fx.value)) : 0n);
  return {
    instruments,
    movements,
    marks,
    profile,
    summary,
    fx,
    portfolio: {
      hasMovements: movements.length > 0,
      complete: summary.complete,
      valueMxn:
        summary.valueMxn === undefined
          ? undefined
          : roundedMoney(summary.valueMxn),
      cashMxn: roundedMoney(formatted(cashMxn)),
      positions: summary.positions.map((p) => ({
        symbol: instruments.find((i) => i.id === p.instrumentId)!.symbol,
        valueMxn:
          p.valueMxn === undefined ? undefined : roundedMoney(p.valueMxn),
        quantity: p.quantity,
      })),
      movementHash,
    },
  };
}
async function writeState(
  db: Db,
  now: Date,
  changes: Partial<FinanceSyncState>,
  token?: string,
) {
  await db.transaction(async (tx) => {
    await tx.execute(lock);
    const previous = (
      await tx.select().from(financeSync).where(eq(financeSync.id, stateId))
    )[0]?.data;
    if (
      (token &&
        (previous?.leaseToken !== token || previous.status !== "running")) ||
      (previous?.lastAttempt && previous.lastAttempt > now.toISOString())
    )
      return;
    const data: FinanceSyncState = {
      ...previous,
      id: stateId,
      label: "Análisis automático del portafolio",
      provider: "Motor cuantitativo privado",
      status: "error",
      message: failureMessage,
      lastAttempt: now.toISOString(),
      ...changes,
    };
    await tx
      .insert(financeSync)
      .values({ id: stateId, data })
      .onConflictDoUpdate({ target: financeSync.id, set: { data } });
    await assertFinanceCapacity(tx);
  });
}
export async function recordAutomationFailure(
  _message?: string,
  now = new Date(),
  attemptId?: string,
) {
  // Worker and provider exceptions may contain credentials or private transport data.
  const db = await getDb();
  const previous = (
    await db.select().from(financeSync).where(eq(financeSync.id, stateId))
  )[0]?.data;
  const token = attemptId ?? previous?.leaseToken;
  if (!token || previous?.status !== "running" || previous.leaseToken !== token)
    return;
  await writeState(
    db,
    now,
    {
      status: "error",
      message: failureMessage,
      leaseToken: token,
      leaseUntil: undefined,
    },
    token,
  );
}
async function saveHistory(history: AutomationHistory) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.execute(lock);
    await tx
      .insert(financeHistories)
      .values({ id: history.id, data: history })
      .onConflictDoUpdate({
        target: financeHistories.id,
        set: { data: history },
      });
    await assertFinanceCapacity(tx);
  });
}
export async function prepareAutomationInput(
  now = new Date(),
  providers: AutomationProviders = defaults,
  attemptId?: string,
): Promise<AutomationInput> {
  if (!Number.isFinite(now.getTime()))
    throw new Error("Fecha de preparación inválida.");
  const db = await getDb(),
    token = attemptId ?? randomUUID();
  if (!/^[A-Za-z0-9-]{1,160}$/.test(token))
    throw new Error("Identificador de ejecución inválido.");
  let reserved = false;
  try {
    if (!(await ledger(db, now)).profile) {
      await writeState(db, now, {
        status: "configuration",
        message: configuredMessage,
      });
      throw new Error(configuredMessage);
    }
    await db.transaction(async (tx) => {
      await tx.execute(lock);
      const previous = (
        await tx.select().from(financeSync).where(eq(financeSync.id, stateId))
      )[0]?.data;
      if (
        previous?.status === "running" &&
        previous.leaseToken !== token &&
        previous.leaseUntil &&
        Date.parse(previous.leaseUntil) > now.getTime()
      )
        throw new Error(
          "Ya hay un análisis automático preparándose; conserva el trabajo en curso.",
        );
      const data: FinanceSyncState = {
        ...previous,
        id: stateId,
        label: "Análisis automático del portafolio",
        provider: "Motor cuantitativo privado",
        status: "running",
        message: "Preparando datos fechados para el cálculo privado.",
        lastAttempt: now.toISOString(),
        leaseToken: token,
        leaseUntil: new Date(now.getTime() + 10 * 60_000).toISOString(),
        inputHash: undefined,
      };
      await tx
        .insert(financeSync)
        .values({ id: stateId, data })
        .onConflictDoUpdate({ target: financeSync.id, set: { data } });
      await assertFinanceCapacity(tx);
    });
    reserved = true;
    const warnings: string[] = [];
    let current = await ledger(db, now);
    let fx: FinanceMark | undefined = current.fx;
    if (
      !fx ||
      fx.asOf < expectedUsClose(now) ||
      now.getTime() - Date.parse(fx.capturedAt) > 7 * DAY
    ) {
      try {
        const ref = await providers.fx(now);
        const mark = {
          id: hash(`automatic-fx:${ref.asOf}:${ref.value}`),
          kind: "fx" as const,
          value: ref.value,
          asOf: ref.asOf,
          capturedAt: now.toISOString(),
          source: ref.source,
          sourceUrl: ref.sourceUrl,
          automatic: true,
          provider: "frankfurter" as const,
        };
        await db.transaction(async (tx) => {
          await tx.execute(lock);
          await tx
            .insert(financeMarks)
            .values({ id: mark.id, data: mark })
            .onConflictDoNothing();
          await assertFinanceCapacity(tx);
        });
        fx = mark;
      } catch {
        warnings.push(
          "USD/MXN diario pendiente; se conserva la última referencia disponible.",
        );
      }
    }
    if (!fx || now.getTime() - Date.parse(`${fx.asOf}T12:00:00Z`) > 7 * DAY) {
      fx = undefined;
      warnings.push(
        "Falta USD/MXN de los últimos siete días. No se publican cantidades de compra sin conversión verificable.",
      );
    }
    const histories = (await db.select().from(financeHistories))
      .map((r) => r.data)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
    const references: AutomationReference[] = [];
    for (const asset of AUTOMATION_ASSETS.filter((a) => a.currency === "USD")) {
      let cached = histories.find((h) => h.symbol === asset.symbol);
      if (
        !cached ||
        now.getTime() - Date.parse(cached.capturedAt) >= 7 * DAY ||
        Date.parse(cached.capturedAt) > now.getTime()
      ) {
        try {
          const refreshed = await providers.history(asset, now);
          cached = {
            ...refreshed,
            id: cached?.id ?? refreshed.id,
            reference: cached?.reference,
          };
          await saveHistory(cached);
        } catch {
          warnings.push(
            `Histórico de ${asset.symbol} pendiente; se conserva la serie anterior y no se inventan observaciones.`,
          );
        }
      }
      let reference = cached?.reference;
      if (fx) {
        if (
          reference?.session !== expectedUsClose(now) ||
          Date.parse(reference.capturedAt) > now.getTime()
        ) {
          const quote = (
            await db
              .select()
              .from(quotes)
              .where(eq(quotes.symbol, asset.symbol))
          )[0]?.data;
          if (
            quote?.tradingDay === expectedUsClose(now) &&
            quote.currency === "USD" &&
            Number.isFinite(quote.price) &&
            quote.price > 0 &&
            Date.parse(quote.fetchedAt) <= now.getTime()
          )
            reference = {
              symbol: asset.symbol,
              price: String(quote.price),
              currency: "USD",
              fxMxn: fx.value,
              session: quote.tradingDay,
              capturedAt: quote.fetchedAt,
              sourceUrl:
                "https://www.alphavantage.co/documentation/#latestprice",
            };
          else {
            try {
              reference = await providers.reference(asset, fx.value, now);
            } catch {
              warnings.push(
                `Cierre diario de ${asset.symbol} pendiente; la referencia anterior no se considera un precio actual.`,
              );
            }
          }
        }
        if (reference?.session === expectedUsClose(now)) {
          const fxChanged =
            reference.fxMxn !== fx.value ||
            reference.fxSession !== fx.asOf ||
            reference.fxSourceUrl !== fx.sourceUrl;
          reference = {
            ...reference,
            capturedAt: fxChanged ? now.toISOString() : reference.capturedAt,
            fxMxn: fx.value,
            fxSession: fx.asOf,
            fxSourceUrl: fx.sourceUrl,
          };
          references.push(reference);
          if (!cached)
            cached = {
              id: hash(`automatic-history:${asset.symbol}`),
              symbol: asset.symbol,
              provider: "Alpha Vantage + Frankfurter",
              currency: "USD",
              adjusted: true,
              capturedAt: "1970-01-01T00:00:00.000Z",
              sourceUrl: "https://www.alphavantage.co/documentation/#weeklyadj",
              points: [],
              warnings: ["Histórico ajustado pendiente."],
            };
          cached = { ...cached, reference };
          await saveHistory(cached);
        }
      }
    }
    return await db.transaction(async (tx) => {
      await tx.execute(lock);
      current = await ledger(tx, now);
      if (!current.profile) throw new Error(configuredMessage);
      const all = (await tx.select().from(financeHistories))
        .map((r) => r.data)
        .filter((h) => AUTOMATION_ASSETS.some((a) => a.symbol === h.symbol))
        .sort((a, b) => a.symbol.localeCompare(b.symbol))
        .map((h) => ({
          ...h,
          points: h.points
            .filter((p) => p.date <= expectedUsClose(now))
            .slice(-260),
        }));
      for (const h of all) {
        warnings.push(...h.warnings);
        if (now.getTime() - Date.parse(h.capturedAt) >= 7 * DAY)
          warnings.push(
            `${h.symbol}: la serie ajustada lleva más de siete días sin actualizar.`,
          );
      }
      warnings.push(...current.summary.warnings);
      if (
        current.portfolio.positions.some(
          (p) => !AUTOMATION_ASSETS.some((a) => a.symbol === p.symbol),
        )
      )
        warnings.push(
          "Hay posiciones fuera del universo automático; se conserva la cartera real y requiere revisión antes de proponer aportaciones.",
        );
      if (current.profile.riskPreference === "unconfirmed")
        warnings.push(
          "Tolerancia al riesgo sin confirmar: la distribución es provisional y requiere revisar pérdidas ilustrativas.",
        );
      const archivedNews = (await getFinanceNewsWorkspace(true, now, tx))
        .events;
      const news = selectAutomationNews(archivedNews, now);
      if (archivedNews.length)
        warnings.push(
          "Noticias del cálculo: muestra priorizada de hasta 32 eventos materiales de los últimos 30 días. El briefing y archivo conservan las noticias completas.",
        );
      const input: AutomationInput = {
        version: 1,
        engineVersion: modelConfig.version,
        inputHash: "",
        asOf: now.toISOString(),
        profile: current.profile,
        assets: AUTOMATION_ASSETS.map((a) => ({ ...a })),
        histories: all,
        references: references.sort((a, b) => a.symbol.localeCompare(b.symbol)),
        portfolio: current.portfolio,
        news,
        dataWarnings: [...new Set(warnings)],
      };
      while (
        Buffer.byteLength(JSON.stringify(input)) > 395_000 &&
        input.news.length
      ) {
        input.news.pop();
        const warning =
          "El contexto noticioso del cálculo se acotó por tamaño; las noticias completas siguen en el briefing y archivo.";
        if (!input.dataWarnings.includes(warning))
          input.dataWarnings.push(warning);
      }
      input.inputHash = automationInputHash(input);
      if (Buffer.byteLength(JSON.stringify(input)) > 400_000)
        throw new Error(
          "La entrada automática excede el tamaño permitido; se conserva el archivo.",
        );
      const prior = (
        await tx
          .select()
          .from(financeAutomationInputs)
          .where(eq(financeAutomationInputs.id, input.inputHash))
      )[0]?.data;
      if (!prior) {
        const count = resultRows(
          await tx.execute(
            sql`SELECT count(*) AS n FROM finance_automation_inputs`,
          ),
        ) as { n: string | number }[];
        if (Number(count[0]?.n ?? 0) >= 1100)
          throw new Error(
            "Límite de entradas automáticas alcanzado. Exporta el historial antes de ampliar capacidad.",
          );
        await tx
          .insert(financeAutomationInputs)
          .values({ id: input.inputHash, data: input })
          .onConflictDoNothing();
      }
      const state = (
        await tx.select().from(financeSync).where(eq(financeSync.id, stateId))
      )[0]?.data;
      if (state?.leaseToken !== token || state.status !== "running")
        throw new Error(
          "La preparación perdió su turno; vuelve a ejecutar el análisis.",
        );
      const data: FinanceSyncState = {
        ...state,
        message:
          "Entrada fechada preparada; esperando publicación del cálculo privado.",
        leaseToken: token,
        leaseUntil: new Date(now.getTime() + 10 * 60_000).toISOString(),
        inputHash: input.inputHash,
      };
      await tx
        .update(financeSync)
        .set({ data })
        .where(eq(financeSync.id, stateId));
      await assertFinanceCapacity(tx);
      return prior ?? input;
    });
  } catch (error) {
    if (reserved)
      await writeState(
        db,
        now,
        {
          status: "error",
          message: failureMessage,
          leaseToken: undefined,
          leaseUntil: undefined,
        },
        token,
      ).catch(() => {});
    if (
      error instanceof Error &&
      (error.message === configuredMessage ||
        error.message.startsWith("Ya hay un análisis"))
    )
      throw error;
    throw new Error(failureMessage);
  }
}

export async function publishAutomationReport(
  raw: unknown,
  now = new Date(),
  attemptId?: string,
): Promise<{ message: string }> {
  const db = await getDb();
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(lock);
      const parsed = automationReportSchema.safeParse(raw);
      if (!parsed.success)
        throw new Error("El análisis recibido tiene campos inválidos.");
      const previous = (
        await tx
          .select()
          .from(financeAnalyses)
          .where(
            sql`${financeAnalyses.data}->>'inputHash' = ${parsed.data.inputHash}`,
          )
      )[0]?.data;
      const input = (
        await tx
          .select()
          .from(financeAutomationInputs)
          .where(eq(financeAutomationInputs.id, parsed.data.inputHash))
      )[0]?.data;
      if (!input)
        throw new Error("No existe una entrada preparada para este análisis.");
      const current = await ledger(tx, now);
      if (
        !current.profile ||
        canonicalAutomation(current.profile) !==
          canonicalAutomation(input.profile) ||
        current.portfolio.movementHash !== input.portfolio.movementHash
      )
        throw new Error(
          "El perfil, movimientos o valoraciones cambiaron; prepara una entrada nueva.",
        );
      const previousState = (
        await tx.select().from(financeSync).where(eq(financeSync.id, stateId))
      )[0]?.data;
      const token = attemptId ?? previousState?.leaseToken;
      const ownsRun = Boolean(
        token &&
        previousState?.status === "running" &&
        previousState.leaseToken === token &&
        previousState.inputHash === input.inputHash &&
        previousState.leaseUntil &&
        Date.parse(previousState.leaseUntil) > now.getTime(),
      );
      const finishOwnRun = async () => {
        if (!ownsRun || !previousState || !token)
          throw new Error("La ejecución no posee el turno de este análisis.");
        const data: FinanceSyncState = {
          ...previousState,
          status: "ok",
          message:
            "Análisis y propuesta archivados. Operar requiere una decisión y ejecución fuera de la aplicación.",
          lastAttempt: now.toISOString(),
          lastSuccess: now.toISOString(),
          asOf: parsed.data.asOf,
          session: financeDay(now),
          leaseToken: token,
          leaseUntil: undefined,
          inputHash: input.inputHash,
        };
        await tx
          .update(financeSync)
          .set({ data })
          .where(eq(financeSync.id, stateId));
      };
      if (previous) {
        if (canonicalAutomation(previous) !== canonicalAutomation(parsed.data))
          throw new Error(
            "La entrada ya tiene un informe inmutable diferente.",
          );
        if (ownsRun) await finishOwnRun();
        else if (
          previousState?.status !== "ok" ||
          previousState.inputHash !== input.inputHash ||
          (attemptId && previousState.leaseToken !== attemptId)
        )
          throw new Error(
            "Otra ejecución posee el turno; el reintento no puede modificarlo.",
          );
        await assertFinanceCapacity(tx);
        return {
          message:
            "El análisis ya estaba archivado; no se duplicó ni cambió el historial.",
        };
      }
      if (!ownsRun)
        throw new Error(
          "La ejecución no posee el turno activo de este análisis.",
        );
      const report = validateAutomationReport(parsed.data, input, now);
      if (
        (
          await tx
            .select()
            .from(financeAnalyses)
            .where(eq(financeAnalyses.id, report.id))
        ).length
      )
        throw new Error("Identificador de análisis ya utilizado.");
      const count = resultRows(
        await tx.execute(sql`SELECT count(*) AS n FROM finance_analyses`),
      ) as { n: string | number }[];
      if (Number(count[0]?.n ?? 0) >= 1100)
        throw new Error(
          "Límite de análisis alcanzado; el historial se conserva.",
        );
      await tx.insert(financeAnalyses).values({ id: report.id, data: report });
      await finishOwnRun();
      await assertFinanceCapacity(tx);
      return {
        message:
          "Análisis automático archivado con sus datos, fuentes y presupuesto; no se registraron operaciones.",
      };
    });
  } catch (error) {
    await recordAutomationFailure(undefined, now, attemptId).catch(() => {});
    void error;
    throw new Error(failureMessage);
  }
}

export async function getAutomationWorkspace(
  now = new Date(),
  full = false,
): Promise<AutomationWorkspace> {
  const db = await getDb();
  const [current, rows, states, counts] = await Promise.all([
    ledger(db, now),
    db
      .select()
      .from(financeAnalyses)
      .orderBy(sql`${financeAnalyses.data}->>'asOf' DESC`)
      .limit(full ? 1100 : 20),
    db.select().from(financeSync).where(eq(financeSync.id, stateId)),
    db.execute(sql`SELECT count(*) AS n FROM finance_analyses`),
  ]);
  const history = rows.map((r) => r.data),
    report = history[0],
    state = states[0]?.data;
  const common = {
    history,
    totalReports: Number(
      (resultRows(counts) as { n: string | number }[])[0]?.n ?? 0,
    ),
    lastSuccess: state?.lastSuccess,
    ...(full
      ? {
          archive: {
            profiles: (await db.select().from(financeProfiles)).map(
              (r) => r.data,
            ),
            histories: (await db.select().from(financeHistories)).map(
              (r) => r.data,
            ),
            inputs: (await db.select().from(financeAutomationInputs)).map(
              (r) => r.data,
            ),
          },
        }
      : {}),
  };
  if (!current.profile)
    return { ...common, status: "not-configured", message: configuredMessage };
  if (!report)
    return {
      ...common,
      status: state?.status === "error" ? "error" : "pending",
      message:
        state?.message ??
        "El perfil está preparado. El siguiente trabajo privado generará la primera propuesta automáticamente.",
    };
  const input = (
    await db
      .select()
      .from(financeAutomationInputs)
      .where(eq(financeAutomationInputs.id, report.inputHash))
  )[0]?.data;
  let staleReason: string | undefined;
  if (report.engineVersion !== modelConfig.version)
    staleReason =
      "Hay una versión nueva del modelo; el informe anterior conserva sus supuestos y espera un cálculo actualizado.";
  else if (
    !input ||
    canonicalAutomation(input.profile) !==
      canonicalAutomation(current.profile) ||
    input.portfolio.movementHash !== current.portfolio.movementHash
  )
    staleReason =
      "El perfil, movimientos o valoraciones cambiaron después del análisis. Espera la siguiente actualización.";
  else if (
    now.getTime() - Date.parse(report.asOf) > 36 * 3_600_000 ||
    Date.parse(report.asOf) > now.getTime()
  )
    staleReason =
      "El análisis necesita una actualización diaria; se conserva la captura anterior.";
  else if (input.references.some((r) => r.session !== expectedUsClose(now)))
    staleReason =
      "Hay una sesión de cierre más reciente. El análisis conserva los datos fechados anteriores.";
  return {
    ...common,
    current: report,
    status: staleReason
      ? "stale"
      : state?.status === "error"
        ? "error"
        : "ready",
    message:
      staleReason ??
      state?.message ??
      "Propuesta calculada con referencias fechadas; confirma antes de operar.",
    staleReason,
  };
}
