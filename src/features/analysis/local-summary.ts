import type { Story } from "@/lib/types";
import { plainText } from "@/features/news/normalize";

export const LOCAL_SUMMARY_VERSION = "extractive-v1";
const MAX_SENTENCES = 3;
const MAX_CHARACTERS = 900;
const MAX_CANDIDATES = 80;
const stopwords = new Set(
  "the a an and or but this that these those it its is are was were be been being to of for from in on at by with as you your we our they their he she his her has have had will would can could should about into than then when while how what which who also more most not no says said el la los las un una unos unas y o pero de del al a en para por con sin es son fue fueron ser se su sus que como cuando donde este esta estos estas eso lo le les ha han tiene tienen hay muy más mas no dijo dice también tambien sobre entre cada nuestro nuestra nuestros nuestras".split(
    " ",
  ),
);
const event =
  /\b(announc\w*|launch\w*|unveil\w*|acquir\w*|approv\w*|confirm\w*|report\w*|rais\w*|introduc\w*|releas\w*|cancel\w*|reject\w*|delay\w*|chang\w*|cut\w*|reduc\w*|anunci\w*|lanz\w*|present\w*|adquiri\w*|aprobo|aprobar\w*|confirm\w*|public\w*|recaud\w*|cancel\w*|rechaz\w*|retras\w*|redu\w*)\b/i;
const consequence =
  /\b(cost\w*|price\w*|pay\w*|contract\w*|customer\w*|engineer\w*|revenue\w*|profit\w*|affect\w*|available|start\w*|begin\w*|effective|includ\w*|because|costo\w*|precio\w*|pago\w*|cobr\w*|contrato\w*|cliente\w*|ingreso\w*|afect\w*|disponible|vigor|aplicar\w*|aplicara|inclu\w*|porque|únicamente|unicamente|only)\b/i;
const negation =
  /\b(no|not|never|cannot|can't|won't|without|sin|nunca|tampoco)\b/i;
const genericIntro =
  /(?:eventful year|many years|years of covering|llevamos muchos|muchos años|desde hace años|in today's (?:world|landscape)|ever.evolving|rapidly evolving)/i;
const promotional =
  /(?:^(?:subscribe|suscr[ií]bete|sign up|register now|read the full story|read more at|continue reading|lee la noticia completa|leer m[aá]s|sigue leyendo)\b|\b(?:subscribe to our newsletter|suscr[ií]bete a nuestro|the post .{0,180} appeared first on|all rights reserved|todos los derechos reservados)\b)/i;

function tokens(text: string): string[] {
  return (
    text
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .match(/[\p{L}\p{N}]{3,}/gu)
      ?.filter((word) => !stopwords.has(word)) ?? []
  );
}
function overlap(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared / Math.max(1, Math.min(a.size, b.size));
}
function language(text: string): "es" | "en" | "unknown" {
  const spanish =
    text.match(
      /\b(el|la|los|las|una|para|del|que|con|por|anunci[oó]|compa[ñn][ií]a|servicio|mes)\b/gi,
    )?.length ?? 0;
  const english =
    text.match(
      /\b(the|and|with|for|from|will|said|company|announced|service|month)\b/gi,
    )?.length ?? 0;
  return spanish > english && spanish >= 2
    ? "es"
    : english > spanish && english >= 2
      ? "en"
      : "unknown";
}

/** Selects whole attributed sentences. It never translates or generates claims. */
export function extractiveDigest(
  raw: string,
  title: string,
):
  | { text: string; sentences: string[]; language: "es" | "en" | "unknown" }
  | undefined {
  let cleaned = plainText(raw.slice(0, 18000));
  // Publisher captions commonly precede the body with a vertical separator.
  cleaned = cleaned.replace(
    /^(?:photo|image|illustration|foto|imagen|cr[eé]dito)[^|]{0,180}\|\s*/i,
    "",
  );
  const seen = new Set<string>();
  const candidates = [
    ...new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(
      cleaned,
    ),
  ]
    .map(({ segment }) => segment.trim())
    .filter((sentence) => {
      const key = sentence.toLocaleLowerCase().replace(/\s+/g, " ");
      if (
        sentence.length < 35 ||
        sentence.length > MAX_CHARACTERS ||
        promotional.test(sentence) ||
        /^(?:photo|image|illustration|foto|imagen|cr[eé]dito)\s*:/i.test(
          sentence,
        ) ||
        seen.has(key)
      )
        return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_CANDIDATES)
    .map((sentence, index) => ({
      sentence,
      index,
      words: new Set(tokens(sentence)),
      score: 0,
    }));
  if (!candidates.length) return;
  const titleWords = new Set(tokens(title));
  const frequency = new Map<string, number>();
  for (const candidate of candidates)
    for (const word of candidate.words)
      frequency.set(word, (frequency.get(word) ?? 0) + 1);
  for (const candidate of candidates) {
    const titleMatches = [...candidate.words].filter((word) =>
      titleWords.has(word),
    ).length;
    const centrality =
      [...candidate.words].reduce(
        (sum, word) => sum + Math.log1p(frequency.get(word) ?? 0),
        0,
      ) / Math.max(1, candidate.words.size);
    candidate.score =
      Math.min(5, titleMatches * 1.4) +
      centrality +
      (event.test(candidate.sentence) ? 3 : 0) +
      (consequence.test(candidate.sentence) ? 2 : 0) +
      (/\d/.test(candidate.sentence) ? 1.7 : 0) +
      (negation.test(candidate.sentence) ? 1.3 : 0) -
      (genericIntro.test(candidate.sentence) ? 6 : 0);
  }
  const selected: typeof candidates = [];
  const ranked = [...candidates].sort(
    (a, b) => b.score - a.score || a.index - b.index,
  );
  let length = 0;
  while (selected.length < MAX_SENTENCES) {
    let best: (typeof candidates)[number] | undefined;
    let bestScore = 1;
    for (const candidate of ranked) {
      if (
        selected.includes(candidate) ||
        length + candidate.sentence.length + (selected.length ? 1 : 0) >
          MAX_CHARACTERS
      )
        continue;
      const similarity = Math.max(
        0,
        ...selected.map((s) => overlap(candidate.words, s.words)),
      );
      if (similarity > 0.82) continue;
      const score = candidate.score - 3 * similarity;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    if (!best) break;
    selected.push(best);
    length += best.sentence.length + (selected.length > 1 ? 1 : 0);
  }
  if (!selected.length) return;
  const sentences = selected
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);
  const text = sentences.join(" ");
  return { text, sentences, language: language(text) };
}

export function summarizeLocally(story: Story): Story {
  if (
    story.kind === "comment" ||
    story.kind === "question" ||
    story.kind === "research" ||
    story.coverage === "headline" ||
    (story.summary && story.summaryMethod !== "extractive") ||
    (story.analysis === "ready" && story.summary) ||
    (story.summaryMethod === "extractive" &&
      story.summaryVersion === `${LOCAL_SUMMARY_VERSION}:${story.contentHash}`)
  )
    return story;
  const result = extractiveDigest(
    story.excerpt,
    story.originalTitle ?? story.title,
  );
  if (!result) return story;
  return {
    ...story,
    summary: result.text,
    summaryMethod: "extractive",
    summaryLanguage: result.language,
    summaryVersion: `${LOCAL_SUMMARY_VERSION}:${story.contentHash}`,
  };
}
