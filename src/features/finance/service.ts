import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb, resultRows } from "@/db/client";
import {
  financeInstruments,
  financeMovements,
  financeMarks,
  financePolicies,
  financeTheses,
  financeDecisions,
  financeResearch,
  stories as storedStories,
} from "@/db/schema";
import { hash } from "@/features/news/normalize";
import { calculatePortfolio, financeDay, replay } from "./engine";
import { financeActionSchema, movementSchema } from "./validation";
import { parseFinanceCsv } from "./csv";
import { collectCompanyFacts } from "./sec";
import type {
  FinanceData,
  Instrument,
  Movement,
  FinancePolicy,
  FinanceMark,
  FinanceThesis,
  FinanceDecision,
} from "./types";

type Reader = Pick<Awaited<ReturnType<typeof getDb>>, "select">;
async function load(reader: Reader, now = new Date()): Promise<FinanceData> {
  const [ir, mr, pr, pol, tr, dr, rr] = await Promise.all([
    reader.select().from(financeInstruments),
    reader.select().from(financeMovements),
    reader.select().from(financeMarks),
    reader.select().from(financePolicies),
    reader.select().from(financeTheses),
    reader.select().from(financeDecisions),
    reader.select().from(financeResearch),
  ]);
  const instruments = ir.map((r) => r.data),
    movements = mr.map((r) => r.data),
    marks = pr.map((r) => r.data);
  const policy = pol
    .map((r) => r.data)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return {
    instruments,
    counts: {
      movements: mr.length,
      marks: pr.length,
      theses: tr.length,
      decisions: dr.length,
      policyVersions: pol.length,
      policyBytes: Buffer.byteLength(JSON.stringify(pol)),
    },
    movements,
    marks,
    policy,
    theses: tr
      .map((r) => r.data)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    decisions: dr
      .map((r) => r.data)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    research: rr
      .map((r) => r.data)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)),
    summary: calculatePortfolio(instruments, movements, marks, policy, now),
  };
}
export function boundedFinanceView(data: FinanceData): FinanceData {
  const result: FinanceData = {
    ...data,
    counts: {
      ...data.counts,
      movements: data.movements.length,
      marks: data.marks.length,
      theses: data.theses.length,
      decisions: data.decisions.length,
    },
    movements: [...data.movements]
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          b.createdAt.localeCompare(a.createdAt),
      )
      .slice(0, 320),
    marks: [...data.marks]
      .sort(
        (a, b) =>
          b.asOf.localeCompare(a.asOf) ||
          b.capturedAt.localeCompare(a.capturedAt),
      )
      .slice(0, 80),
    theses: data.theses.slice(0, 40),
    decisions: data.decisions.slice(0, 20),
    research: data.research.slice(0, 20),
  };
  result.viewLimited =
    result.movements.length < data.movements.length ||
    result.marks.length < data.marks.length ||
    result.theses.length < data.theses.length ||
    result.decisions.length < data.decisions.length ||
    result.research.length < data.research.length;
  const arrays = [
    result.decisions,
    result.theses,
    result.movements,
    result.marks,
    result.research,
  ];
  while (Buffer.byteLength(JSON.stringify(result)) > 1_500_000) {
    const list = arrays.find((a) => a.length > 0);
    if (!list) break;
    list.pop();
    result.viewLimited = true;
  }
  return result;
}
export async function getFinanceData(full = false, now = new Date()) {
  const db = await getDb();
  const data = await load(db, now);
  if (data.instruments.length) {
    const articles = (await db.select().from(storedStories))
      .map((r) => r.data)
      .filter((s) => Date.parse(s.publishedAt) <= now.getTime())
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    data.relatedNews = data.instruments.flatMap((i) =>
      articles
        .filter(
          (s) =>
            s.companies.includes(i.symbol) ||
            (i.name.length > 4 &&
              `${s.originalTitle ?? s.title} ${s.excerpt}`
                .toLowerCase()
                .includes(i.name.toLowerCase())),
        )
        .slice(0, 3)
        .map((s) => ({
          instrumentId: i.id,
          title: s.title,
          url: s.url,
          sourceName: s.sourceName,
          publishedAt: s.publishedAt,
        })),
    );
  }
  return full ? data : boundedFinanceView(data);
}
function checkStorage(data: FinanceData) {
  if (
    Buffer.byteLength(JSON.stringify(data)) + (data.counts?.policyBytes ?? 0) >
    50_000_000
  )
    throw new Error(
      "Se alcanzó el límite de archivo financiero. Exporta el historial y revisa capacidad; no se borraron datos ni se contrató un plan.",
    );
}
function movementRecord(
  input: ReturnType<typeof movementSchema.parse>,
  at: string,
): Movement {
  const { reference, ...fields } = input;
  return {
    ...fields,
    id: hash(`finance-movement:${reference ?? JSON.stringify(fields)}`),
    createdAt: at,
  };
}
function checkDuplicate(old: Movement, newMovement: Movement) {
  const canonical = (movement: Movement) =>
    JSON.stringify(
      Object.entries(movement)
        .filter(
          ([key, value]) =>
            !["createdAt", "sequence"].includes(key) && value !== undefined,
        )
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  if (canonical(old) !== canonical(newMovement))
    throw new Error(
      "La referencia ya existe con datos diferentes. Revisa el comprobante.",
    );
}
export async function financeAction(raw: unknown) {
  const parsed = financeActionSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message ?? "Revisa los campos.");
  const input = parsed.data,
    db = await getDb(),
    at = new Date().toISOString();
  if (input.action === "research") {
    const data = await load(db),
      instrument = data.instruments.find((i) => i.id === input.instrumentId);
    if (!instrument) throw new Error("Instrumento no encontrado.");
    const recent = data.research.find((r) => r.instrumentId === instrument.id);
    if (recent && Date.now() - Date.parse(recent.capturedAt) < 6 * 3600000)
      return {
        message: "Se conserva la consulta SEC reciente para limitar consumo.",
      };
    const reservation = await db.execute(
      sql`INSERT INTO usage(key,amount) VALUES (${`finance-sec:${financeDay()}`},1) ON CONFLICT(key) DO UPDATE SET amount=usage.amount+1 WHERE usage.amount<6 RETURNING key`,
    );
    if (!resultRows(reservation).length)
      throw new Error(
        "Cuota diaria de investigación alcanzada; conserva tus fuentes anteriores.",
      );
    const research = await collectCompanyFacts(instrument);
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(7202633)`);
      const old = await load(tx);
      checkStorage({ ...old, research: [...old.research, research] });
      await tx
        .insert(financeResearch)
        .values({ id: research.id, data: research })
        .onConflictDoNothing();
    });
    return {
      message:
        "Hechos SEC guardados con período, fecha de publicación y fuente.",
    };
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7202633)`);
    const data = await load(tx);
    checkStorage(data);
    if (input.action === "instrument") {
      const { action: _, ...fields } = input; // eslint-disable-line @typescript-eslint/no-unused-vars
      const id = hash(
        `instrument:${fields.symbol.toUpperCase()}:${fields.exchange.toUpperCase()}:${fields.currency}`,
      );
      const old = data.instruments.find((i) => i.id === id);
      if (!old && data.instruments.length >= 8)
        throw new Error(
          "La primera versión permite ocho instrumentos. Mantén una lista enfocada.",
        );
      const instrument: Instrument = {
        ...fields,
        id,
        symbol: fields.symbol.toUpperCase(),
        exchange: fields.exchange.toUpperCase(),
        createdAt: old?.createdAt ?? at,
      };
      const instruments = [
        ...data.instruments.filter((i) => i.id !== id),
        instrument,
      ];
      replay(instruments, data.movements, financeDay());
      await tx
        .insert(financeInstruments)
        .values({ id, data: instrument })
        .onConflictDoUpdate({
          target: financeInstruments.id,
          set: { data: instrument },
        });
      return {
        message: old
          ? "Instrumento actualizado; el diario conserva sus capturas anteriores."
          : "Instrumento registrado.",
        instrumentId: id,
      };
    }
    if (input.action === "movement" || input.action === "import") {
      const entries =
        input.action === "import"
          ? parseFinanceCsv(input.csv, data.instruments)
          : [movementSchema.parse(input)];
      const known = new Map(data.movements.map((m) => [m.id, m]));
      const added: Movement[] = [];
      const previousSequence = Math.max(
        0,
        ...data.movements.map((m) => m.sequence ?? 0),
      );
      for (const entry of entries) {
        const m = {
          ...movementRecord(entry, at),
          sequence: previousSequence + added.length + 1,
        };
        const previous = known.get(m.id);
        if (previous) {
          checkDuplicate(previous, m);
          continue;
        }
        known.set(m.id, m);
        added.push(m);
      }
      if (known.size > 2000)
        throw new Error(
          "Máximo 2,000 movimientos en esta etapa; el archivo anterior se conserva.",
        );
      // Replay the full ledger, including backdated imports, before any insert.
      replay(data.instruments, [...known.values()], financeDay());
      checkStorage({ ...data, movements: [...known.values()] });
      for (const m of added)
        await tx.insert(financeMovements).values({ id: m.id, data: m });
      return {
        message: `${added.length} movimientos guardados; ${entries.length - added.length} referencias repetidas omitidas.`,
        added: added.length,
      };
    }
    if (input.action === "reverse") {
      const original = data.movements.find((m) => m.id === input.movementId);
      if (!original || original.reversesId)
        throw new Error("Movimiento original no encontrado.");
      if (data.movements.some((m) => m.reversesId === original.id))
        return { message: "La corrección ya está guardada." };
      if (data.movements.length >= 2000)
        throw new Error(
          "Límite de archivo alcanzado. Exporta antes de ampliar capacidad.",
        );
      const reversed: Movement = {
        ...original,
        id: hash(`reverse:${original.id}`),
        reversesId: original.id,
        note: input.note,
        createdAt: at,
        date: original.date,
      };
      const movements = [...data.movements, reversed];
      replay(data.instruments, movements, financeDay());
      await tx
        .insert(financeMovements)
        .values({ id: reversed.id, data: reversed });
      return {
        message:
          "Corrección guardada. El movimiento original y las decisiones previas se conservan.",
      };
    }
    if (input.action === "mark") {
      if (
        input.kind === "price" &&
        !data.instruments.some((i) => i.id === input.instrumentId)
      )
        throw new Error("Instrumento no encontrado.");
      if (data.marks.length >= 1000)
        throw new Error(
          "Máximo 1,000 valoraciones en esta etapa. No se borró el archivo.",
        );
      const { action: _, ...fields } = input; // eslint-disable-line @typescript-eslint/no-unused-vars
      const mark: FinanceMark = {
        ...fields,
        id: randomUUID(),
        instrumentId: input.kind === "fx" ? undefined : input.instrumentId,
        capturedAt: at,
      };
      checkStorage({ ...data, marks: [...data.marks, mark] });
      await tx.insert(financeMarks).values({ id: mark.id, data: mark });
      return {
        message:
          "Valoración fechada guardada; no sustituye el precio ejecutado.",
      };
    }
    if (input.action === "policy") {
      const history = await tx.select().from(financePolicies);
      if (history.length >= 200)
        throw new Error(
          "Máximo 200 versiones de política. El historial se conserva.",
        );
      if (
        Buffer.byteLength(JSON.stringify(data)) +
          Buffer.byteLength(JSON.stringify(history)) >
        49_000_000
      )
        throw new Error(
          "Archivo cerca del límite: exporta antes de ampliar capacidad.",
        );
      if (
        input.targets.some(
          (t) =>
            !["CASH_MXN", "CASH_USD"].includes(t.instrumentId) &&
            !data.instruments.some((i) => i.id === t.instrumentId),
        )
      )
        throw new Error(
          "La distribución contiene un instrumento no registrado.",
        );
      if (
        new Set(input.targets.map((t) => t.instrumentId)).size !==
        input.targets.length
      )
        throw new Error("No repitas instrumentos en la distribución.");
      if (
        input.approved &&
        (!input.targets.length ||
          Math.round(input.targets.reduce((s, t) => s + t.weight * 100, 0)) !==
            10000)
      )
        throw new Error(
          "Para aprobar, los pesos deben sumar exactamente 100%.",
        );
      const policy: FinancePolicy = {
        monthlyContributionMxn: input.monthlyContributionMxn,
        targets: input.targets,
        approved: input.approved,
        updatedAt: at,
      };
      await tx
        .insert(financePolicies)
        .values({ id: randomUUID(), data: policy });
      return {
        message: input.approved
          ? "Política guardada y aprobada. Las propuestas requieren revisión manual."
          : "Borrador guardado; no se propone una compra hasta aprobarlo.",
      };
    }
    if (input.action === "thesis") {
      if (!data.instruments.some((i) => i.id === input.instrumentId))
        throw new Error("Instrumento no encontrado.");
      if (data.theses.length >= 200)
        throw new Error(
          "Límite de versiones de tesis alcanzado. Se conserva el historial.",
        );
      const { action: _, ...fields } = input; // eslint-disable-line @typescript-eslint/no-unused-vars
      const thesis: FinanceThesis = {
        ...fields,
        id: randomUUID(),
        createdAt: at,
      };
      checkStorage({ ...data, theses: [...data.theses, thesis] });
      await tx.insert(financeTheses).values({ id: thesis.id, data: thesis });
      return { message: "Nueva versión de tesis guardada con sus fuentes." };
    }
    if (input.action === "decision") {
      const action = input.decision ?? input.actionText;
      if (!action) throw new Error("Describe la decisión.");
      if (data.decisions.length >= 200)
        throw new Error(
          "Límite de decisiones alcanzado. Exporta antes de ampliar capacidad.",
        );
      const latest = new Map<string, FinanceMark>();
      for (const m of [...data.marks].sort(
        (a, b) =>
          a.asOf.localeCompare(b.asOf) ||
          a.capturedAt.localeCompare(b.capturedAt),
      ))
        latest.set(m.kind === "fx" ? "FX" : m.instrumentId!, m);
      const decision: FinanceDecision = {
        id: randomUUID(),
        date: input.date,
        action,
        reason: input.reason,
        alternatives: input.alternatives,
        revisitWhen: input.revisitWhen,
        createdAt: at,
        snapshot: {
          summary: data.summary,
          policy: data.policy,
          marks: [...latest.values()],
          instruments: data.instruments,
          theses: data.instruments.flatMap((i) =>
            data.theses.filter((t) => t.instrumentId === i.id).slice(0, 1),
          ),
          research: data.instruments.flatMap((i) =>
            data.research.filter((r) => r.instrumentId === i.id).slice(0, 1),
          ),
        },
      };
      checkStorage({ ...data, decisions: [...data.decisions, decision] });
      await tx
        .insert(financeDecisions)
        .values({ id: decision.id, data: decision });
      return {
        message:
          "Decisión guardada con la información disponible hoy. Una revisión nueva conserva esta captura.",
      };
    }
    throw new Error("Acción desconocida.");
  });
}
export async function exportFinance() {
  const data = await getFinanceData(true);
  return [
    "# Noticiero · portafolio privado",
    `Exportado ${new Date().toISOString()}. Registro de seguimiento, no estado fiscal ni orden de inversión.`,
    "## Valoración",
    JSON.stringify(data.summary, null, 2),
    "## Archivo completo",
    JSON.stringify(data, null, 2),
  ].join("\n\n");
}
