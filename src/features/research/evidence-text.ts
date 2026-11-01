import { plainText } from "@/features/news/normalize";

/** Keep paragraph boundaries before the general display excerpt flattens HTML. */
export function authoredHtml(value: string): string {
  return authoredText(
    value
      .replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi, " ")
      .replace(
        /(?:^|<p\b[^>]*>)\s*<i\b[^>]*>[\s\S]*?<\/i>\s*(?=<p\b|$)/gi,
        "\n",
      )
      .replace(/<\/?(?:p|div|br)\b[^>]*>/gi, "\n")
      .split("\n")
      .map(plainText)
      .join("\n"),
  );
}

/** Text attributed to the current author; quoted/copyable templates are not a new experience. */
export function authoredText(value: string): string {
  return value
    .replace(
      /\b(?:\w+\s+)?(?:wrote|writes|said|says|quoted|escribio|escribió|dijo|dice)\s*:\s*["“][^"”]*["”]/gi,
      " ",
    )
    .replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi, " ")
    .replace(/<!--[^]*?-->/g, " ")
    .replace(/```[^]*?(?:```|$)/g, " ")
    .replace(/~~~[^]*?(?:~~~|$)/g, " ")
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^\s*(?:>|&gt;)/i.test(line) &&
        !/^\s*(?:#{1,6}\s|[-*]\s*\[[ xX]\])/.test(line) &&
        !/^(?:\s*)(?:if you need help|please (?:share|provide|describe)|share (?:the|your) (?:output|workflow)|steps to reproduce|to reproduce|expected behavior|additional context|system information|environment information|operating system|version:)\b/i.test(
          line,
        ),
    )
    .join("\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\t ]+/g, " ")
    .trim();
}

export const normalizedText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

export const rolePattern =
  /\b(?:(?:as an?|i (?:am|work as)|we are)\s+(?:an?\s+)?(?:accountant|developer|engineer|teacher|designer|shop owner|retailer|bookkeeper|freelancer)|(?:soy|somos|trabajo como)\s+(?:un[ao]?\s+)?(?:contador[ao]?|contable|desarrollador[ao]?|ingenier[oa]|docente|profesor[ao]?|comerciante|autonom[oa]))\b/i;

export function isSpeculation(text: string) {
  return /\b(?:are we (?:all )?going to|will (?:we|it) (?:all |just )?|imagine (?:if|we)|what if|maybe (?:we|i) (?:could|will)|quizas (?:podriamos|podria)|que pasaria si)\b/i.test(
    text,
  );
}
