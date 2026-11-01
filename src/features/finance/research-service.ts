import { hash } from "@/features/news/normalize";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { financeNewsReviewSchema } from "./research-validation";
import { getDb } from "@/db/client";
import {
  financeNewsEvents,
  financeNewsReviews,
  financeNewsBriefs,
  financeSync,
  stories,
  quotes,
} from "@/db/schema";
import { financeDay } from "./engine";
import { assertFinanceCapacity } from "./capacity";
import {
  buildFinanceNewsEvent,
  buildFinanceNewsBrief,
  selectLatestFinanceEvents,
} from "./news-research";
import type {
  FinanceNewsEvent,
  FinanceNewsReview,
  FinanceNewsWorkspace,
} from "./research-types";
import type { FinanceSyncState } from "./types";

type Reader = Pick<Awaited<ReturnType<typeof getDb>>, "select">;
const lock = sql`SELECT pg_advisory_xact_lock(7202633)`;
const key = "news-research";
export async function collectFinanceNews(now = new Date()) {
  const db = await getDb();
  const capturedAt = now.toISOString();
  const previous = (
    await db.select().from(financeSync).where(eq(financeSync.id, key))
  )[0]?.data;
  try {
    const [recent, page] = await Promise.all([
      db
        .select()
        .from(stories)
        .orderBy(sql`${stories.data}->>'publishedAt' DESC`)
        .limit(500),
      db
        .select()
        .from(stories)
        .where(sql`${stories.id} > ${previous?.scanCursor ?? ""}`)
        .orderBy(stories.id)
        .limit(501),
    ]);
    const scanPage = page.slice(0, 500);
    const nextCursor = page.length > 500 ? scanPage.at(-1)?.id : undefined;
    const sourceRows = [
      ...new Map([...recent, ...scanPage].map((r) => [r.id, r])).values(),
    ];
    const candidates = sourceRows
      .map((r) => buildFinanceNewsEvent(r.data, now))
      .filter((e): e is FinanceNewsEvent => Boolean(e));
    return await db.transaction(async (tx) => {
      await tx.execute(lock);
      const newer = (
        await tx.select().from(financeSync).where(eq(financeSync.id, key))
      )[0]?.data;
      if (newer?.lastAttempt && newer.lastAttempt > capturedAt)
        return { added: 0, events: 0, briefId: undefined };
      const existing = (await tx.select().from(financeNewsEvents)).map(
        (r) => r.data,
      );
      const currentByStory = new Map<string, FinanceNewsEvent>();
      for (const event of [...existing].sort(
        (a, b) =>
          b.capturedAt.localeCompare(a.capturedAt) ||
          (b.revision ?? 0) - (a.revision ?? 0) ||
          b.id.localeCompare(a.id),
      ))
        if (!currentByStory.has(event.storyId))
          currentByStory.set(event.storyId, event);
      const seen = new Set(existing.map((e) => e.id));
      const fresh: FinanceNewsEvent[] = [];
      for (const candidate of candidates) {
        const current = currentByStory.get(candidate.storyId);
        if (current && (current.evidenceId ?? current.id) === candidate.id)
          continue;
        const revision = (current?.revision ?? (current ? 1 : 0)) + 1;
        const event = {
          ...candidate,
          evidenceId: candidate.id,
          revision,
          id: seen.has(candidate.id)
            ? hash(`${candidate.id}:observation:${capturedAt}:${revision}`)
            : candidate.id,
        };
        fresh.push(event);
        currentByStory.set(event.storyId, event);
        seen.add(event.id);
      }
      if (existing.length + fresh.length > 5000)
        throw new Error(
          "Máximo 5,000 versiones de investigación. El archivo se conserva; exporta antes de ampliar capacidad.",
        );
      for (const event of fresh)
        await tx
          .insert(financeNewsEvents)
          .values({ id: event.id, data: event })
          .onConflictDoNothing();
      const all = [...existing, ...fresh];
      const latest = selectLatestFinanceEvents(all);
      const observedToday = latest.filter(
        (e) => financeDay(new Date(e.capturedAt)) === financeDay(now),
      );
      const currentQuotes = (await tx.select().from(quotes)).map((r) => r.data);
      const brief = buildFinanceNewsBrief(observedToday, currentQuotes, now);
      const briefs = await tx
        .select({ id: financeNewsBriefs.id })
        .from(financeNewsBriefs);
      if (!briefs.some((r) => r.id === brief.id)) {
        if (briefs.length >= 1100)
          throw new Error(
            "Máximo 1,100 versiones de informe financiero. Se conserva el archivo completo.",
          );
        await tx
          .insert(financeNewsBriefs)
          .values({ id: brief.id, data: brief })
          .onConflictDoNothing();
      }
      const state: FinanceSyncState = {
        id: key,
        label: "Investigación de noticias",
        provider: "Motor local",
        status: "ok",
        message: `Archivo actualizado: ${fresh.length} fichas nuevas o revisadas. ${nextCursor ? "La recuperación histórica continuará en la próxima actualización. " : ""}Las hipótesis requieren contraste.`,
        scanCursor: nextCursor,
        scanComplete: !nextCursor,
        lastAttempt: capturedAt,
        lastSuccess: capturedAt,
        asOf: financeDay(now),
      };
      await tx
        .insert(financeSync)
        .values({ id: key, data: state })
        .onConflictDoUpdate({ target: financeSync.id, set: { data: state } });
      await assertFinanceCapacity(tx);
      return { added: fresh.length, events: latest.length, briefId: brief.id };
    });
  } catch {
    const message =
      "La investigación financiera quedó pendiente. Se conserva el archivo anterior; revisa capacidad y vuelve a actualizar.";
    await db.transaction(async (tx) => {
      await tx.execute(lock);
      const current = (
        await tx.select().from(financeSync).where(eq(financeSync.id, key))
      )[0]?.data;
      if (
        current?.lastAttempt &&
        (current.lastAttempt > capturedAt ||
          (current.lastAttempt === capturedAt && current.status === "ok"))
      )
        return;
      const state: FinanceSyncState = {
        ...current,
        id: key,
        label: "Investigación de noticias",
        provider: "Motor local",
        status: "error",
        message,
        lastAttempt: capturedAt,
      };
      await tx
        .insert(financeSync)
        .values({ id: key, data: state })
        .onConflictDoUpdate({ target: financeSync.id, set: { data: state } });
    });
    throw new Error(message);
  }
}
export async function getFinanceNewsWorkspace(
  full = false,
  now = new Date(),
  reader?: Reader,
): Promise<FinanceNewsWorkspace> {
  const db = reader ?? (await getDb());
  const [events, reviews, briefs, states] = await Promise.all([
    db.select().from(financeNewsEvents),
    db.select().from(financeNewsReviews),
    db.select().from(financeNewsBriefs),
    db.select().from(financeSync),
  ]);
  const versions = events
    .map((r) => r.data)
    .filter((e) => Date.parse(e.publishedAt) <= now.getTime());
  const latest = selectLatestFinanceEvents(versions).sort(
    (a, b) =>
      b.publishedAt.localeCompare(a.publishedAt) ||
      b.capturedAt.localeCompare(a.capturedAt),
  );
  const cutoff = now.getTime() - 30 * 86400000;
  const displayed = full
    ? latest
    : latest.filter((e) => Date.parse(e.publishedAt) >= cutoff).slice(0, 60);
  const allReviews = reviews
    .map((r) => r.data)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const allBriefs = briefs
    .map((r) => r.data)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const state = states.find((r) => r.id === key)?.data;
  return {
    asOf: now.toISOString(),
    events: displayed,
    ...(full ? { eventVersions: versions } : {}),
    reviews: full ? allReviews : allReviews.slice(0, 40),
    briefs: full ? allBriefs : allBriefs.slice(0, 7),
    totalEvents: latest.length,
    totalVersions: versions.length,
    totalReviews: reviews.length,
    totalBriefs: briefs.length,
    viewLimited:
      displayed.length < latest.length ||
      (!full && (allReviews.length > 40 || allBriefs.length > 7)),
    lastUpdatedAt: state?.lastSuccess,
    message:
      state?.message ??
      "Las noticias se preparan durante la actualización de tu edición; no necesitas registrar inversiones.",
  };
}
export async function saveFinanceNewsReview(raw: unknown) {
  const input = financeNewsReviewSchema.parse(raw);
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(lock);
    const event = (
      await tx
        .select()
        .from(financeNewsEvents)
        .where(eq(financeNewsEvents.id, input.eventId))
    )[0]?.data;
    if (!event)
      throw new Error(
        "La noticia no está archivada; actualiza la edición antes de guardar la nota.",
      );
    const reviews = (await tx.select().from(financeNewsReviews))
      .map((r) => r.data)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const last = reviews.find((r) => r.storyId === event.storyId);
    if (
      last &&
      last.eventId === input.eventId &&
      last.status === input.status &&
      last.note === input.note &&
      last.openQuestions === input.openQuestions
    )
      return { message: "La nota ya está guardada; se conserva su captura." };
    if (reviews.length >= 500)
      throw new Error(
        "Máximo 500 versiones de notas financieras. El archivo se conserva; exporta antes de ampliar capacidad.",
      );
    const at = new Date(
      Math.max(Date.now(), Date.parse(last?.createdAt ?? "1970-01-01") + 1),
    ).toISOString();
    const review: FinanceNewsReview = {
      ...input,
      id: randomUUID(),
      storyId: event.storyId,
      createdAt: at,
      snapshot: event,
    };
    await tx.insert(financeNewsReviews).values({ id: review.id, data: review });
    await assertFinanceCapacity(tx);
    return {
      message:
        "Nota de investigación guardada con la noticia y sus fuentes. Las versiones anteriores se conservan.",
    };
  });
}
