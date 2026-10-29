"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  FlaskConical,
  Lightbulb,
  Menu,
  Newspaper,
  RefreshCw,
  Rss,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  X,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { NewsCard } from "./news-card";
import { CompanyPanel } from "./company-panel";
import { IdeaCard, OpportunityPanel } from "./opportunity-panel";
import { SettingsView, SourcesView } from "./sources-view";
import { ResearchWorkspace } from "./research-workspace";
import { ValidationWorkspace } from "./validation-workspace";
import { OperationsView } from "./operations-view";
import {
  categories,
  type Category,
  type DashboardData,
  type JobRun,
  type SavedItem,
  type Story,
} from "@/lib/types";
import { dateLabel, relativeTime, editionFor } from "@/lib/time";
import { storyMatches } from "@/lib/story-identity";
import { savedArchive } from "@/lib/saved-archive";

type View =
  | "today"
  | "saved"
  | "ideas"
  | "sources"
  | "settings"
  | "validation"
  | "operations";
const navigation = [
  { id: "today" as const, label: "Mi briefing", icon: Newspaper },
  { id: "saved" as const, label: "Guardados", icon: Bookmark },
  { id: "ideas" as const, label: "Oportunidades", icon: Lightbulb },
  { id: "validation" as const, label: "Entrevistas", icon: MessageSquare },
];
const categoryColors: Record<Category, string> = {
  IA: "#759788",
  Chips: "#a18a6e",
  Startups: "#a190af",
  Software: "#7293ae",
  Seguridad: "#b1827c",
  Negocios: "#9c966d",
  Finanzas: "#688f89",
  Operaciones: "#b19771",
};

