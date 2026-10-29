import type { ResearchModel, ResearchNote, ResearchSignal } from "@/lib/types";
import { hash } from "@/features/news/normalize";
import { editionFor } from "@/lib/time";
import { cosine, keywords, vector } from "./vector";

export function topicLabel(tokens: string[]) {
  const set = new Set(tokens);
  if (set.has("ia") && (set.has("coste") || set.has("token")))
    return "Costos y control de uso de IA";
  if (set.has("factura")) return "Facturación y conciliación de documentos";
  if (set.has("nomina")) return "Nómina y operaciones de personal";
  if (set.has("pago") || set.has("banca") || set.has("credito"))
    return "Pagos y acceso a servicios financieros";
  if (set.has("contabilidad")) return "Contabilidad y conciliación";
  if (set.has("inventario") || set.has("logistica"))
    return "Inventario y logística de pequeñas empresas";
  if (set.has("seguro")) return "Procesos de seguros";
  if (set.has("transcripcion") || set.has("reunion"))
    return "Seguimiento de reuniones y transcripciones";
  if (set.has("integracion")) return "Integraciones entre herramientas";
  if (set.has("seguridad")) return "Seguridad en flujos de trabajo";
  if (set.has("documento")) return "Procesamiento de documentos";
  if (set.has("hoja") || set.has("flujo"))
    return "Trabajo manual y hojas de cálculo";
  return `Señales sobre ${tokens.slice(0, 3).join(" · ") || "un proceso por investigar"}`;
}
export function clusterSignals(
  previous: ResearchNote[],
  signals: ResearchSignal[],
  model: ResearchModel,
  now = new Date(),
): ResearchNote[] {
  const notes = previous.map((note) => ({
    ...note,
    signalIds: [...note.signalIds],
    journal: note.journal.map((entry) => ({ ...entry })),
  }));
  const allSignals = new Map(signals.map((signal) => [signal.id, signal]));
  const assigned = new Set(notes.flatMap((note) => note.signalIds));
  const date = editionFor(now).date;
  for (const signal of signals) {
    if (assigned.has(signal.id)) continue;
    const candidate = vector(signal.terms, model);
    let best: ResearchNote | undefined;
    let bestSimilarity = 0.3;
    for (const note of notes) {
      const members = note.signalIds.flatMap(
        (id) => allSignals.get(id)?.terms ?? [],
      );
      const shared = [...new Set(signal.terms)].filter((token) =>
        note.keywords.includes(token),
      ).length;
      const similarity = cosine(
        candidate,
        vector(members.length ? members : note.keywords, model),
      );
      if (shared >= 2 && similarity >= bestSimilarity) {
        best = note;
        bestSimilarity = similarity;
      }
    }
    if (!best) {
      best = {
        id: `research-${hash(signal.id)}`,
        label: topicLabel(signal.terms),
        keywords: keywords(signal.terms, model),
        firstSeen: signal.detectedAt,
        lastSeen: signal.detectedAt,
        signalIds: [],
        independentVoices: 0,
        status: "isolated",
        journal: [],
      };
      notes.push(best);
    }
    best.signalIds.push(signal.id);
    assigned.add(signal.id);
    best.lastSeen = signal.detectedAt;
    const members = best.signalIds.flatMap((id) =>
      allSignals.get(id) ? [allSignals.get(id)!] : [],
    );
    best.keywords = keywords(
      members.flatMap((member) => member.terms),
      model,
    );
    best.independentVoices = new Set(
      members
        .filter((member) => member.author)
        .map((member) => member.independenceKey),
    ).size;
    best.status = best.independentVoices >= 2 ? "repeated" : "isolated";
    const entry = best.journal.find((item) => item.date === date);
    if (entry) {
      entry.added++;
      entry.totalVoices = best.independentVoices;
    } else
      best.journal.push({
        date,
        added: 1,
        totalVoices: best.independentVoices,
      });
  }
  return notes.sort(
    (a, b) =>
      b.independentVoices - a.independentVoices ||
      b.lastSeen.localeCompare(a.lastSeen),
  );
}
