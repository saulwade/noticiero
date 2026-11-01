"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  ChevronDown,
  FlaskConical,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import type { Opportunity, Story, SavedItem } from "@/lib/types";
import { storyMatches, resolveStorySource } from "@/lib/story-identity";

export function IdeaCard({
  idea,
  stories,
  saved,
  onSave,
  onNote,
  onValidate,
  compact = false,
  readOnly = false,
}: {
  idea: Opportunity;
  stories: Story[];
  saved?: SavedItem;
  onSave: () => void;
  onNote: (note: string, state: SavedItem["state"]) => void;
  onValidate?: () => void;
  compact?: boolean;
  readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(!compact);
  const [note, setNote] = useState(saved?.note ?? "");
  const [state, setState] = useState<SavedItem["state"]>(
    saved?.state ?? "explore",
  );
  return (
    <article className={`idea-card ${compact ? "compact" : ""}`}>
      <div className="idea-topline">
        <span className="idea-kicker">
          <span className="tiny-dot" /> HIPÓTESIS DE NEGOCIO
        </span>
        <button
          className={`icon-button ${saved ? "is-saved" : ""}`}
          aria-label={saved ? "Quitar idea de guardados" : "Guardar idea"}
          onClick={onSave}
        >
          <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <button
        className="idea-title"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <h3>{idea.title}</h3>
        <ChevronDown size={15} className={expanded ? "rotated" : ""} />
      </button>
      <p className="idea-problem">{idea.problem}</p>
      {onValidate ? (
        <button className="small-button interview-start" onClick={onValidate}>
          Preparar entrevistas <ArrowRight size={13} />
        </button>
      ) : null}
      <div className="idea-tags">
        <span>
          {idea.difficulty === "Baja"
            ? "MVP accesible"
            : `Dificultad ${idea.difficulty.toLowerCase()}`}
        </span>
        <span>{idea.confidence}</span>
      </div>
      {expanded ? (
        <div className="idea-details">
          <dl>
            <dt>Quién podría pagar</dt>
            <dd>{idea.customer}</dd>
            <dt>La propuesta</dt>
            <dd>{idea.proposal}</dd>
            <dt>Por qué ahora</dt>
            <dd>{idea.whyNow}</dd>
            <dt>MVP · 1–2 semanas</dt>
            <dd>{idea.mvp}</dd>
            <dt>Cómo validarla</dt>
            <dd>{idea.experiment}</dd>
            <dt>Señal de éxito propuesta</dt>
            <dd>{idea.successSignal}</dd>
          </dl>
          <div className="idea-evidence">
            <strong>De dónde sale la señal</strong>
            {idea.evidence.map((evidence) => {
              const source =
                evidence.url && evidence.sourceName
                  ? { url: evidence.url, name: evidence.sourceName }
                  : resolveStorySource(stories, evidence.storyId);
              return (
                <div key={evidence.storyId}>
                  <p>{evidence.reason}</p>
                  {evidence.quote ? (
                    <blockquote className="signal-quote">
                      {evidence.quote}
                    </blockquote>
                  ) : null}
                  {source ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.name}
                      <ArrowUpRight size={11} />
                    </a>
                  ) : (
                    <span>Fuente fuera de la edición actual</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="idea-caveat">
            <FlaskConical size={13} />
            {idea.caveat}
          </p>
          {readOnly ? (
            saved?.note ? (
              <p className="idea-caveat">Tu nota guardada: {saved.note}</p>
            ) : null
          ) : (
            <div className="idea-notes">
              <label htmlFor={`note-${idea.id}`}>Tu siguiente paso</label>
              <textarea
                id={`note-${idea.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Una pregunta, un posible cliente, un experimento…"
                rows={3}
                maxLength={4000}
              />
              <div>
                <select
                  aria-label="Estado de la idea"
                  value={state}
                  onChange={(e) =>
                    setState(e.target.value as SavedItem["state"])
                  }
                >
                  <option value="explore">Por explorar</option>
                  <option value="validating">Validando</option>
                  <option value="dismissed">Descartada</option>
                </select>
                <button
                  className="small-button"
                  onClick={() => onNote(note, state)}
                >
                  Guardar notas
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button className="idea-expand" onClick={() => setExpanded(true)}>
          Explorar idea <ArrowRight size={13} />
        </button>
      )}
    </article>
  );
}
export function OpportunityPanel({
  ideas,
  stories,
  saved,
  selected,
  configured,
  onConfigure,
  onSave,
  onNote,
  onViewAll,
}: {
  ideas: Opportunity[];
  stories: Story[];
  saved: SavedItem[];
  selected?: Story;
  configured: boolean;
  onConfigure: () => void;
  onSave: (id: string) => void;
  onNote: (id: string, note: string, state: SavedItem["state"]) => void;
  onViewAll: () => void;
}) {
  const related = (
    selected
      ? ideas.filter((idea) =>
          idea.evidence.some((e) => storyMatches(selected, e.storyId)),
        )
      : ideas
  ).slice(0, 3);
  return (
    <section className="context-panel opportunity-panel">
      <div className="panel-heading">
        <div>
          <Lightbulb size={16} />
          <h2>El siguiente paso</h2>
        </div>
        <Sparkles size={14} className="muted-icon" />
      </div>
      <p className="panel-intro">De lo que pasa a lo que podrías construir.</p>
      {related.length ? (
        related.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            stories={stories}
            saved={saved.find((item) => item.id === idea.id)}
            compact
            onSave={() => onSave(idea.id)}
            onNote={(note, state) => onNote(idea.id, note, state)}
          />
        ))
      ) : (
        <div className="ideas-placeholder">
          <div className="idea-illustration">
            <Lightbulb size={28} strokeWidth={1.1} />
            <span />
            <span />
          </div>
          <h3>
            {selected && ideas.length
              ? "Una historia, nuevas preguntas"
              : "Las buenas ideas dejan pistas"}
          </h3>
          <p>
            {selected && ideas.length
              ? "No hay hipótesis vinculadas a esta noticia. Explora las oportunidades del día."
              : configured
                ? "El cuaderno conserva solicitudes y quejas. Las hipótesis aparecen cuando varios autores describen una necesidad relacionada."
                : "Activa el análisis para conectar las noticias con problemas que valga la pena resolver."}
          </p>
          <button
            className="text-button"
            onClick={configured || ideas.length ? onViewAll : onConfigure}
          >
            {configured || ideas.length
              ? "Explorar oportunidades"
              : "Configurar análisis"}
            <ArrowRight size={13} />
          </button>
        </div>
      )}
      {related.length ? (
        <button className="panel-view-all" onClick={onViewAll}>
          Todas las oportunidades
          <ArrowRight size={13} />
        </button>
      ) : null}
      <p className="hypothesis-note">
        <FlaskConical size={12} /> Señales para explorar, no demanda validada.
      </p>
    </section>
  );
}
