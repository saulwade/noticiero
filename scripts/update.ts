import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const base = new URL(process.env.APP_URL ?? "http://127.0.0.1:3001");
if (!["localhost", "127.0.0.1"].includes(base.hostname))
  throw new Error("El comando local requiere APP_URL en localhost.");
async function main() {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      response = await fetch(new URL("/api/update", base), {
        method: "POST",
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) break;
    } catch {
      /* Wait for the server after login or resume. */
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  if (!response?.ok)
    throw new Error(
      "No se pudo iniciar. Comprueba que npm run dev o npm start esté activo.",
    );
  const { job } = await response.json();
  console.log(`Actualización ${job.id} iniciada.`);
  for (let attempt = 0; attempt < 480; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const current = await (
      await fetch(new URL(`/api/jobs/${job.id}`, base), {
        signal: AbortSignal.timeout(15000),
      })
    ).json();
    if (current.status !== "running") {
      console.log(`${current.stage}. ${current.storiesAdded} noticias nuevas.`);
      for (const source of current.sourceStates)
        console.log(`  ${source.name}: ${source.status} (${source.count})`);
      if (current.message) console.log(current.message);
      if (current.status === "failed") process.exitCode = 1;
      return;
    }
  }
  throw new Error(
    "La actualización excedió 20 minutos. Consulta el estado en el dashboard.",
  );
}
main().catch(() => {
  console.error(
    "No se pudo completar la actualización. Comprueba el servidor y la conexión.",
  );
  process.exitCode = 1;
});
