import { signIn } from "@/auth";
export default function Login() {
  const configured =
    process.env.AUTH_GITHUB_ID &&
    process.env.AUTH_GITHUB_SECRET &&
    process.env.AUTH_ALLOWED_GITHUB_ID &&
    process.env.AUTH_SECRET;
  return (
    <main className="login-page" id="main-content">
      <div className="login-card">
        <span className="login-wordmark">noticiero.</span>
        <span className="eyebrow">TU ESPACIO PRIVADO</span>
        <h1>
          Un poco de perspectiva.
          <br />
          <em>Solo para ti.</em>
        </h1>
        <p>
          {configured
            ? "Entra con tu cuenta autorizada para leer tu briefing."
            : "Configura el acceso privado de GitHub y la base de datos antes de publicar este espacio."}
        </p>
        {configured ? (
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/" });
            }}
          >
            <button className="primary-button">Entrar con GitHub</button>
          </form>
        ) : (
          <div className="login-config-note">
            La configuración se realiza en las variables de entorno del
            servidor. Consulta README.md.
          </div>
        )}
      </div>
    </main>
  );
}
