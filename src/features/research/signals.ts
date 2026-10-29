import type { ResearchSignal, Story } from "@/lib/types";
import { hash } from "@/features/news/normalize";
import { terms } from "./vector";

const request =
  /\b(looking for|is there (?:a|any)|does anyone|any (?:tool|recommendation|alternative)|(?:can|could|would) (?:anyone|someone|you) recommend|please recommend|need (?:a|an|some|help)|wish (?:there|i|we)|busco|necesito|alguien (?:conoce|sabe)|existe alguna|alternativa a)\b/i;
const pain =
  /\b(struggl\w*|frustrat\w*|painful|can['’]t|cannot|doesn['’]t work|too expensive|wast(?:e|ing) (?:time|hours)|takes? (?:me |us )?(?:hours|days)|tired of|fed up|me cuesta|demasiado caro|pierdo (?:tiempo|horas)|no puedo|me frustra|cansado de)\b/i;
const workaround =
  /\b(manually|manualmente|workaround|copy.{0,12}paste|copiar.{0,12}pegar|spreadsheet|spreadsheets|hoja de calculo)\b/i;
const personal =
  /\b(i|we|my|our|anyone|yo|nosotros|mi|nuestro|alguien|busco|necesito|me)\b/i;
const processContext =
  /\b(tool\w*|app\w*|software|platform\w*|service\w*|account\w*|login|export\w*|import\w*|data|database\w*|code|coding|developer\w*|api\w*|ai|llm\w*|token\w*|invoice\w*|billing|payment\w*|bank\w*|budget\w*|cost\w*|pricing|spreadsheet\w*|record\w*|document\w*|file\w*|workflow\w*|automat\w*|manual\w*|integrat\w*|reconcil\w*|transcri\w*|meeting\w*|security|herramienta\w*|cuenta\w*|factura\w*|pago\w*|costo\w*|precio\w*|archivo\w*|proceso\w*|reunion\w*)\b/i;
const firstPersonBlock = /\b(?:i|we) (?:can['’]t|cannot)\b|\bno puedo\b/i;
export function classifySignal(
  sentence: string,
): ResearchSignal["kind"] | undefined {
  if (
    !personal.test(sentence) ||
    !processContext.test(sentence) ||
    /\b(?:cannot|can['’]t) recommend\b/i.test(sentence)
  )
    return;
  if (request.test(sentence)) return "request";
  // A generic "you can't" in advice does not describe the author's own obstacle.
  if (
    pain.test(sentence) &&
    (!/\b(can['’]t|cannot)\b/i.test(sentence) ||
      firstPersonBlock.test(sentence))
  )
    return "pain";
  if (workaround.test(sentence)) return "workaround";
}
export function extractSignals(
  story: Story,
  now = new Date(),
): ResearchSignal[] {
  // Community statements are demand signals; editorial news and YC RFS are context only.
  if (story.kind !== "question" && story.kind !== "comment") return [];
  // A reply must speak for itself: the parent's request is not the reply author's claim.
  const content =
    story.kind === "comment"
      ? story.excerpt
      : `${story.originalTitle ?? story.title}. ${story.excerpt}`;
  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 25 && part.length < 2500);
  const seen = new Set<string>();
  return sentences
    .flatMap((sentence) => {
      const kind = classifySignal(sentence);
      if (!kind) return [];
      const quote =
        sentence.length > 650 ? `${sentence.slice(0, 647)}…` : sentence;
      const id = hash(`${story.id}:${quote.toLowerCase()}`);
      if (seen.has(id)) return [];
      seen.add(id);
      return [
        {
          id,
          storyId: story.id,
          quote,
          kind,
          sourceName: story.sourceName,
          url: story.url,
          title: story.originalTitle ?? story.title,
          author: story.author,
          independenceKey: story.author
            ? `hn:${story.author.toLowerCase()}`
            : `source:${story.url}`,
          terms: terms(quote),
          occurredAt: story.publishedAt,
          detectedAt: now.toISOString(),
        },
      ];
    })
    .slice(0, 3);
}
