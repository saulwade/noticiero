"use client";
/* eslint-disable @next/next/no-img-element -- Feed thumbnails retain the publisher URL and attribution. */
import { useState } from "react";
import { ArrowUpRight, Bookmark, Check, ChevronRight } from "lucide-react";
import { CategoryArt } from "./category-art";
import { relativeTime } from "@/lib/time";
import type { Story } from "@/lib/types";

export function NewsCard({
  story,
  featured,
  selected,
  saved,
  read,
  onSelect,
  onSave,
}: {
  story: Story;
  featured?: boolean;
  selected: boolean;
  saved: boolean;
  read: boolean;
  onSelect: () => void;
  onSave: () => void;
}) {
  const [imageError, setImageError] = useState(false);
  const excerpt = story.summary ?? story.excerpt;
  const sourceInitials =
    story.sourceId === "hn"
      ? "Y"
      : story.sourceId === "ars"
        ? "ars"
        : story.sourceId === "techcrunch"
          ? "TC"
          : story.sourceName.slice(0, 1);
  return (
    <article
      className={`news-card ${featured ? "featured" : ""} ${selected ? "selected" : ""}`}
    >
      {featured ? (
        <div className="featured-image">
          {story.imageUrl && !imageError ? (
            <>
              <img
                src={story.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
              />
              <span className="image-credit">{story.imageCredit}</span>
            </>
          ) : (
            <CategoryArt category={story.category} large />
          )}
          <span className={`category-pill category-${story.category}`}>
            {story.category}
          </span>
          <button
            className={`image-bookmark icon-button ${saved ? "is-saved" : ""}`}
            aria-label={saved ? "Quitar de guardados" : "Guardar noticia"}
            onClick={onSave}
          >
            <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      ) : null}
      <div className="news-card-content">
        <div className="story-meta">
          <span className={`source-mark source-${story.sourceId}`}>
            {sourceInitials}
          </span>
          <span className="source-name">{story.sourceName}</span>
          <span className="meta-dot">·</span>
          <time dateTime={story.publishedAt}>
            {relativeTime(story.publishedAt)}
          </time>
          {read ? (
            <span className="read-label">
              <Check size={11} /> Leída
            </span>
          ) : null}
          {!featured ? (
            <button
              className={`icon-button inline-save ${saved ? "is-saved" : ""}`}
              aria-label={saved ? "Quitar de guardados" : "Guardar noticia"}
              onClick={onSave}
            >
              <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
            </button>
          ) : null}
        </div>
        {!featured ? (
          <span className={`category-text category-${story.category}`}>
            {story.category}
          </span>
        ) : null}
        {!featured && story.imageUrl && !imageError ? (
          <div className="inline-news-image">
            <img
              src={story.imageUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
            />
            <span>{story.imageCredit}</span>
          </div>
        ) : null}
        <button
          className="story-title"
          onClick={onSelect}
          aria-pressed={selected}
        >
          <h3>{story.title}</h3>
        </button>
        {excerpt ? (
          <p className="story-summary">{excerpt}</p>
        ) : (
          <p className="story-summary unavailable">
            Solo titular disponible. Abre la fuente para conocer la historia
            completa.
          </p>
        )}
        {story.why ? (
          <div className="why-box">
            <span className="why-marker" />
            <p>
              <strong>Por qué importa</strong>
              {story.why}
            </p>
          </div>
        ) : null}
        <div className="story-footer">
          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onSelect}
          >
            Leer original <ArrowUpRight size={14} />
          </a>
          {story.references.length > 1 ? (
            <span>{story.references.length} fuentes</span>
          ) : (
            <span className="coverage-label">
              {story.analysis === "ready"
                ? "Resumen en español"
                : story.coverage === "headline"
                  ? "Solo titular"
                  : "Extracto original"}
            </span>
          )}
          <button
            className="context-link"
            onClick={onSelect}
            aria-label={`Ver contexto de ${story.title}`}
          >
            <span>Contexto</span>
            <ChevronRight size={14} />
          </button>
        </div>
        {selected && story.references.length > 1 ? (
          <div className="related-sources">
            También en{" "}
            {story.references.slice(1).map((ref) => (
              <a
                key={ref.url}
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {ref.name} <ArrowUpRight size={11} />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
