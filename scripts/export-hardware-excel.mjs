import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

/** Inventario de hardware MaindHealth (estación + soporte + opcionales) */
const HARDWARE = [
  {
    id: 1,
    equipo: "Baumanómetro / tensiómetro",
    modelo: "U90B Pro (Urion / Alphamed)",
    categoria: "Clínico",
    paquete: "Mínimo de arranque",
    estado: "Activo",
    conexion: "Bluetooth LE",
    puertoCom: "—",
    mac: "23:51:D6:CE:70:BB",
    bridgePuerto: "3931",
    bridge: "tools/u90b-bridge",
    metricas: "SYS, DIA, pulso (mmHg / lpm)",
    modulo: "vital_signs / kiosk presión",
    notas: "Sustituye al BP-700 USB (retirado).",
  },
  {
    id: 2,
    equipo: "Oxímetro de pulso",
    modelo: "CONTEC CMS50D+",
    categoria: "Clínico",
    paquete: "Mínimo de arranque",
    estado: "Activo",
    conexion: "USB serial (CP210x)",
    puertoCom: "COM4",
    mac: "—",
    bridgePuerto: "3927",
    bridge: "tools/cms50dplus-bridge",
    metricas: "SpO₂ (%), FC (lpm)",
    modulo: "vital_signs / kiosk oxígeno",
    notas: "Única fuente de SpO₂. Driver Silicon Labs CP210x.",
  },
  {
    id: 3,
    equipo: "Electrocardiógrafo (ECG)",
    modelo: "MD100C_P",
    categoria: "Clínico",
    paquete: "Mínimo de arranque",
    estado: "Activo",
    conexion: "Bluetooth LE",
    puertoCom: "—",
    mac: "FB:1E:E4:A4:03:00",
    bridgePuerto: "3928",
    bridge: "tools/ecg-bridge",
    metricas: "FC + etiqueta clínica (bradi/normal/taqui)",
    modulo: "vital_signs / kiosk ECG",
    notas: "Sustituye PC-80B USB y KardiaMobile en kiosko.",
  },
  {
    id: 4,
    equipo: "Báscula + medidor de altura",
    modelo: "Lejia HW-701",
    categoria: "Clínico",
    paquete: "Mínimo de arranque",
    estado: "Activo",
    conexion: "RS232 → USB (CH340)",
    puertoCom: "COM7",
    mac: "—",
    bridgePuerto: "3930",
    bridge: "tools/hw701-scale-bridge",
    metricas: "Peso (kg), altura (cm), IMC",
    modulo: "vital_signs / kiosk báscula",
    notas: "4800 baud 8N1. Un solo equipo mide peso y talla.",
  },
  {
    id: 5,
    equipo: "Termómetro infrarrojo (frente)",
    modelo: "K3 Pro",
    categoria: "Clínico",
    paquete: "Mínimo de arranque",
    estado: "Activo",
    conexion: "USB serial",
    puertoCom: "COM8",
    mac: "—",
    bridgePuerto: "3933",
    bridge: "tools/k3pro-bridge",
    metricas: "Temperatura corporal (°C)",
    modulo: "vital_signs / kiosk temperatura",
    notas: "115200 baud. Sustituye Beurer FT95 Bluetooth.",
  },
  {
    id: 6,
    equipo: "Monitor multiparámetro (Ethernet)",
    modelo: "Monitor CMS (RJ45)",
    categoria: "Clínico",
    paquete: "Estación (secundario)",
    estado: "Activo — sin SpO₂/TA",
    conexion: "Ethernet RJ45",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "3932",
    bridge: "tools/cms-lan-bridge",
    metricas: "Temp / otros (ya no SpO₂ ni NIBP)",
    modulo: "vital_signs (limitado)",
    notas: "IP estación 202.114.4.119; SpO₂=CMS50D+, TA=U90B.",
  },
  {
    id: 7,
    equipo: "Medidor de glucosa",
    modelo: "Por definir",
    categoria: "Clínico",
    paquete: "Idea original / futuro",
    estado: "Pendiente",
    conexion: "Por definir",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "—",
    metricas: "Glucosa (mg/dL)",
    modulo: "vital_signs",
    notas: "En catálogo del sistema; sin bridge aún.",
  },
  {
    id: 8,
    equipo: "Pantalla de síntomas / triage",
    modelo: "UI kiosko (pantalla táctil)",
    categoria: "Clínico / UI",
    paquete: "Idea original",
    estado: "Software",
    conexion: "—",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "—",
    metricas: "—",
    modulo: "Triage UI / kiosk",
    notas: "Flujo de síntomas en PatientKioskWizard.",
  },
  {
    id: 9,
    equipo: "Cámara HD",
    modelo: "Cámara de estación",
    categoria: "Tecnológico",
    paquete: "Mínimo de arranque",
    estado: "Requerido",
    conexion: "USB / integrado",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "—",
    metricas: "Video teleconsulta",
    modulo: "Teleconsulta (Daily.co)",
    notas: "Paquete tecnológico mínimo.",
  },
  {
    id: 10,
    equipo: "Bocina fija de estación",
    modelo: "Altavoz fijo",
    categoria: "Tecnológico",
    paquete: "Mínimo de arranque",
    estado: "Requerido",
    conexion: "Audio PC",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "—",
    metricas: "—",
    modulo: "Guía por voz + teleconsulta",
    notas: "Sin audífonos (higiene e inclusión).",
  },
  {
    id: 11,
    equipo: "Micrófono fijo",
    modelo: "Micrófono de estación",
    categoria: "Tecnológico",
    paquete: "Mínimo de arranque",
    estado: "Requerido",
    conexion: "Audio PC",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "—",
    metricas: "—",
    modulo: "Teleconsulta / voz paciente",
    notas: "Fijo en estación.",
  },
  {
    id: 12,
    equipo: "Pantalla principal",
    modelo: "Monitor / touch de kiosko",
    categoria: "Tecnológico",
    paquete: "Mínimo de arranque",
    estado: "Requerido",
    conexion: "HDMI / DisplayPort",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "—",
    metricas: "—",
    modulo: "Teleconsulta + kiosk",
    notas: "Pantalla principal de la estación.",
  },
  {
    id: 13,
    equipo: "Computadora / terminal clínica",
    modelo: "PC de estación (Windows)",
    categoria: "Tecnológico",
    paquete: "Mínimo de arranque",
    estado: "Requerido",
    conexion: "—",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "tools/station-bridges",
    metricas: "—",
    modulo: "Sistema / kiosk / bridges",
    notas: "Arranca bridges al encender (puertos 3927–3933).",
  },
  {
    id: 14,
    equipo: "Tablet clínica",
    modelo: "Por definir",
    categoria: "Tecnológico",
    paquete: "Ampliación",
    estado: "Opcional",
    conexion: "Wi‑Fi",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "—",
    metricas: "—",
    modulo: "Triage / captura",
    notas: "Ampliación tecnológica.",
  },
  {
    id: 15,
    equipo: "Router / conectividad",
    modelo: "Router de estación",
    categoria: "Soporte",
    paquete: "Mínimo de arranque",
    estado: "Requerido",
    conexion: "Ethernet / Wi‑Fi",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "—",
    metricas: "—",
    modulo: "Infraestructura",
    notas: "Conectividad estable obligatoria.",
  },
  {
    id: 16,
    equipo: "UPS",
    modelo: "UPS de estación",
    categoria: "Soporte",
    paquete: "Ampliación",
    estado: "Recomendado",
    conexion: "AC",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "—",
    metricas: "—",
    modulo: "Continuidad",
    notas: "Respaldo eléctrico.",
  },
  {
    id: 17,
    equipo: "Impresora / escáner",
    modelo: "Impresora física de estación",
    categoria: "Soporte",
    paquete: "Estación",
    estado: "Activo",
    conexion: "USB / red",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "3929",
    bridge: "tools/station-print-bridge",
    metricas: "—",
    modulo: "Recetas / documentos",
    notas: "Impresión silenciosa sin diálogo PDF.",
  },
  {
    id: 18,
    equipo: "ECG USB (retirado en kiosko)",
    modelo: "Lepu/Creative PC-80B",
    categoria: "Clínico",
    paquete: "Histórico",
    estado: "Retirado (kiosko)",
    conexion: "USB",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "—",
    metricas: "ECG 1 canal",
    modulo: "vital_signs (legacy)",
    notas: "Reemplazado por MD100C_P BLE.",
  },
  {
    id: 19,
    equipo: "ECG móvil (no kiosko)",
    modelo: "AliveCor KardiaMobile AC-009",
    categoria: "Clínico",
    paquete: "Fuera de estación",
    estado: "No aplica a kiosko",
    conexion: "App móvil",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "—",
    metricas: "ECG (export PDF/foto)",
    modulo: "Upload manual /estacion/kardia",
    notas: "Solo app móvil; no es el equipo de estación.",
  },
  {
    id: 20,
    equipo: "Baumanómetro USB (retirado)",
    modelo: "BP-700 / CP2110",
    categoria: "Clínico",
    paquete: "Histórico",
    estado: "Retirado",
    conexion: "USB",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "3931",
    bridge: "tools/bp700-bridge",
    metricas: "SYS, DIA, pulso",
    modulo: "vital_signs (legacy)",
    notas: "Sustituido por U90B Pro BLE.",
  },
  {
    id: 21,
    equipo: "Termómetro Bluetooth (retirado)",
    modelo: "Beurer FT95",
    categoria: "Clínico",
    paquete: "Histórico",
    estado: "Retirado",
    conexion: "Bluetooth",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "—",
    metricas: "Temperatura (°C)",
    modulo: "vital_signs (legacy)",
    notas: "Sustituido por K3 Pro USB.",
  },
  {
    id: 22,
    equipo: "Estetoscopio digital",
    modelo: "Por definir",
    categoria: "Clínico",
    paquete: "Opcional / especialidad",
    estado: "Futuro",
    conexion: "Por definir",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "—",
    metricas: "Audio auscultación",
    modulo: "Especialidad",
    notas: "Roadmap futuro.",
  },
  {
    id: 23,
    equipo: "Otoscopio",
    modelo: "Por definir",
    categoria: "Clínico",
    paquete: "Opcional / especialidad",
    estado: "Futuro",
    conexion: "Por definir",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "—",
    metricas: "Imagen oído",
    modulo: "Especialidad",
    notas: "Roadmap futuro.",
  },
  {
    id: 24,
    equipo: "Dermatoscopio",
    modelo: "Por definir",
    categoria: "Clínico",
    paquete: "Opcional / especialidad",
    estado: "Futuro",
    conexion: "Por definir",
    puertoCom: "—",
    mac: "—",
    bridgePuerto: "—",
    bridge: "—",
    metricas: "Imagen piel",
    modulo: "Especialidad",
    notas: "Roadmap futuro.",
  },
];

