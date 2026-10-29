"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  MessageSquare,
  Plus,
  Pencil,
  FolderOpen,
} from "lucide-react";
import type { Interview, ValidationData, ValidationProject } from "@/lib/types";
import { editionFor } from "@/lib/time";

export function ValidationWorkspace({
  data,
  onReload,
  initialProjectId,
  demo,
}: {
  data: ValidationData;
  onReload: () => Promise<void>;
  initialProjectId?: string;
  demo: boolean;
}) {
  const [selected, setSelected] = useState(
    initialProjectId ??
      data.projects.find((project) => project.status !== "archived")?.id,
  );
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [interview, setInterview] = useState<Interview | "new">();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [archived, setArchived] = useState(false);
  const project = data.projects.find((item) => item.id === selected);
  const conversations = data.interviews.filter(
    (item) => item.projectId === project?.id,
  );
  async function persist(payload: unknown) {
    if (demo) {
      setMessage(
        "Las entrevistas se guardan en tu espacio real. Sal de la vista de ejemplo.",
      );
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await onReload();
      setSelected(result.projectId);
      setEditing(false);
      setAdding(false);
      setInterview(undefined);
      setMessage("Guardado en tu espacio privado.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar. Tus campos siguen en el formulario.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="validation-workspace">
      <div className="workspace-heading">
        <span className="eyebrow">DE LAS SEÑALES A LAS CONVERSACIONES</span>
        <h1>
          Entender antes
          <br />
          <em>de construir.</em>
        </h1>
        <p>
          Define una hipótesis, escucha casos reales y conserva lo que la apoya
          o la contradice.
        </p>
      </div>
      <div className="workspace-actions">
        <button
          className="primary-button"
          onClick={() => {
            setAdding(true);
            setEditing(false);
            setInterview(undefined);
          }}
        >
          <Plus size={15} />
          Nueva investigación
        </button>
        <label className="quiet-checkbox">
          <input
            type="checkbox"
            checked={archived}
            onChange={(event) => setArchived(event.target.checked)}
          />
          Ver archivadas
        </label>
      </div>
      {message ? (
        <p role="status" className="workspace-notice">
          {message}
        </p>
      ) : null}
      <div className="validation-layout">
        <aside className="project-list" aria-label="Investigaciones">
          {data.projects
            .filter((item) => archived || item.status !== "archived")
            .map((item) => (
              <button
                key={item.id}
                className={selected === item.id ? "selected" : ""}
                onClick={() => {
                  setSelected(item.id);
                  setAdding(false);
                  setEditing(false);
                  setInterview(undefined);
                  setMessage("");
                }}
              >
                <FolderOpen size={16} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.segment.slice(0, 90)}</small>
                </span>
              </button>
            ))}
          {!data.projects.length ? (
            <p>
              Tu primera investigación puede empezar desde una oportunidad o
              desde una pregunta propia.
            </p>
          ) : null}
        </aside>
        <div className="validation-detail">
          {adding || editing ? (
            <ProjectForm
              key={adding ? "new" : project?.id}
              project={adding ? undefined : project}
              saving={saving}
              onSubmit={persist}
              onCancel={() => {
                setAdding(false);
                setEditing(false);
              }}
            />
          ) : project ? (
            <>
              <div className="detail-topline">
                <span className="neutral-badge">
                  {
                    {
                      explore: "Explorando",
                      interviewing: "Entrevistando",
                      pilot: "Probando piloto",
                      archived: "Archivada",
                    }[project.status]
                  }
                </span>
                <button
                  className="small-button"
                  onClick={() => {
                    setEditing(true);
                    setInterview(undefined);
                  }}
                >
                  <Pencil size={13} />
                  Editar investigación
                </button>
              </div>
              <h2>{project.title}</h2>
              <dl className="validation-facts">
                <dt>Para quién</dt>
                <dd>{project.segment}</dd>
                <dt>Problema por comprobar</dt>
                <dd>{project.problem}</dd>
                <dt>Hipótesis</dt>
                <dd>{project.hypothesis || "Por definir con evidencia."}</dd>
                <dt>Criterio de éxito propuesto</dt>
                <dd>
                  {project.successCriteria ||
                    "Define qué observación permitiría avanzar o descartar."}
                </dd>
              </dl>
              {project.sources.length ? (
                <div className="validation-sources">
                  <h3>Evidencia de partida</h3>
                  {project.sources.map((source, index) => (
                    <a
                      key={`${source.url}-${index}`}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {source.title}
                      <ArrowUpRight size={13} />
                    </a>
                  ))}
                </div>
              ) : null}
              <div className="section-heading">
                <h3>
                  <MessageSquare size={17} />
                  Entrevistas <span>{conversations.length}</span>
                </h3>
                <button
                  className="small-button"
                  onClick={() => setInterview("new")}
                >
                  <Plus size={14} />
                  Añadir entrevista
                </button>
              </div>
              <p className="research-explanation">
                Empieza por la última vez que ocurrió el problema, cómo lo
                resolvieron y qué consecuencia tuvo. Guarda también las
                contradicciones. Registrar entrevistas no confirma demanda.
              </p>
              {interview ? (
                <InterviewForm
                  key={interview === "new" ? "new" : interview.id}
                  interview={interview === "new" ? undefined : interview}
                  projectId={project.id}
                  saving={saving}
                  onSubmit={persist}
                  onCancel={() => setInterview(undefined)}
                />
              ) : null}
              {conversations.map((item) => (
                <article className="interview-card" key={item.id}>
                  <div className="detail-topline">
                    <span className="eyebrow">
                      {item.date} ·{" "}
                      {item.status === "completed"
                        ? "REALIZADA"
                        : "POR REALIZAR"}
                    </span>
                    <button
                      className="small-button"
                      onClick={() => setInterview(item)}
                    >
                      Editar entrevista
                    </button>
                  </div>
                  <h4>{item.alias}</h4>
                  <p>{item.role}</p>
                  <dl className="validation-facts">
                    <dt>Solución actual</dt>
                    <dd>{item.currentSolution || "Sin registrar"}</dd>
                    <dt>Frecuencia</dt>
                    <dd>{item.frequency || "Sin registrar"}</dd>
                    <dt>Consecuencia / costo</dt>
                    <dd>{item.consequence || "Sin registrar"}</dd>
                  </dl>
                  {item.quote ? <blockquote>{item.quote}</blockquote> : null}
                  <p className="preserve-lines">{item.notes}</p>
                  {item.nextStep ? (
                    <p>
                      <strong>Siguiente paso:</strong> {item.nextStep}
                    </p>
                  ) : null}
                </article>
              ))}
            </>
          ) : (
            <div className="workspace-empty">
              <MessageSquare size={30} strokeWidth={1} />
              <h2>Una buena pregunta abre camino.</h2>
              <p>
                Crea una investigación y reúne tus primeras conversaciones aquí.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
function Field({
  name,
  label,
  value = "",
  required = false,
  short = false,
}: {
  name: string;
  label: string;
  value?: string;
  required?: boolean;
  short?: boolean;
}) {
  return (
    <label className="workspace-field">
      <span>{label}</span>
      {short ? (
        <input
          name={name}
          defaultValue={value}
          required={required}
          maxLength={name === "title" || name === "alias" ? 200 : 400}
        />
      ) : (
        <textarea
          name={name}
          defaultValue={value}
          required={required}
          rows={3}
          maxLength={12000}
        />
      )}
    </label>
  );
}
function ProjectForm({
  project,
  saving,
  onSubmit,
  onCancel,
}: {
  project?: ValidationProject;
  saving: boolean;
  onSubmit: (payload: unknown) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <form
      className="workspace-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void onSubmit({
          action: "project",
          id: project?.id,
          title: form.get("title"),
          segment: form.get("segment"),
          problem: form.get("problem"),
          hypothesis: form.get("hypothesis"),
          successCriteria: form.get("successCriteria"),
          status: form.get("status"),
          sources: String(form.get("sources") ?? "")
            .split("\n")
            .map((url) => url.trim())
            .filter(Boolean)
            .map((url) => ({
              title:
                project?.sources.find((source) => source.url === url)?.title ??
                "Fuente aportada",
              url,
            })),
        });
      }}
    >
      <h2>{project ? "Editar investigación" : "Nueva investigación"}</h2>
      <Field
        name="title"
        label="Nombre de la investigación"
        value={project?.title}
        short
        required
      />
      <Field
        name="segment"
        label="Segmento: ¿quién tiene el problema?"
        value={project?.segment}
        required
      />
      <Field
        name="problem"
        label="Problema concreto"
        value={project?.problem}
        required
      />
      <Field
        name="hypothesis"
        label="Hipótesis por comprobar"
        value={project?.hypothesis}
      />
      <Field
        name="successCriteria"
        label="Qué evidencia permitiría avanzar o descartar"
        value={project?.successCriteria}
      />
      <Field
        name="sources"
        label="Fuentes HTTPS, una por línea"
        value={project?.sources.map((source) => source.url).join("\n")}
      />
      <label className="workspace-field">
        <span>Etapa</span>
        <select name="status" defaultValue={project?.status ?? "explore"}>
          <option value="explore">Explorando</option>
          <option value="interviewing">Entrevistando</option>
          <option value="pilot">Probando piloto</option>
          <option value="archived">Archivada</option>
        </select>
      </label>
      <div className="workspace-actions">
        <button className="primary-button" disabled={saving}>
          {saving ? "Guardando…" : "Guardar investigación"}
        </button>
        <button
          type="button"
          className="small-button"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </button>
      </div>
      <p className="settings-hint">
        Tus cambios se guardan al pulsar Guardar investigación.
      </p>
    </form>
  );
}
function InterviewForm({
  interview,
  projectId,
  saving,
  onSubmit,
  onCancel,
}: {
  interview?: Interview;
  projectId: string;
  saving: boolean;
  onSubmit: (payload: unknown) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <form
      className="workspace-form interview-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          action: "interview",
          id: interview?.id,
          projectId,
          ...Object.fromEntries(new FormData(event.currentTarget)),
        });
      }}
    >
      <h3>{interview ? "Editar entrevista" : "Nueva entrevista"}</h3>
      <div className="field-pair">
        <Field
          name="alias"
          label="Persona o alias"
          value={interview?.alias}
          short
          required
        />
        <Field
          name="role"
          label="Rol / tipo de usuario"
          value={interview?.role}
          short
        />
      </div>
      <div className="field-pair">
        <label className="workspace-field">
          <span>Fecha de la entrevista</span>
          <input
            type="date"
            name="date"
            defaultValue={interview?.date ?? editionFor().date}
            required
          />
        </label>
        <label className="workspace-field">
          <span>Estado</span>
          <select name="status" defaultValue={interview?.status ?? "planned"}>
            <option value="planned">Por realizar</option>
            <option value="completed">Realizada</option>
          </select>
        </label>
      </div>
      <Field
        name="currentSolution"
        label="¿Cómo resolvió el último caso?"
        value={interview?.currentSolution}
      />
      <Field
        name="frequency"
        label="¿Con qué frecuencia ocurre?"
        value={interview?.frequency}
      />
      <Field
        name="consequence"
        label="Tiempo, costo o consecuencia medible"
        value={interview?.consequence}
      />
      <Field
        name="quote"
        label="Cita textual relevante"
        value={interview?.quote}
      />
      <Field
        name="notes"
        label="Notas y evidencia que contradice la hipótesis"
        value={interview?.notes}
      />
      <Field
        name="nextStep"
        label="Siguiente paso o compromiso concreto"
        value={interview?.nextStep}
      />
      <div className="workspace-actions">
        <button className="primary-button" disabled={saving}>
          {saving ? "Guardando…" : "Guardar entrevista"}
        </button>
        <button
          type="button"
          className="small-button"
          disabled={saving}
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
      <p className="settings-hint">
        Los datos se guardan al pulsar Guardar entrevista. No se contacta a
        nadie automáticamente.
      </p>
    </form>
  );
}