export function Dashboard({ initialData }: { initialData: DashboardData }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<View>("today");
  const [validationProjectId, setValidationProjectId] = useState<string>();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "Todas">("Todas");
  const [selectedId, setSelectedId] = useState<string>();
  const [slot, setSlot] = useState("latest");
  const [mobileTab, setMobileTab] = useState("news");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [sourcesEnabled, setSourcesEnabled] = useState<Record<string, boolean>>(
    {},
  );
  const initialUpdate = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const running = requesting || data.latestJob?.status === "running";

  const reload = useCallback(async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo consultar tu dashboard.");
    setData(await response.json());
  }, []);

  const update = useCallback(async () => {
    if (data.demo) {
      router.push("/");
      return;
    }
    setRequesting(true);
    try {
      const response = await fetch("/api/update", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData((previous) => ({ ...previous, latestJob: result.job }));
      setToast(
        result.reused
          ? "Tu edición ya se está actualizando."
          : "Buscando las señales que importan…",
      );
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar. Intenta de nuevo.",
      );
    } finally {
      setRequesting(false);
    }
  }, [data.demo, router]);

  useEffect(() => {
    if (!data.demo) {
      fetch("/api/preferences")
        .then((r) => (r.ok ? r.json() : null))
        .then((result) => {
          if (result) setSourcesEnabled(result.sources);
        })
        .catch(() => {});
    }
  }, [data.demo]);

  useEffect(() => {
    const behind =
      !initialData.editions.length ||
      initialData.editions[0].key !== editionFor().key;
    if (
      !initialUpdate.current &&
      !initialData.demo &&
      behind &&
      initialData.latestJob?.status !== "running" &&
      (!initialData.latestJob ||
        Date.now() - Date.parse(initialData.latestJob.startedAt) > 10 * 60000)
    ) {
      initialUpdate.current = true;
      void update();
    }
  }, [initialData, update]);

  useEffect(() => {
    const job = data.latestJob;
    if (!job || job.status !== "running" || data.demo) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${job.id}`, {
          cache: "no-store",
        });
        if (!response.ok || !active) return;
        const current: JobRun = await response.json();
        if (!active) return;
        if (Date.now() - Date.parse(current.startedAt) > 20 * 60000) {
          await reload();
          return;
        }
        setData((previous) => ({ ...previous, latestJob: current }));
        if (current.status !== "running") {
          await reload();
          setToast(
            current.status === "failed"
              ? (current.message ?? "No se pudo actualizar.")
              : current.status === "partial"
                ? "Edición actualizada. Algunas fuentes quedaron pendientes."
                : "Tu nueva edición está lista.",
          );
        }
      } catch {
        /* The last edition stays readable during a temporary disconnect. */
      }
    }, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [data.latestJob?.id, data.latestJob?.status, data.demo, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.key === "Escape") {
        setMenuOpen(false);
        setSelectedId(undefined);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  async function persist(input: Record<string, unknown>) {
    if (data.demo) return;
    const response = await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok)
      throw new Error("No se pudo guardar el cambio. Intenta de nuevo.");
  }
  async function toggleSave(id: string, kind: "story" | "idea") {
    const story =
      kind === "story"
        ? data.stories.find((item) => storyMatches(item, id))
        : undefined;
    const previousSaved = data.saved.filter((item) =>
      story ? storyMatches(story, item.id) : item.id === id,
    );
    const wasSaved = previousSaved.length > 0;
    const saved: SavedItem = {
      id,
      kind,
      note: "",
      state: "explore",
      createdAt: new Date().toISOString(),
      snapshot: story
        ? { kind: "story", story }
        : kind === "idea" && data.opportunities.find((idea) => idea.id === id)
          ? {
              kind: "idea",
              idea: data.opportunities.find((idea) => idea.id === id)!,
            }
          : undefined,
    };
    setData((previous) => ({
      ...previous,
      saved: wasSaved
        ? previous.saved.filter(
            (item) => !previousSaved.some((s) => s.id === item.id),
          )
        : [...previous.saved, saved],
    }));
    try {
      if (wasSaved)
        await Promise.all(
          previousSaved.map((item) =>
            persist({ action: "save", id: item.id, kind, enabled: false }),
          ),
        );
      else await persist({ action: "save", id, kind, enabled: true });
      setToast(
        wasSaved
          ? "Quitado de guardados."
          : kind === "idea"
            ? "Idea guardada. Dale una siguiente acción."
            : "Historia guardada para leer después.",
      );
    } catch {
      setToast("No se pudo guardar. Intenta de nuevo.");
      await reload().catch(() => {});
    }
  }
  async function saveNote(
    id: string,
    note: string,
    state: SavedItem["state"],
    kind: "idea" | "note" = "idea",
  ) {
    try {
      await persist({ action: "note", id, kind, note, state });
      setData((previous) => ({
        ...previous,
        saved: [
          ...previous.saved.filter((item) => item.id !== id),
          {
            id,
            kind,
            note,
            state,
            createdAt: new Date().toISOString(),
            snapshot:
              previous.saved.find((item) => item.id === id)?.snapshot ??
              (kind === "idea" &&
              previous.opportunities.find((idea) => idea.id === id)
                ? {
                    kind: "idea",
                    idea: previous.opportunities.find(
                      (idea) => idea.id === id,
                    )!,
                  }
                : undefined),
          },
        ],
      }));
      setToast("Notas guardadas.");
    } catch {
      setToast("No se pudieron guardar tus notas.");
    }
  }
  async function toggleSource(id: string, enabled: boolean) {
    try {
      await persist({ action: "source", id, enabled });
      setSourcesEnabled((previous) => ({ ...previous, [id]: enabled }));
      setToast(
        enabled
          ? "Fuente activada para la siguiente actualización."
          : "Fuente desactivada.",
      );
    } catch {
      setToast("No se pudo cambiar la fuente.");
    }
  }
  function select(story: Story) {
    setSelectedId(story.id);
    if (!data.readIds.includes(story.id)) {
      setData((previous) => ({
        ...previous,
        readIds: [...previous.readIds, story.id],
      }));
      void persist({ action: "read", id: story.id }).catch(() =>
        setToast("No se pudo marcar como leída."),
      );
    }
  }
  function navigate(next: View) {
    setView(next);
    setQuery("");
    setCategory("Todas");
    setSelectedId(undefined);
    setMenuOpen(false);
    setMobileTab("news");
  }
  async function prepareInterviews(
    opportunityId: string,
    eventId?: string,
    savedId?: string,
  ) {
    if (data.demo) {
      setToast("Abre tu espacio real para crear una investigación.");
      return;
    }
    try {
      const response = await fetch("/api/validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "from-opportunity",
          opportunityId,
          eventId,
          savedId,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await reload();
      setValidationProjectId(result.projectId);
      navigate("validation");
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "No se pudo preparar la investigación.",
      );
    }
  }
  const edition =
    slot === "latest"
      ? undefined
      : data.editions.find((item) => item.slot === slot);
  const visibleStories = useMemo(
    () =>
      (view === "saved"
        ? savedArchive(data.saved, data.stories, data.opportunities).stories
        : data.stories
      )
        .filter((story) => {
          if (
            view === "saved" &&
            !data.saved.some(
              (item) => storyMatches(story, item.id) && item.kind === "story",
            )
          )
            return false;
          if (category !== "Todas" && story.category !== category) return false;
          if (
            view !== "saved" &&
            slot !== "latest" &&
            (!edition ||
              !edition.storyIds.some((id) => storyMatches(story, id)))
          )
            return false;
          return `${story.title} ${story.summary ?? story.excerpt} ${story.companies.join(" ")} ${story.sourceName}`
            .toLowerCase()
            .includes(query.toLowerCase());
        })
        .slice(0, view === "saved" ? undefined : 60),
    [
      data.stories,
      data.opportunities,
      data.saved,
      category,
      query,
      view,
      slot,
      edition,
    ],
  );
  const selected = selectedId
    ? (view === "saved" ? visibleStories : data.stories).find((story) =>
        storyMatches(story, selectedId),
      )
    : undefined;
  const connectedSources = data.sources.filter(
    (source) => source.status === "ok",
  ).length;
  const lastEdition = data.editions[0];
  const savedCount = data.saved.filter(
    (item) => item.kind === "story" || item.kind === "idea",
  ).length;
  const filteredIdeas = (
    view === "saved"
      ? savedArchive(data.saved, data.stories, data.opportunities).ideas
      : data.opportunities
  ).filter(
    (idea) =>
      `${idea.title} ${idea.problem} ${idea.customer}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (view !== "saved" || data.saved.some((item) => item.id === idea.id)),
  );
  const currentNav =
    view === "sources"
      ? "Mis fuentes"
      : view === "settings"
        ? "Preferencias"
        : view === "operations"
          ? "Estado y respaldos"
          : navigation.find((item) => item.id === view)?.label;

  return (
    <div className="app-shell">
      {menuOpen ? (
        <button
          className="sidebar-overlay"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("today")}
          aria-label="Noticiero, ir al inicio"
        >
          <span className="brand-icon">
            n<span>·</span>
          </span>
          <span>
            noticiero<span className="brand-period">.</span>
          </span>
        </button>
        <div className="workspace-switch">
          <span className="workspace-avatar">S</span>
          <div>
            <strong>Mi espacio</strong>
            <span>Tu radar personal</span>
          </div>
          <ChevronDown size={13} />
        </div>
        <nav aria-label="Navegación principal">
          <span className="nav-label">TU ESPACIO</span>
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={17} strokeWidth={1.6} />
              <span>{item.label}</span>
              {item.id === "saved" && savedCount > 0 ? (
                <span className="nav-count">{savedCount}</span>
              ) : item.id === "ideas" && data.opportunities.length ? (
                <span className="nav-count">{data.opportunities.length}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="topic-nav">
          <span className="nav-label">EXPLORAR TEMAS</span>
          {categories.map((topic) => (
            <button
              className={`topic-item ${category === topic && view === "today" ? "active" : ""}`}
              key={topic}
              onClick={() => {
                setView("today");
                setCategory(category === topic ? "Todas" : topic);
                setMenuOpen(false);
              }}
            >
              <span style={{ backgroundColor: categoryColors[topic] }} />
              {topic === "IA"
                ? "Inteligencia artificial"
                : topic === "Chips"
                  ? "Chips e infraestructura"
                  : topic}
              <ChevronRight size={12} />
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="edition-reminder">
            <Sun size={18} strokeWidth={1.3} />
            <strong>Un poco de perspectiva.</strong>
            <p>Tu próxima gran idea puede empezar con una buena lectura.</p>
            <span>
              Cierre desde 20:00 <span>CDMX</span>
            </span>
          </div>
          <button
            className={`nav-item ${view === "sources" ? "active" : ""}`}
            onClick={() => navigate("sources")}
          >
            <Rss size={16} strokeWidth={1.6} />
            <span>Mis fuentes</span>
            <span className="source-live-count">{connectedSources || "—"}</span>
          </button>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings2 size={16} strokeWidth={1.6} />
            <span>Preferencias</span>
          </button>
          <button
            className={`nav-item ${view === "operations" ? "active" : ""}`}
            onClick={() => navigate("operations")}
          >
            <ShieldCheck size={16} />
            <span>Estado y respaldos</span>
            {data.configuration.hosted && data.operations?.alerts.length ? (
              <span className="nav-count">{data.operations.alerts.length}</span>
            ) : null}
          </button>
          <div className="sidebar-signoff">
            <span className="tiny-dot" /> Hecho para mentes curiosas.
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
            <Compass size={15} strokeWidth={1.5} />
            <span>Mi espacio</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{currentNav}</strong>
          </div>
          <div className="topbar-actions">
            <span className="local-indicator">
              <span className="status-dot" />
              {data.demo
                ? "Vista de ejemplo"
                : data.configuration.hosted
                  ? "Espacio privado"
                  : "En tu equipo"}
            </span>
            <button
              className="icon-button"
              aria-label="Abrir preferencias"
              onClick={() => navigate("settings")}
            >
              <Settings2 size={16} />
            </button>
            <span className="user-avatar">S</span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {data.demo ? (
            <div className="demo-banner">
              <FlaskConical size={15} />
              <span>
                Vista de ejemplo · Las historias y las ideas ilustran la
                interfaz.
              </span>
              <Link href="/">
                Ir a noticias reales
                <ArrowUpRight size={13} />
              </Link>
            </div>
          ) : null}
          {view === "sources" ? (
            <SourcesView
              data={data}
              enabled={sourcesEnabled}
              onToggle={(id, enabled) => void toggleSource(id, enabled)}
            />
          ) : view === "settings" ? (
            <SettingsView data={data} />
          ) : view === "operations" ? (
            <OperationsView data={data} />
          ) : view === "validation" ? (
            <ValidationWorkspace
              key={validationProjectId ?? "workspace"}
              initialProjectId={validationProjectId}
              data={data.validation ?? { projects: [], interviews: [] }}
              onReload={reload}
              demo={data.demo}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="heading-date">
                    <span className="tiny-dot" />
                    {dateLabel()}
                  </div>
                  <h1>
                    {view === "saved" ? (
                      <>
                        Un buen hallazgo
                        <br />
                        <em>merece una segunda lectura.</em>
                      </>
                    ) : view === "ideas" ? (
                      <>
                        Las señales están ahí.
                        <br />
                        <em>¿Qué vas a construir?</em>
                      </>
                    ) : (
                      <>
                        El mundo se mueve.
                        <br />
                        <em>Encuentra tu siguiente idea.</em>
                      </>
                    )}
                  </h1>
                  <p>
                    {view === "saved"
                      ? "Tu colección de historias e ideas que vale la pena retomar."
                      : view === "ideas"
                        ? "Problemas concretos, hipótesis pequeñas y un siguiente paso."
                        : "Tecnología, finanzas y oportunidades. Todo lo que importa, sin el ruido."}
                  </p>
                </div>
                <div className="heading-decoration" aria-hidden="true">
                  <svg viewBox="0 0 120 120" fill="none">
                    <circle cx="60" cy="60" r="40" />
                    <ellipse
                      cx="60"
                      cy="60"
                      rx="17"
                      ry="40"
                      transform="rotate(35 60 60)"
                    />
                    <ellipse
                      cx="60"
                      cy="60"
                      rx="40"
                      ry="17"
                      transform="rotate(35 60 60)"
                    />
                    <path d="M25 93l70-66" />
                    <circle cx="88" cy="30" r="5" />
                    <path d="M12 22h10m-5-5v10M100 92h10m-5-5v10" />
                  </svg>
                  <span>AMPLÍA TU PERSPECTIVA</span>
                </div>
              </div>
              <div className="edition-toolbar">
                <div className="edition-info">
                  <span className="edition-tag">
                    <Sun size={13} />
                    {slot === "PM" ||
                    (slot === "latest" && lastEdition?.slot === "PM")
                      ? "Edición de la noche"
                      : "Tu resumen diario"}
                  </span>
                  <span className="edition-time">
                    <Clock3 size={12} />
                    {running
                      ? (data.latestJob?.stage ?? "Actualizando…")
                      : lastEdition
                        ? `Actualizado ${relativeTime(lastEdition.publishedAt).toLowerCase()}`
                        : data.demo
                          ? "Contenido ilustrativo"
                          : "Tu primera edición te espera"}
                  </span>
                </div>
                <button
                  className="refresh-button"
                  onClick={() => void update()}
                  disabled={running}
                >
                  <RefreshCw size={14} className={running ? "spinning" : ""} />
                  {running ? "Actualizando" : "Actualizar"}
                </button>
              </div>
              {data.latestJob?.status === "failed" ? (
                <div className="failure-banner">
                  <CircleHelp size={15} />
                  <span>
                    {data.latestJob.message ??
                      "No se pudo actualizar. Se conserva la última edición."}
                  </span>
                </div>
              ) : null}
              {view === "today" &&
              data.stories.length &&
              category === "Todas" &&
              !query ? (
                <section className="daily-brief">
                  <div className="brief-heading">
                    <span className="brief-symbol">
                      <Sparkles size={15} />
                    </span>
                    <h2>En pocas palabras</h2>
                    <span>EL PULSO DEL DÍA</span>
                  </div>
                  <div className="brief-points">
                    {data.stories.slice(0, 3).map((story, index) => (
                      <button
                        key={story.id}
                        onClick={() => {
                          select(story);
                          document
                            .getElementById(`story-${story.id}`)
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                        }}
                      >
                        <span className="brief-number">0{index + 1}</span>
                        <p>{story.title}</p>
                        <ArrowUpRight size={13} />
                      </button>
                    ))}
                  </div>
                  <div className="brief-footnote">
                    <span>{data.stories.length} historias</span>
                    <span>
                      {data.demo
                        ? "Fuentes ilustrativas"
                        : `${connectedSources} fuentes consultadas`}
                    </span>
                    <span>
                      {data.opportunities.length} oportunidades para explorar
                    </span>
                  </div>
                </section>
              ) : null}
              <div className="content-tools">
                <div className="content-label">
                  <span className="section-dot" />
                  <h2>
                    {view === "ideas"
                      ? "Del radar al producto"
                      : view === "saved"
                        ? "Para volver con calma"
                        : "En tu radar"}
                  </h2>
                  <span className="count-pill">
                    {view === "ideas"
                      ? filteredIdeas.length
                      : visibleStories.length}
                  </span>
                </div>
                <div className="search-box">
                  <Search size={14} />
                  <input
                    ref={searchInput}
                    aria-label="Buscar noticias, empresas o ideas"
                    placeholder={
                      view === "ideas"
                        ? "Buscar oportunidades…"
                        : "Buscar una señal…"
                    }
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query ? (
                    <button
                      className="icon-button"
                      aria-label="Limpiar búsqueda"
                      onClick={() => setQuery("")}
                    >
                      <X size={12} />
                    </button>
                  ) : (
                    <kbd>⌘ K</kbd>
                  )}
                </div>
              </div>
              {view === "saved" ? (
                <p className="research-explanation">
                  Tu archivo personal conserva el contenido disponible al
                  guardarlo. Los artículos completos y las fotos externas
                  dependen de su fuente original. Las notas y los guardados
                  permanecen hasta que los quites.
                </p>
              ) : null}
              {view !== "ideas" ? (
                <div className="filter-toolbar">
                  <div
                    className="category-filters"
                    role="group"
                    aria-label="Filtrar por tema"
                  >
                    {["Todas", ...categories].map((topic) => (
                      <button
                        key={topic}
                        className={category === topic ? "active" : ""}
                        onClick={() => setCategory(topic as Category | "Todas")}
                      >
                        {topic === "Todas" ? "Todo" : topic}
                      </button>
                    ))}
                  </div>
                  <div className="edition-select">
                    <SlidersHorizontal size={13} />
                    <select
                      aria-label="Filtrar por edición"
                      value={slot}
                      onChange={(event) => setSlot(event.target.value)}
                    >
                      <option value="latest">Más relevantes</option>
                      <option value="AM">Edición AM</option>
                      <option value="PM">Edición PM</option>
                    </select>
                    <ChevronDown size={11} />
                  </div>
                </div>
              ) : null}
              {view === "ideas" ? (
                <ResearchWorkspace
                  data={data}
                  query={query}
                  onValidate={(id, eventId) =>
                    void prepareInterviews(id, eventId)
                  }
                  onNote={(id, note, state) =>
                    void saveNote(id, note, state, "note")
                  }
                  onReport={async () => {
                    try {
                      const response = await fetch("/api/research/report", {
                        method: "POST",
                      });
                      if (!response.ok) throw new Error("report");
                      await reload();
                      setToast("Reporte guardado en oportunidades.");
                    } catch {
                      setToast(
                        "No se pudo generar el reporte. Intenta de nuevo.",
                      );
                    }
                  }}
                >
                  <div className="ideas-library">
                    {filteredIdeas.length ? (
                      filteredIdeas.map((idea) => (
                        <IdeaCard
                          key={idea.id}
                          idea={idea}
                          stories={data.stories}
                          saved={data.saved.find((s) => s.id === idea.id)}
                          onSave={() => void toggleSave(idea.id, "idea")}
                          onValidate={() => void prepareInterviews(idea.id)}
                          onNote={(note, state) =>
                            void saveNote(idea.id, note, state)
                          }
                        />
                      ))
                    ) : (
                      <EmptyState
                        icon="ideas"
                        title={
                          query
                            ? "Todavía no hay una coincidencia"
                            : "Las buenas ideas empiezan con una señal"
                        }
                        description={
                          query
                            ? "Intenta con otra palabra o limpia tu búsqueda."
                            : "El motor busca solicitudes y fricción en fuentes públicas. Las señales aisladas se guardan en el cuaderno; las hipótesis requieren repetición de varios autores."
                        }
                        action={query ? "Limpiar búsqueda" : "Ver mis fuentes"}
                        onAction={() =>
                          query ? setQuery("") : navigate("sources")
                        }
                      />
                    )}
                  </div>
                </ResearchWorkspace>
              ) : (
                <>
                  <div
                    className="mobile-context-tabs"
                    role="group"
                    aria-label="Secciones del dashboard"
                  >
                    <button
                      className={mobileTab === "news" ? "active" : ""}
                      onClick={() => setMobileTab("news")}
                    >
                      <Newspaper size={14} />
                      Noticias
                    </button>
                    <button
                      className={mobileTab === "market" ? "active" : ""}
                      onClick={() => setMobileTab("market")}
                    >
                      <Compass size={14} />
                      Empresas
                    </button>
                    <button
                      className={mobileTab === "ideas" ? "active" : ""}
                      onClick={() => setMobileTab("ideas")}
                    >
                      <Lightbulb size={14} />
                      Ideas
                    </button>
                  </div>
                  <div className={`dashboard-columns mobile-tab-${mobileTab}`}>
                    <div className="news-column">
                      {selected ? (
                        <div className="selected-notice">
                          <span>
                            <span className="status-dot" />
                            Contexto de la historia seleccionada
                          </span>
                          <button onClick={() => setSelectedId(undefined)}>
                            Ver todo
                            <X size={12} />
                          </button>
                        </div>
                      ) : null}
                      {visibleStories.length ? (
                        <div className="news-feed">
                          {visibleStories.map((story, index) => (
                            <div id={`story-${story.id}`} key={story.id}>
                              <NewsCard
                                story={story}
                                featured={
                                  index === 0 && category === "Todas" && !query
                                }
                                selected={selectedId === story.id}
                                saved={data.saved.some((s) =>
                                  storyMatches(story, s.id),
                                )}
                                read={data.readIds.some((id) =>
                                  storyMatches(story, id),
                                )}
                                onSelect={() => select(story)}
                                onSave={() =>
                                  void toggleSave(story.id, "story")
                                }
                              />
                            </div>
                          ))}
                          <div className="feed-end">
                            <CheckCheck size={17} strokeWidth={1.2} />
                            <p>
                              Un poco más de contexto.
                              <br />
                              <span>Un poco menos de ruido.</span>
                            </p>
                            <span className="feed-end-line" />
                          </div>
                        </div>
                      ) : view === "saved" && filteredIdeas.length ? null : (
                        <EmptyState
                          icon={view === "saved" ? "saved" : "news"}
                          title={
                            running
                              ? "Preparando tu primera edición"
                              : query || category !== "Todas"
                                ? "No encontramos esa señal"
                                : view === "saved"
                                  ? "Dale un lugar a tus hallazgos"
                                  : "Tu radar está listo para empezar"
                          }
                          description={
                            running
                              ? "Estamos consultando tus fuentes. Las noticias aparecerán aquí al terminar."
                              : query || category !== "Todas"
                                ? "Prueba con otro tema o una búsqueda diferente."
                                : view === "saved"
                                  ? "Guarda una noticia con el marcador y vuelve a ella cuando tengas tiempo."
                                  : "Actualiza para traer noticias reales de tecnología. También puedes recorrer una vista de ejemplo."
                          }
                          action={
                            running
                              ? undefined
                              : query || category !== "Todas"
                                ? "Quitar filtros"
                                : view === "saved"
                                  ? "Explorar noticias"
                                  : "Consultar fuentes"
                          }
                          onAction={() => {
                            if (query || category !== "Todas") {
                              setQuery("");
                              setCategory("Todas");
                            } else if (view === "saved") navigate("today");
                            else void update();
                          }}
                        />
                      )}
                      {view === "saved" && filteredIdeas.length ? (
                        <section className="saved-ideas">
                          <h2>
                            <Lightbulb size={17} />
                            Ideas que guardaste
                          </h2>
                          {filteredIdeas.map((idea) => (
                            <IdeaCard
                              key={idea.id}
                              idea={idea}
                              stories={data.stories}
                              saved={data.saved.find((s) => s.id === idea.id)}
                              onSave={() => void toggleSave(idea.id, "idea")}
                              onValidate={() =>
                                void prepareInterviews(
                                  idea.id,
                                  undefined,
                                  idea.id,
                                )
                              }
                              onNote={(note, state) =>
                                void saveNote(idea.id, note, state)
                              }
                            />
                          ))}
                        </section>
                      ) : null}
                    </div>
                    <aside
                      className="context-column"
                      aria-label="Contexto y oportunidades"
                    >
                      <div className="market-tab-panel">
                        <CompanyPanel
                          stories={visibleStories}
                          quotes={data.quotes}
                          selected={selected}
                          configured={data.configuration.market}
                          onConfigure={() => navigate("settings")}
                        />
                      </div>
                      <div className="ideas-tab-panel">
                        <OpportunityPanel
                          ideas={data.opportunities}
                          stories={data.stories}
                          saved={data.saved}
                          selected={selected}
                          configured={
                            data.configuration.analysisMode !== "api" ||
                            data.configuration.ai
                          }
                          onConfigure={() => navigate("settings")}
                          onSave={(id) => void toggleSave(id, "idea")}
                          onNote={(id, note, state) =>
                            void saveNote(id, note, state)
                          }
                          onViewAll={() => navigate("ideas")}
                        />
                      </div>
                      <div className="reading-note">
                        <span>UNA BUENA PREGUNTA PARA HOY</span>
                        <p>
                          ¿Qué problema se está volviendo más importante… y
                          quién sigue resolviéndolo a mano?
                        </p>
                        <span className="note-doodle">↗</span>
                      </div>
                    </aside>
                  </div>
                </>
              )}
            </>
          )}
          <footer className="main-footer">
            <span>
              noticiero<span>·</span>Una perspectiva propia.
            </span>
            <span>Tecnología global · Español · CDMX</span>
            {!data.stories.length && !data.demo ? (
              <Link href="/?demo=1">
                Explorar ejemplo
                <ArrowUpRight size={12} />
              </Link>
            ) : null}
          </footer>
        </main>
      </div>
      {toast ? (
        <div className="toast" role="status">
          <Check size={15} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Cerrar aviso"
            onClick={() => setToast("")}
          >
            <X size={13} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
function EmptyState({
  icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: "ideas" | "saved" | "news";
  title: string;
  description: string;
  action?: string;
  onAction: () => void;
}) {
  const Icon =
    icon === "ideas" ? Lightbulb : icon === "saved" ? Bookmark : Newspaper;
  return (
    <div className="empty-state">
      <span>
        <Icon size={30} strokeWidth={1} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? (
        <button className="small-button" onClick={onAction}>
          {action}
          <ArrowRight size={13} />
        </button>
      ) : (
        <RefreshCw className="spinning" size={16} />
      )}
    </div>
  );
}
