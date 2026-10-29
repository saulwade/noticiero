import Link from "next/link";
export default function NotFound() {
  return (
    <main className="login-page" id="main-content">
      <div className="login-card">
        <span className="login-wordmark">noticiero.</span>
        <h1>
          Esta señal
          <br />
          <em>no está en el radar.</em>
        </h1>
        <Link className="small-button" href="/">
          Volver al briefing
        </Link>
      </div>
    </main>
  );
}