const BRIDGES = [
  { puerto: 3927, servicio: "Oxímetro CMS50D+", ruta: "tools/cms50dplus-bridge", host: "127.0.0.1" },
  { puerto: 3928, servicio: "ECG MD100C_P BLE", ruta: "tools/ecg-bridge", host: "127.0.0.1" },
  { puerto: 3929, servicio: "Impresora estación", ruta: "tools/station-print-bridge", host: "127.0.0.1" },
  { puerto: 3930, servicio: "Báscula HW-701", ruta: "tools/hw701-scale-bridge", host: "127.0.0.1" },
  { puerto: 3931, servicio: "Tensiómetro U90B Pro", ruta: "tools/u90b-bridge", host: "127.0.0.1" },
  { puerto: 3932, servicio: "Monitor Ethernet CMS", ruta: "tools/cms-lan-bridge", host: "127.0.0.1" },
  { puerto: 3933, servicio: "Termómetro K3 Pro", ruta: "tools/k3pro-bridge", host: "127.0.0.1" },
];

const COM_PORTS = [
  { com: "COM4", equipo: "CMS50D+", chipset: "Silicon Labs CP210x", baud: "—", notas: "No usar CH340 de la báscula" },
  { com: "COM7", equipo: "Lejia HW-701", chipset: "CH340", baud: "4800", notas: "RS232→USB" },
  { com: "COM8", equipo: "K3 Pro", chipset: "USB serial", baud: "115200", notas: "Modo corporal (T body)" },
];

