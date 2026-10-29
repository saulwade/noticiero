import type { Category } from "@/lib/types";
export function CategoryArt({
  category,
  large = false,
}: {
  category: Category;
  large?: boolean;
}) {
  return (
    <div
      className={`category-art art-${category === "IA" ? "ai" : category === "Chips" ? "chip" : category === "Startups" ? "startup" : "software"} ${large ? "large" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 320 210" fill="none">
        <defs>
          <pattern
            id={`grid-${category}`}
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path d="M24 0H0V24" stroke="currentColor" strokeOpacity=".09" />
          </pattern>
        </defs>
        <rect width="320" height="210" fill={`url(#grid-${category})`} />
        {category === "Chips" ? (
          <g stroke="currentColor">
            <rect
              x="111"
              y="55"
              width="98"
              height="98"
              rx="12"
              strokeWidth="1.5"
            />
            <rect
              x="128"
              y="72"
              width="64"
              height="64"
              rx="6"
              strokeWidth="1.5"
            />
            <path d="M142 91h36v27h-36z" strokeOpacity=".4" />
            {[0, 1, 2, 3, 4].map((n) => (
              <g key={n}>
                <path
                  d={`M${125 + n * 17} 55V34M${125 + n * 17} 153v21M111 ${69 + n * 17}H88M209 ${69 + n * 17}h23`}
                  strokeWidth="1.5"
                />
                <circle cx={125 + n * 17} cy="32" r="2" />
              </g>
            ))}
          </g>
        ) : category === "Startups" ||
          category === "Finanzas" ||
          category === "Operaciones" ? (
          <g stroke="currentColor" strokeWidth="1.5">
            <path d="M94 148l39-38 27 18 61-68" />
            <path d="M198 60h23v24" />
            <circle cx="133" cy="110" r="5" fill="var(--art-bg)" />
            <circle cx="160" cy="128" r="5" fill="var(--art-bg)" />
            <path d="M94 67v93h140" strokeOpacity=".25" />
            <circle cx="221" cy="60" r="17" strokeOpacity=".2" />
          </g>
        ) : (
          <g stroke="currentColor" strokeWidth="1.2">
            <ellipse cx="160" cy="104" rx="72" ry="30" />
            <ellipse
              cx="160"
              cy="104"
              rx="72"
              ry="30"
              transform="rotate(60 160 104)"
            />
            <ellipse
              cx="160"
              cy="104"
              rx="72"
              ry="30"
              transform="rotate(120 160 104)"
            />
            <circle
              cx="160"
              cy="104"
              r="9"
              fill="currentColor"
              fillOpacity=".65"
            />
            <circle cx="232" cy="104" r="4" fill="var(--art-bg)" />
            <circle cx="124" cy="42" r="4" fill="var(--art-bg)" />
            <circle cx="124" cy="166" r="4" fill="var(--art-bg)" />
          </g>
        )}
        <path
          d="M18 22h12m-6-6v12M290 184h12m-6-6v12"
          stroke="currentColor"
          strokeOpacity=".35"
        />
      </svg>
      <span className="art-caption">
        {category === "Chips"
          ? "EL SIGUIENTE CIRCUITO"
          : category === "Finanzas"
            ? "SEÑALES EN LOS MERCADOS"
            : category === "Operaciones"
              ? "PROCESOS POR MEJORAR"
              : category === "Startups"
                ? "IDEAS EN MOVIMIENTO"
                : "TECNOLOGÍA EN PERSPECTIVA"}
      </span>
    </div>
  );
}
