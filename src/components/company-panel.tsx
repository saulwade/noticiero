import { ArrowUpRight, Building2, Info, SlidersHorizontal } from "lucide-react";
import { getCompany } from "@/features/market/company-catalog";
import type { Story, Quote } from "@/lib/types";
import { quoteAfterStory } from "@/features/market/presentation";
export function CompanyPanel({
  stories,
  quotes,
  selected,
  configured,
  onConfigure,
}: {
  stories: Story[];
  quotes: Quote[];
  selected?: Story;
  configured: boolean;
  onConfigure: () => void;
}) {
  const symbols = [
    ...new Set(
      (selected ? [selected] : stories).flatMap((story) => story.companies),
    ),
  ].slice(0, 6);
  return (
    <section className="context-panel market-panel">
      <div className="panel-heading">
        <div>
          <Building2 size={15} />
          <h2>En el radar</h2>
        </div>
        <span className="small-label">EMPRESAS</span>
      </div>
      <p className="panel-intro">
        {selected
          ? "Relacionadas con esta historia"
          : "Los nombres detrás de las noticias"}
      </p>
      {symbols.length ? (
        <div className="company-list">
          {symbols.map((symbol) => {
            const company = getCompany(symbol);
            if (!company) return null;
            const quote = quotes.find((q) => q.symbol === symbol);
            return (
              <div className="company-item" key={symbol}>
                <span
                  className="company-logo"
                  style={{
                    color: company.color,
                    backgroundColor: `${company.color}10`,
                  }}
                >
                  {company.initials}
                </span>
                <div className="company-name">
                  <a
                    href={
                      company.private
                        ? `https://www.google.com/search?q=${encodeURIComponent(company.name)}`
                        : `https://finance.yahoo.com/quote/${symbol}/`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {company.name}
                    <ArrowUpRight size={11} />
                  </a>
                  <span>{company.private ? "Empresa privada" : symbol}</span>
                </div>
                <div className="company-price">
                  {quote ? (
                    <>
                      <strong>
                        $
                        {quote.price.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                      <span
                        className={quote.percent >= 0 ? "positive" : "negative"}
                      >
                        {quote.percent >= 0 ? "+" : ""}
                        {quote.percent.toFixed(2)} %
                      </span>
                    </>
                  ) : (
                    <span className="quote-pending">
                      {company.private ? "No cotiza" : "Sin cotización"}
                    </span>
                  )}
                </div>
                {quote ? (
                  <p className="quote-date">
                    Cierre {quote.tradingDay} · {quote.currency}
                    {selected && !quoteAfterStory(quote, selected.publishedAt)
                      ? " · Anterior al evento"
                      : ""}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel-empty">
          <Building2 size={23} strokeWidth={1.2} />
          <p>
            {selected
              ? "Esta historia no menciona empresas del catálogo."
              : "Las empresas aparecerán al recopilar noticias."}
          </p>
        </div>
      )}
      {!configured ? (
        <button className="connect-market" onClick={onConfigure}>
          <SlidersHorizontal size={13} />
          <span>Conectar cotizaciones</span>
          <ArrowUpRight size={13} />
        </button>
      ) : (
        <p className="market-footnote">
          <Info size={12} /> Variación diaria al cierre. Fuente: Alpha Vantage.
        </p>
      )}
      <p className="causality-note">
        La relación con una noticia no demuestra que haya causado un movimiento
        bursátil.
      </p>
    </section>
  );
}
