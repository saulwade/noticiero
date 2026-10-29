export const feeds = [
  {
    id: "cnbc-finance",
    name: "CNBC · Finanzas",
    url: "https://www.cnbc.com/id/10000664/device/rss/rss.html",
    site: "https://www.cnbc.com/finance/",
    description: "Banca, mercados y servicios financieros.",
    color: "#6b8b87",
    initials: "CN",
    category: "Finanzas",
  },
  {
    id: "fed",
    name: "Reserva Federal",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
    site: "https://www.federalreserve.gov",
    description:
      "Comunicados oficiales de política monetaria y supervisión bancaria; contexto regulatorio.",
    color: "#8b9272",
    initials: "FR",
    category: "Finanzas",
  },
  {
    id: "banking-dive",
    name: "Banking Dive",
    url: "https://www.bankingdive.com/feeds/news/",
    site: "https://www.bankingdive.com",
    description:
      "Bancos, pagos, fintech y cambios en los servicios financieros.",
    color: "#658f9a",
    initials: "BD",
    category: "Finanzas",
  },
  {
    id: "smallbiz",
    name: "Small Business Trends",
    url: "https://smallbiztrends.com/feed/",
    site: "https://smallbiztrends.com",
    description:
      "Procesos, herramientas y operaciones de pequeñas empresas; contexto editorial.",
    color: "#a18e6a",
    initials: "SB",
    category: "Operaciones",
  },
  {
    id: "yc",
    name: "Y Combinator",
    url: "https://www.ycombinator.com/blog/feed",
    site: "https://www.ycombinator.com/blog",
    description:
      "Historias de fundadores, aprendizajes y novedades del ecosistema YC.",
    color: "#c87f43",
    initials: "YC",
  },
  {
    id: "ars",
    name: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    site: "https://arstechnica.com",
    description: "Tecnología, ciencia y el contexto detrás de los titulares.",
    color: "#d66d45",
    initials: "ars",
  },
  {
    id: "verge",
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    site: "https://www.theverge.com",
    description: "La intersección de tecnología, cultura y negocios.",
    color: "#8263a7",
    initials: "V",
  },
  {
    id: "techcrunch",
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    site: "https://techcrunch.com",
    description: "Startups, inversión y nuevos productos.",
    color: "#43815a",
    initials: "TC",
  },
  {
    id: "wired",
    name: "WIRED",
    url: "https://www.wired.com/feed/rss",
    site: "https://www.wired.com",
    description: "Cómo la tecnología está cambiando nuestro mundo.",
    color: "#697376",
    initials: "W",
  },
] as const;
export const allSourceDefinitions = [
  {
    id: "hn",
    name: "Hacker News",
    site: "https://news.ycombinator.com",
    description: "Lo que están leyendo y construyendo los desarrolladores.",
    color: "#cf7c42",
    initials: "Y",
  },
  {
    id: "ask-hn",
    name: "Ask HN · problemas reales",
    site: "https://news.ycombinator.com/ask",
    description:
      "Preguntas, búsquedas de herramientas y respuestas públicas de usuarios.",
    color: "#b18350",
    initials: "?",
  },
  {
    id: "show-hn",
    name: "Show HN · nuevas soluciones",
    site: "https://news.ycombinator.com/show",
    description:
      "Productos de desarrolladores y conversaciones sobre los problemas que resuelven.",
    color: "#8a9b65",
    initials: "S",
  },
  {
    id: "yc-rfs",
    name: "YC · Requests for Startups",
    site: "https://www.ycombinator.com/rfs",
    description:
      "Áreas que YC propone explorar. Contexto editorial, separado de la demanda observada.",
    color: "#c88d52",
    initials: "YC",
  },
  ...feeds,
];
export const optionalSources = [
  {
    name: "Product Hunt",
    description: "Lanzamientos y señales de nuevos mercados",
    requirement: "Token de la API de Product Hunt",
  },
  {
    name: "Reddit",
    description: "Problemas reales y conversaciones de usuarios",
    requirement: "Aprobación de acceso y OAuth",
  },
  {
    name: "X / Twitter",
    description: "Anuncios y cuentas seleccionadas",
    requirement: "Acceso a la API y presupuesto por consumo",
  },
  {
    name: "NYT / WSJ",
    description: "Cobertura editorial y financiera",
    requirement: "API, feed permitido o licencia según la fuente",
  },
];