function styleHeader(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F766E" },
  };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 24;
}

function addAutoFilter(ws, cols) {
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: cols },
  };
}

const wb = new ExcelJS.Workbook();
wb.creator = "MaindHealth";
wb.created = new Date();
wb.description = "Inventario de hardware — estación MaindHealth";

// —— Hoja 1: Inventario completo ——
const ws = wb.addWorksheet("Inventario hardware", {
  views: [{ state: "frozen", ySplit: 1 }],
});
ws.columns = [
  { header: "#", key: "id", width: 5 },
  { header: "Equipo", key: "equipo", width: 32 },
  { header: "Modelo / marca", key: "modelo", width: 28 },
  { header: "Categoría", key: "categoria", width: 16 },
  { header: "Paquete", key: "paquete", width: 22 },
  { header: "Estado", key: "estado", width: 20 },
  { header: "Conexión", key: "conexion", width: 24 },
  { header: "Puerto COM", key: "puertoCom", width: 12 },
  { header: "MAC BLE", key: "mac", width: 20 },
  { header: "Bridge :puerto", key: "bridgePuerto", width: 14 },
  { header: "Bridge / ruta", key: "bridge", width: 28 },
  { header: "Métricas", key: "metricas", width: 34 },
  { header: "Módulo software", key: "modulo", width: 28 },
  { header: "Notas", key: "notas", width: 48 },
];
styleHeader(ws.getRow(1));
for (const row of HARDWARE) {
  const r = ws.addRow(row);
  r.alignment = { vertical: "middle", wrapText: true };
  // Colorear por estado
  const estado = String(row.estado);
  let color = null;
  if (estado.includes("Activo") || estado === "Requerido") color = "FFECFDF5";
  else if (estado.includes("Retirado") || estado.includes("No aplica")) color = "FFFEE2E2";
  else if (estado.includes("Futuro") || estado.includes("Pendiente") || estado.includes("Opcional"))
    color = "FFFFF7ED";
  else if (estado.includes("Recomendado") || estado.includes("Software")) color = "FFEFF6FF";
  if (color) {
    r.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    });
  }
}
addAutoFilter(ws, 14);

