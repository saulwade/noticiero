import type { DashboardData, Story } from "./types";
import { allSourceDefinitions } from "@/features/sources/registry";
export function demoData(): DashboardData {
  const now = new Date().toISOString();
  const sample = (
    id: string,
    title: string,
    category: Story["category"],
    companies: string[],
    summary: string,
    why: string,
  ): Story => ({
    id,
    title,
    category,
    companies,
    summary,
    why,
    sourceId: "demo",
    sourceName: "Ejemplo editorial",
    url: "https://news.ycombinator.com",
    publishedAt: now,
    detectedAt: now,
    excerpt: summary,
    coverage: "excerpt",
    analysis: "ready",
    score: 0,
    references: [
      { name: "Vista de demostración", url: "https://news.ycombinator.com" },
    ],
    contentHash: id,
  });
  return {
    stories: [
      sample(
        "demo-ai",
        "La siguiente oportunidad de la IA está en los problemas de todos los días",
        "IA",
        ["MSFT", "OPENAI", "GOOGL"],
        "Ejemplo de cómo se verá tu briefing: un resumen breve que conecta un cambio tecnológico con sus consecuencias para usuarios y empresas. Aquí aparecerán los hechos de la noticia original, traducidos al español y con referencias para profundizar.",
        "La mejor señal puede ser un problema pequeño y repetido que todavía nadie está resolviendo bien.",
      ),
      {
        ...sample(
          "demo-chips",
          "Más allá del chip: el ecosistema que hace posible la infraestructura de IA",
          "Chips",
          ["NVDA", "AMD", "TSM"],
          "Este contenido ilustra la distribución del dashboard. Al actualizar, será reemplazado por noticias reales de las fuentes que actives. Los movimientos de bolsa aparecerán únicamente cuando conectes un proveedor de cotizaciones.",
          "Infraestructura, eficiencia energética y herramientas para desarrolladores pueden abrir nuevos espacios de producto.",
        ),
        imageUrl: "/sample-infrastructure.svg",
        imageCredit: "Ilustración de ejemplo",
      },
      sample(
        "demo-startup",
        "De una conversación en Hacker News a una idea que vale la pena validar",
        "Startups",
        [],
        "Un problema recurrente en una comunidad puede convertirse en una hipótesis de negocio. El dashboard reunirá las señales disponibles y propondrá un experimento pequeño antes de construir un producto completo.",
        "Las oportunidades se acompañan de evidencia y una forma concreta de ponerlas a prueba.",
      ),
    ],
    opportunities: [
      {
        id: "demo-idea",
        title: "Un copiloto para el trabajo que nadie quiere hacer",
        problem:
          "Ejemplo: equipos pequeños que repiten tareas manuales entre varias herramientas.",
        customer: "Un equipo de operaciones con procesos repetitivos.",
        proposal:
          "Automatizar un solo flujo frecuente, con revisión humana y trazabilidad.",
        mvp: "Conectar dos herramientas y resolver un flujo durante una semana.",
        experiment:
          "Entrevistar a cinco equipos y acompañar uno de sus procesos.",
        successSignal: "Propuesta: que dos equipos acepten probar un piloto.",
        whyNow:
          "Esta ficha es ilustrativa; las ideas reales se basan en noticias recopiladas.",
        evidence: [
          {
            storyId: "demo-ai",
            reason: "Ejemplo de vínculo entre una señal y una hipótesis.",
          },
        ],
        difficulty: "Media",
        confidence: "Exploratoria",
        caveat: "Ejemplo de interfaz. No representa demanda validada.",
        createdAt: now,
      },
    ],
    quotes: [],
    research: {
      documentsTracked: 3,
      signals: [
        {
          id: "demo-signal",
          storyId: "demo-startup",
          quote:
            "Ejemplo de interfaz: necesito una forma de conciliar facturas sin copiar registros a mano.",
          kind: "request",
          sourceName: "Señal ficticia de demostración",
          url: "https://news.ycombinator.com",
          title: "Ejemplo de solicitud",
          author: "autor-de-ejemplo",
          independenceKey: "demo:one",
          terms: ["factura", "conciliar"],
          occurredAt: now,
          detectedAt: now,
        },
      ],
      notes: [
        {
          id: "demo-note",
          label: "Ejemplo: conciliación de facturas",
          keywords: ["facturas", "trabajo manual"],
          firstSeen: now,
          lastSeen: now,
          signalIds: ["demo-signal"],
          independentVoices: 1,
          status: "isolated",
          journal: [{ date: now.slice(0, 10), added: 1, totalVoices: 1 }],
        },
      ],
      reports: [],
    },
    sources: allSourceDefinitions.map((s) => ({
      id: s.id,
      name: s.name,
      status: "pending",
      count: 0,
    })),
    editions: [],
    saved: [],
    readIds: [],
    configuration: {
      ai: false,
      analysisMode: "local",
      market: false,
      storage: "local",
      hosted: false,
      monthlyBudget: 10,
      spent: 0,
    },
    demo: true,
  };
}
