"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="login-page" id="main-content">
      <div className="login-card">
        <span className="login-wordmark">noticiero.</span>
        <h1>
          Perdimos el hilo
          <br />
          <em>por un momento.</em>
        </h1>
        <p>No pudimos cargar tu espacio. Tus datos guardados se conservan.</p>
        <button className="small-button" onClick={reset}>
          Volver a intentar
        </button>
      </div>
    </main>
  );
}
