import { mkdir, writeFile, copyFile, unlink, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const root = process.cwd();
const mode = process.argv[2] ?? "generate";
if (!["generate", "install", "uninstall"].includes(mode))
  throw new Error("Usa generate, install o uninstall.");
if (process.platform !== "darwin" && mode !== "generate")
  throw new Error("La instalación automática requiere macOS.");
const labels = ["local.noticiero.server", "local.noticiero.update"];
const directory = path.join(os.homedir(), "Library/LaunchAgents");
const domain = `gui/${process.getuid!()}`;
const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
function stop(label: string) {
  try {
    execFileSync("launchctl", ["bootout", `${domain}/${label}`], {
      stdio: "ignore",
    });
  } catch {
    /* An absent service needs no shutdown. */
  }
}
if (mode === "uninstall") {
  for (const label of labels.toReversed()) {
    stop(label);
    try {
      await unlink(path.join(directory, `${label}.plist`));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  console.log(
    "Servicios de Noticiero desactivados. Tus datos permanecen en .data/postgres.",
  );
} else {
  await access(path.join(root, ".next/BUILD_ID")).catch(() => {
    if (mode === "install") throw new Error("Primero ejecuta npm run build.");
  });
  await mkdir(path.join(root, ".data"), { recursive: true });
  for (const label of labels) {
    const server = label.endsWith("server");
    const args = server
      ? [
          process.execPath,
          path.join(root, "node_modules/next/dist/bin/next"),
          "start",
          "--hostname",
          "127.0.0.1",
          "--port",
          "3001",
        ]
      : [process.execPath, "--import", "tsx", "scripts/update.ts"];
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>WorkingDirectory</key><string>${escape(root)}</string>
<key>ProgramArguments</key><array>${args.map((arg) => `<string>${escape(arg)}</string>`).join("")}</array>
<key>EnvironmentVariables</key><dict><key>NOTICIERO_BACKGROUND</key><string>1</string><key>ANALYSIS_MODE</key><string>local</string><key>NODE_ENV</key><string>production</string></dict>
<key>RunAtLoad</key><true/>
${server ? "<key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>15</integer>" : "<key>StartInterval</key><integer>3600</integer>"}
<key>StandardOutPath</key><string>${escape(path.join(root, `.data/${server ? "server" : "schedule"}.log`))}</string>
<key>StandardErrorPath</key><string>${escape(path.join(root, `.data/${server ? "server" : "schedule"}-error.log`))}</string>
</dict></plist>`;
    const generated = path.join(root, `.data/${label}.plist`);
    await writeFile(generated, plist);
    execFileSync("plutil", ["-lint", generated], { stdio: "inherit" });
    if (mode === "install") {
      await mkdir(directory, { recursive: true });
      stop(label);
      const destination = path.join(directory, `${label}.plist`);
      await copyFile(generated, destination);
      execFileSync("launchctl", ["bootstrap", domain, destination], {
        stdio: "inherit",
      });
    }
  }
  console.log(
    mode === "install"
      ? "Servidor local y recopilación cada hora instalados en macOS. El cierre se guarda desde las 20:00 CDMX cuando el equipo está disponible."
      : "Archivos generados en .data. Activa con npm run schedule:install.",
  );
}
