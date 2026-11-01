import { describe, expect, it } from "vitest";
import { classifySignal, extractSignals } from "@/features/research/signals";
import { buildDossiers, problemContext } from "@/features/evidence/engine";
import { makeStory } from "@/features/news/normalize";
import type { EvidenceRecord } from "@/features/evidence/types";
import { authoredHtml } from "@/features/research/evidence-text";
import type { Story } from "@/lib/types";
import { problemScope } from "@/features/research/problem-scope";
import { clusterSignals } from "@/features/research/cluster";
import { trainModel } from "@/features/research/vector";

const now = new Date("2026-11-01T16:00:00Z");
function record(
  id: string,
  quote: string,
  extra: Partial<EvidenceRecord> = {},
): EvidenceRecord {
  return {
    id,
    externalId: id,
    source: "hn",
    sourceName: "Ask HN",
    url: `https://news.ycombinator.com/item?id=${id}`,
    title: "Community discussion",
    quote,
    occurredAt: now.toISOString(),
    capturedAt: now.toISOString(),
    language: "en",
    kind: "community",
    authorKey: `hn:${id}`,
    ...extra,
  };
}

describe("calidad de oportunidades con evidencia propia", () => {
  it("no convierte el debate sobre programar con IA en dos necesidades", () => {
    const original =
      "I loved coding in the past, but no matter what I do at this point, I can’t find a reason to anymore that’s actually necessary";
    const reply =
      "> I can’t find a reason to anymore that’s actually necessary The huge environmental and societal cost of LLMs, maybe?";
    expect(classifySignal(original)).toBeUndefined();
    expect(classifySignal(reply)).toBeUndefined();
    expect(
      buildDossiers([record("one", original), record("two", reply)], [], now),
    ).toEqual([]);
  });
  it("retira citas Markdown y HTML, manteniendo una experiencia propia posterior", () => {
    expect(
      classifySignal("> I cannot export invoices from our accounting app."),
    ).toBeUndefined();
    expect(
      classifySignal(
        "<blockquote>I cannot export invoices from our accounting app.</blockquote> I agree.",
      ),
    ).toBeUndefined();
    expect(
      classifySignal(
        'She wrote: "I cannot export invoices from our accounting app." I agree.',
      ),
    ).toBeUndefined();
    expect(
      classifySignal(
        authoredHtml(
          "<i>I cannot export invoices from our accounting app.</i><p>I agree.</p>",
        ),
      ),
    ).toBeUndefined();
    expect(
      classifySignal(
        "If anyone is looking for invoice export software, I recommend Acme.",
      ),
    ).toBeUndefined();
    const story: Story = {
      ...makeStory({
        title: "Community",
        excerpt:
          "> I cannot export invoices from our app.\n\nWe manually reconcile invoices in spreadsheets every week.",
        url: "https://news.ycombinator.com/item?id=own",
        sourceId: "ask-hn",
        sourceName: "Ask HN",
        publishedAt: now.toISOString(),
      })!,
      kind: "comment" as const,
      author: "alice",
    };
    story.authoredExcerpt = authoredHtml(
      "&gt; I cannot export invoices from our app.<p>We manually reconcile invoices in spreadsheets every week.",
    );
    const found = extractSignals(story, now);
    expect(found).toHaveLength(1);
    expect(found[0].quote).toBe(
      "We manually reconcile invoices in spreadsheets every week.",
    );
  });
  it("rechaza opiniones, especulación y plantillas sin una necesidad propia", () => {
    for (const quote of [
      "I agree with the commenters who were jarred by the heavy use of LLMisms -- the writing was genuinely painful to read.",
      "Or are we all going to be living in AI assistant walled gardens, telling it let's order groceries, so we're not ordering things manually?",
      "<!-- If you need help with data transformations, please also share your expected output. -->\n### Share the output returned by the last node\n```\nI cannot access my account\n```",
    ])
      expect(
        problemContext(
          record("noise", quote, { source: "github", product: "n8n-io/n8n" }),
        ).accepted,
      ).toBe(false);
  });
  it("identifica el problema del caso sin llamar presupuesto a Actual Budget", () => {
    const item = record(
      "category",
      "api.updateCategory() crashes when I try to fix an invalid category with group=null.",
      {
        source: "github",
        product: "actualbudget/actual",
        title: "getCategories drops a category and updateCategory crashes",
      },
    );
    const result = problemContext(item);
    expect(result.accepted).toBe(true);
    expect(result.topic).not.toBe("Límites de consumo y presupuesto");
  });
  it("separa tareas y compradores aunque compartan producto o vocabulario", () => {
    const records = [
      record("photos", "I cannot export photos from our app.", {
        product: "Example",
      }),
      record("invoices", "I cannot export invoices from our app.", {
        product: "Example",
      }),
      record(
        "accountant",
        "As an accountant, I manually reconcile invoices every week.",
        { product: "Ledger" },
      ),
      record(
        "developer",
        "As a developer, I manually reconcile invoices every week.",
        { product: "Ledger" },
      ),
    ];
    expect(buildDossiers(records, [], now)).toHaveLength(4);
  });
  it("la misma necesidad operativa admite repetición sin mezclar países conocidos", () => {
    const a = record("a", "I cannot export invoices from our accounting app.", {
      country: "MX",
      countryBasis: "Cobertura documentada",
    });
    const b = record(
      "b",
      "We cannot export invoices from our accounting app.",
      { country: "MX", countryBasis: "Cobertura documentada" },
    );
    const c = record("c", a.quote, {
      country: "US",
      countryBasis: "Cobertura documentada",
    });
    const result = buildDossiers([a, b, c], [], now);
    expect(result).toHaveLength(2);
    expect(
      result.find((d) => d.countries.includes("MX"))?.identifiedAuthors,
    ).toBe(2);
  });
  it("no presenta 'as a reference point' como rol del comprador", () => {
    const item = record(
      "role",
      "As a reference point, I cannot export invoices from our accounting app.",
    );
    expect(problemContext(item).fields.segment).toBeUndefined();
  });
  it("preserva fricción operativa en español e inglés", () => {
    expect(
      classifySignal("No puedo exportar las facturas de nuestra aplicación."),
    ).toBe("pain");
    expect(
      classifySignal(
        "We manually copy invoice records into spreadsheets every week.",
      ),
    ).toBe("workaround");
    expect(
      classifySignal(
        "I burned through 80% of my Fable usage for the week in 10 minutes.",
      ),
    ).toBe("pain");
    for (const text of [
      "I need a tool to manage payroll for our team.",
      "I need a tool to manage inventory for my shop.",
      "We need a tool to track insurance documents.",
      "I need a tool to follow up meetings and transcriptions.",
    ])
      expect(classifySignal(text)).toBe("request");
  });
  it("una tarea específica pesa más que el nombre del documento", () => {
    expect(problemScope("I need an invoice export tool.")?.key).toBe(
      problemScope("I need a tool to export invoices.")?.key,
    );
    expect(problemScope("I need an invoice export tool.")?.task).toBe(
      "data-export",
    );
  });
  it("la identidad del cuaderno no depende del orden de filas antiguas", () => {
    const base = {
      ...makeStory({
        title: "Community",
        excerpt: "I need a tool to export invoices.",
        url: "https://news.ycombinator.com/item?id=stable",
        sourceId: "ask-hn",
        sourceName: "Ask HN",
        publishedAt: now.toISOString(),
      })!,
      kind: "comment" as const,
      author: "alice",
    };
    const signals = extractSignals(base, now),
      model = trainModel(undefined, [base], now);
    const note = clusterSignals([], signals, model, now)[0];
    const a = { ...note, id: "note-a" },
      b = { ...note, id: "note-b" };
    expect(clusterSignals([a, b], signals, model, now)).toEqual(
      clusterSignals([b, a], signals, model, now),
    );
  });
  it("cerrar un issue no inventa que el problema quedó resuelto", () => {
    const context = problemContext(
      record("closed", "I cannot export invoices from our app.", {
        source: "github",
        caseStatus: "closed",
      }),
    );
    expect(context.correction).toBe(false);
  });
  it("mencionar workflow no convierte fallos distintos en una necesidad repetida", () => {
    const items = [
      record(
        "loop",
        "Our chatbot workflow freezes in an infinite loop when I use repeat message.",
        { source: "github", product: "n8n-io/n8n" },
      ),
      record(
        "trigger",
        "Our workflow is triggered without any user prompt and the execution fails.",
        { source: "github", product: "n8n-io/n8n" },
      ),
      record(
        "payload",
        "I cannot run the workflow because the API returns Unsupported parameter: messages.",
        { source: "github", product: "n8n-io/n8n" },
      ),
      record(
        "timezone",
        "The workflow cannot be activated: Expression evaluation failed: Invalid timezone America/Dallas.",
        { source: "github", product: "n8n-io/n8n" },
      ),
    ];
    const groups = buildDossiers(items, [], now);
    expect(groups).toHaveLength(4);
    expect(groups.every((d) => d.status === "isolated")).toBe(true);
    expect(new Set(groups.map((d) => d.scope?.task)).size).toBe(4);
  });
  it("soporte o trabajo manual sin una tarea identificada permanecen aislados", () => {
    const groups = buildDossiers(
      [
        record("support-a", "I cannot get support for our app.", {
          product: "Example",
        }),
        record("support-b", "We cannot get support for our app either.", {
          product: "Example",
        }),
      ],
      [],
      now,
    );
    expect(groups).toHaveLength(2);
    expect(groups.every((d) => d.status === "isolated")).toBe(true);
  });
});
