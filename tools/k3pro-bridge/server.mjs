/**
 * Lanzador del bridge K3 Pro (Python + pyserial).
 * Sustituye al FT95 en http://127.0.0.1:3933
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, "server.py");

function candidates() {
  const list = [];
  if (process.env.K3PRO_PYTHON) list.push(process.env.K3PRO_PYTHON);
  if (process.env.ECG_PYTHON) list.push(process.env.ECG_PYTHON);
  if (process.env.PYTHON) list.push(process.env.PYTHON);
  const local = process.env.LOCALAPPDATA || "";
  if (local) {
    for (const ver of ["314", "313", "312", "311", "310"]) {
      list.push(path.join(local, "Programs", "Python", `Python${ver}`, "python.exe"));
    }
  }
  list.push("C:\\Python312\\python.exe", "C:\\Python311\\python.exe");
  // Prefer py launcher over bare "python" (Windows Store stub).
  list.push("py");
  return list;
}

function resolvePython() {
  for (const c of candidates()) {
    if (!c) continue;
    if (c.includes("WindowsApps")) continue;
    if (c.endsWith(".exe") || c.includes("\\") || c.includes("/")) {
      if (fs.existsSync(c)) return { cmd: c, args: [script] };
      continue;
    }
    if (c === "py") return { cmd: "py", args: ["-3", script] };
  }
  return null;
}

if (!fs.existsSync(script)) {
  console.error("[k3pro-bridge] Falta server.py");
  process.exit(1);
}

const py = resolvePython();
if (!py) {
  console.error(
    "[k3pro-bridge] No hay Python. Ejecute tools\\ecg-bridge\\1-instalar-python-bleak.bat o instale Python 3.",
  );
  process.exit(1);
}

console.log(`[k3pro-bridge] lanzando ${py.cmd} ${py.args.join(" ")}`);
const child = spawn(py.cmd, py.args, {
  cwd: __dirname,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error("[k3pro-bridge] No se pudo iniciar Python:", err.message);
  process.exit(1);
});