// —— Hoja 2: Paquete mínimo ——
const min = wb.addWorksheet("Paquete mínimo", {
  views: [{ state: "frozen", ySplit: 1 }],
});
min.columns = [
  { header: "#", key: "id", width: 5 },
  { header: "Equipo", key: "equipo", width: 32 },
  { header: "Modelo", key: "modelo", width: 28 },
  { header: "Conexión", key: "conexion", width: 24 },
  { header: "COM / MAC", key: "idLink", width: 22 },
  { header: "Bridge", key: "bridgePuerto", width: 10 },
  { header: "Métricas", key: "metricas", width: 36 },
];
styleHeader(min.getRow(1));
for (const row of HARDWARE.filter((h) => h.paquete === "Mínimo de arranque" && h.categoria === "Clínico")) {
  min.addRow({
    id: row.id,
    equipo: row.equipo,
    modelo: row.modelo,
    conexion: row.conexion,
    idLink: row.puertoCom !== "—" ? row.puertoCom : row.mac,
    bridgePuerto: row.bridgePuerto,
    metricas: row.metricas,
  }).alignment = { vertical: "middle", wrapText: true };
}
min.addRow({});
min.addRow({ equipo: "Tecnológico mínimo", modelo: "cámara + bocina fija + micrófono fijo + pantalla + PC + conectividad" });
addAutoFilter(min, 7);

// —— Hoja 3: Bridges ——
const br = wb.addWorksheet("Bridges y puertos", {
  views: [{ state: "frozen", ySplit: 1 }],
});
br.columns = [
  { header: "Puerto local", key: "puerto", width: 14 },
  { header: "Servicio", key: "servicio", width: 28 },
  { header: "Host", key: "host", width: 14 },
  { header: "Ruta tools/", key: "ruta", width: 32 },
  { header: "URL", key: "url", width: 36 },
];
styleHeader(br.getRow(1));
for (const b of BRIDGES) {
  br.addRow({
    ...b,
    url: `http://${b.host}:${b.puerto}`,
  });
}
addAutoFilter(br, 5);

br.addRow({});
br.addRow({ puerto: "COM", servicio: "Mapeo USB serial de esta estación" });
const comHeader = br.addRow({
  puerto: "COM",
  servicio: "Equipo",
  host: "Chipset",
  ruta: "Baudios",
  url: "Notas",
});
comHeader.font = { bold: true };
for (const c of COM_PORTS) {
  br.addRow({
    puerto: c.com,
    servicio: c.equipo,
    host: c.chipset,
    ruta: c.baud,
    url: c.notas,
  });
}

// —— Hoja 4: Resumen ——
const sum = wb.addWorksheet("Resumen");
sum.columns = [
  { header: "Categoría / estado", key: "k", width: 36 },
  { header: "Cantidad", key: "v", width: 12 },
];
styleHeader(sum.getRow(1));

const byCat = new Map();
const byEstado = new Map();
for (const h of HARDWARE) {
  byCat.set(h.categoria, (byCat.get(h.categoria) || 0) + 1);
  byEstado.set(h.estado, (byEstado.get(h.estado) || 0) + 1);
}
sum.addRow({ k: "TOTAL equipos listados", v: HARDWARE.length }).font = { bold: true };
sum.addRow({});
sum.addRow({ k: "Por categoría", v: "" }).font = { bold: true };
for (const [k, v] of [...byCat.entries()].sort()) sum.addRow({ k, v });
sum.addRow({});
sum.addRow({ k: "Por estado", v: "" }).font = { bold: true };
for (const [k, v] of [...byEstado.entries()].sort()) sum.addRow({ k, v });
sum.addRow({});
sum.addRow({
  k: "Fuente",
  v: "docs/EQUIPMENT.md + tools/*-bridge + seed catalog_device_types",
});
sum.addRow({
  k: "Fecha exportación",
  v: new Date().toISOString().slice(0, 10),
});

const outDir = path.join(root, "docs");
fs.mkdirSync(outDir, { recursive: true });
const outDocs = path.join(outDir, "inventario-hardware-maindhealth.xlsx");
const outDesktop = path.join(
  process.env.USERPROFILE || "",
  "Desktop",
  "inventario-hardware-maindhealth.xlsx",
);

await wb.xlsx.writeFile(outDocs);
console.log(`OK ${HARDWARE.length} equipos → ${outDocs}`);

if (outDesktop && fs.existsSync(path.dirname(outDesktop))) {
  await wb.xlsx.writeFile(outDesktop);
  console.log(`OK copia Desktop → ${outDesktop}`);
}
