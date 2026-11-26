import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const componentsDir = path.join(root, "src", "components");

const CATEGORY_LABELS = {
  root: "Raíz / Layout",
  forms: "Formularios",
  station: "Estación / Kiosk",
  portal: "Portal paciente",
  intake: "Intake / Triage",
  devices: "Dispositivos",
  notifications: "Notificaciones",
  ui: "UI compartida",
  video: "Videoconsulta",
  vitals: "Signos vitales",
};

const DESCRIPTIONS = {
  BrandLogo: "Logo de marca MaindHealth",
  MaindOsLogo: "Logo Maind OS",
  LoginFormWrapper: "Formulario de inicio de sesión (wrapper)",
  ModulePlaceholder: "Placeholder para módulos aún no implementados",
  Sidebar: "Navegación lateral del dashboard",
  UsbOximeterReader: "Lectura de oxímetro USB en estación",
  AcknowledgeAlertButton: "Botón para acusar recibo de alertas clínicas",
  CatalogOption: "Tipo de opción de catálogo",
  CatalogAutocomplete: "Autocompletado de síntomas/diagnósticos/medicamentos",
  CatalogSymptomsPanel: "Panel CRUD de catálogo de síntomas",
  CatalogDiagnosesPanel: "Panel CRUD de catálogo de diagnósticos",
  CatalogMedicationsPanel: "Panel CRUD de catálogo de medicamentos",
  ClinicalRecordForm: "Formulario de expediente clínico",
  ConsultationWorkspace: "Workspace de consulta médica (SOAP / atención)",
  CrisisPatientCompleteForm: "Completar datos de paciente en modo crisis",
  DeviceEditor: "Editor de dispositivo médico",
  StatusBadge: "Badge de estado de dispositivo",
  DeviceReadingForm: "Registro de lectura de dispositivo",
  DoctorTeleconsultaContactForm: "Contacto de teleconsulta del médico",
  EditPatientDemographicsForm: "Edición de demográficos del paciente",
  EditPatientKioskCredentialsForm: "Credenciales kiosk del paciente",
  EditUserProfileForm: "Edición de perfil de usuario",
  FocusRecetaOnLoad: "Enfoca sección de receta al cargar",
  FollowUpForm: "Formulario de seguimiento",
  LabResultForm: "Carga / captura de resultados de laboratorio",
  NewAppointmentForm: "Alta de cita (dashboard)",
  NewDeviceForm: "Alta de dispositivo",
  NewPatientForm: "Alta de paciente",
  NewUserForm: "Alta de usuario del sistema",
  PatientAdminActions: "Acciones administrativas sobre paciente",
  PaymentPanel: "Panel de pagos (dashboard)",
  PortalAppointmentForm: "Solicitud de cita desde portal",
  SignPrescriptionButton: "Firmar receta",
  StationIntakeForm: "Intake clínico en estación",
  UploadDocumentForm: "Subida de documentos clínicos",
  UserAdminActions: "Acciones administrativas de usuario",
  VitalSignsForm: "Captura de signos vitales",
  IntakeSummary: "Resumen de intake del paciente",
  StationKioskPatientPanel: "Panel de paciente en kiosk de estación",
  YesNoDetailList: "Lista sí/no con detalle (antecedentes)",
  MarkAllReadButton: "Marcar todas las notificaciones como leídas",
  MarkReadButton: "Marcar notificación como leída",
  NotificationLink: "Enlace a notificación",
  MessageComposer: "Composer de mensajes del portal",
  MessageThread: "Hilo de mensajes paciente–clínica",
  PortalNav: "Navegación del portal del paciente",
  StripePayButton: "Pago con Stripe en portal",
  BirthDateFields: "Campos de fecha de nacimiento (kiosk)",
  birthDateFromForm: "Helper: parsea fecha de nacimiento del form",
  BodyPainMap: "Mapa corporal de dolor (kiosk)",
  DownloadPrescriptionButton: "Descargar receta en kiosk",
  KardiaStationConnector: "Conector Kardia Mobile en estación",
  KardiaUploadForm: "Subida de ECG Kardia",
  kioskFetch: "Fetch autenticado del kiosk",
  AssessmentPayload: "Tipo payload de assessment kiosk",
  StationService: "Tipo servicio de estación",
  PaymentOrder: "Tipo orden de pago kiosk",
  stripeCheckoutIdOf: "Extrae checkout id de Stripe",
  kioskApiBase: "Base URL API kiosk",
  WelcomeIllustration: "Ilustración bienvenida kiosk",
  BloodPressureIllustration: "Ilustración presión arterial",
  OximeterIllustration: "Ilustración oxímetro",
  ScaleIllustration: "Ilustración báscula",
  ThermometerIllustration: "Ilustración termómetro",
  HeartIllustration: "Ilustración corazón / ECG",
  DigitalScaleHeightIcon: "Icono báscula / talla",
  EcgIllustration: "Ilustración ECG",
  WaitingIllustration: "Ilustración sala de espera",
  VitalIllustrationType: "Tipo de ilustración de vital",
  VitalIllustration: "Ilustración genérica por tipo de vital",
  kioskTextFieldProps: "Props de campos de texto kiosk",
  KioskOnScreenKeyboard: "Teclado en pantalla (kiosk táctil)",
  useKioskVirtualKeyboard: "Hook teclado virtual kiosk",
  KioskShell: "Shell visual del kiosk",
  KIOSK_STEP_ORDER: "Orden de pasos del flujo kiosk",
  KIOSK_STEP_SHORT: "Etiquetas cortas de pasos kiosk",
  KIOSK_SCROLL_ALLOWED_STEPS: "Pasos kiosk con scroll permitido",
  kioskTitleClassName: "Clase CSS título kiosk",
  kioskSubtitleClassName: "Clase CSS subtítulo kiosk",
  kioskBodyClassName: "Clase CSS cuerpo de texto kiosk",
  kioskHelperClassName: "Clase CSS texto de ayuda kiosk",
  kioskLabelClassName: "Clase CSS labels kiosk",
  kioskInputClassName: "Clase CSS inputs kiosk",
  kioskChipClassName: "Clase CSS chips kiosk",
  KioskPrimaryButton: "Botón primario del kiosk",
  KioskContinueRoundButton: "Botón redondo continuar kiosk",
  KioskVitalsNavBar: "Barra de navegación entre vitales",
  KioskSecondaryButton: "Botón secundario del kiosk",
  KioskCard: "Card contenedor del kiosk",
  KioskError: "Mensaje de error kiosk",
  KioskImportant: "Aviso importante kiosk",
  KioskInfo: "Mensaje informativo kiosk",
  KioskScrollArea: "Área con scroll del kiosk",
  StatusPill: "Pill de estado en kiosk",
  PatientKioskWizard: "Wizard principal del paciente en kiosk",
  SymptomGuide: "Guía de síntomas en kiosk",
  useKioskVoice: "Hook de voz / TTS en kiosk",
  VitalsPanel: "Panel de vitales en kiosk",
  VitalsSummaryGrid: "Grid resumen de vitales",
  VitalStepScreen: "Pantalla de un paso de vital",
  StationAutoPrintWatcher: "Watcher de impresión automática en estación",
  StationCancelSalaButton: "Cancelar sala de teleconsulta",
  StationFlowWizard: "Wizard de flujo operativo de estación",
  StationSalaCallEndWatcher: "Detecta fin de llamada en sala",
  StationSalaOpenedSignal: "Señal de sala abierta",
  StationStandbyScreen: "Pantalla standby de estación",
  StationTeleconsultaAutoPilot: "Autopilot de teleconsulta en estación",
  kioskApi: "Cliente API del kiosk (login, vitals, pago, etc.)",
  VitalsDraft: "Tipo borrador de vitales",
  KioskSessionPayload: "Tipo sesión kiosk",
  PatientPayload: "Tipo payload de paciente kiosk",
  AppointmentPayload: "Tipo payload de cita kiosk",
  RegisterResult: "Tipo resultado de registro kiosk",
  KioskAntecedents: "Tipo antecedentes en kiosk",
  KioskLoginResult: "Tipo resultado de login kiosk",
  CrisisResult: "Tipo resultado modo crisis",
  PageHeader: "Encabezado de página",
  FormAlert: "Alerta de formulario",
  SubmitButton: "Botón submit estándar",
  CancelLink: "Link de cancelar",
  DailyVideoRoom: "Sala de video Daily.co",
  VitalSignsCharts: "Gráficas de signos vitales",
};

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx|ts)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name))
      out.push(full);
  }
  return out;
}

function categoryOf(rel) {
  const parts = rel.replace(/\\/g, "/").split("/");
  // src/components/X/...
  if (parts.length === 3) return "root";
  return parts[2] || "other";
}

function extractExports(content) {
  const names = new Set();
  const re1 =
    /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|type|interface|enum)\s+(\w+)/g;
  let m;
  while ((m = re1.exec(content))) names.add(m[1]);
  const re2 = /export\s+\{([^}]+)\}/g;
  while ((m = re2.exec(content))) {
    for (const part of m[1].split(",")) {
      const cleaned = part
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/, "")
        .trim();
      if (!cleaned) continue;
      const asMatch = cleaned.match(/^(\w+)\s+as\s+(\w+)$/);
      if (asMatch) names.add(asMatch[2]);
      else {
        const id = cleaned.match(/^(\w+)/);
        if (id) names.add(id[1]);
      }
    }
  }
  return [...names];
}

function kindOf(name, file) {
  if (name.startsWith("use") && /[A-Z]/.test(name[3] || "")) return "Hook";
  if (/^[A-Z_0-9]+$/.test(name) && name.includes("_")) return "Constante";
  if (/Payload|Option|Service|Order|Type|Props$/.test(name)) return "Tipo / util";
  if (file.endsWith(".ts") && !file.endsWith(".tsx")) {
    if (/^[a-z]/.test(name)) return "Utilidad / API";
    return "Tipo / constante";
  }
  if (/Illustration$/.test(name)) return "Ilustración";
  if (/Button|Link|Badge|Panel|Form|Wizard|Screen|Shell|Room|Charts|Map|Keyboard|Watcher|Signal|Logo|Sidebar|Header|Alert|Grid|Composer|Thread|Nav|Reader|Workspace|Guide|Connector|Fields$/.test(name))
    return "Componente";
  if (/^[A-Z]/.test(name)) return "Componente";
  return "Utilidad";
}

const files = walk(componentsDir).sort();
const rows = [];
let n = 0;

for (const full of files) {
  const rel = path.relative(root, full).replace(/\\/g, "/");
  const cat = categoryOf(rel);
  const content = fs.readFileSync(full, "utf8");
  const lines = content.split(/\r?\n/).length;
  const exports = extractExports(content);
  const list = exports.length ? exports : [path.basename(full, path.extname(full))];
  for (const name of list) {
    n += 1;
    rows.push({
      "#": n,
      Componente: name,
      Tipo: kindOf(name, full),
      Categoría: CATEGORY_LABELS[cat] || cat,
      Carpeta: cat,
      Archivo: path.basename(full),
      Ruta: rel,
      Líneas: lines,
      Descripción: DESCRIPTIONS[name] || "",
    });
  }
}

const wb = new ExcelJS.Workbook();
wb.creator = "MaindHealth";
wb.created = new Date();

const ws = wb.addWorksheet("Componentes", {
  views: [{ state: "frozen", ySplit: 1 }],
});

ws.columns = [
  { header: "#", key: "#", width: 6 },
  { header: "Componente", key: "Componente", width: 36 },
  { header: "Tipo", key: "Tipo", width: 16 },
  { header: "Categoría", key: "Categoría", width: 20 },
  { header: "Carpeta", key: "Carpeta", width: 14 },
  { header: "Archivo", key: "Archivo", width: 38 },
  { header: "Ruta", key: "Ruta", width: 62 },
  { header: "Líneas", key: "Líneas", width: 10 },
  { header: "Descripción", key: "Descripción", width: 48 },
];

const header = ws.getRow(1);
header.font = { bold: true, color: { argb: "FFFFFFFF" } };
header.fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF0F766E" },
};
header.alignment = { vertical: "middle" };
header.height = 22;

for (const row of rows) {
  const r = ws.addRow(row);
  r.alignment = { vertical: "middle", wrapText: true };
}

ws.autoFilter = {
  from: { row: 1, column: 1 },
  to: { row: 1, column: 9 },
};

// Resumen por categoría
const summary = wb.addWorksheet("Resumen");
summary.columns = [
  { header: "Categoría", key: "cat", width: 24 },
  { header: "Archivos", key: "files", width: 12 },
  { header: "Exports / componentes", key: "exports", width: 22 },
];
const sh = summary.getRow(1);
sh.font = { bold: true, color: { argb: "FFFFFFFF" } };
sh.fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF0F766E" },
};

const byCat = new Map();
for (const full of files) {
  const rel = path.relative(root, full).replace(/\\/g, "/");
  const cat = CATEGORY_LABELS[categoryOf(rel)] || categoryOf(rel);
  const content = fs.readFileSync(full, "utf8");
  const exports = extractExports(content);
  const cur = byCat.get(cat) || { files: 0, exports: 0 };
  cur.files += 1;
  cur.exports += exports.length || 1;
  byCat.set(cat, cur);
}
for (const [cat, v] of [...byCat.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  summary.addRow({ cat, files: v.files, exports: v.exports });
}
summary.addRow({});
summary.addRow({
  cat: "TOTAL",
  files: files.length,
  exports: rows.length,
});
summary.getRow(summary.lastRow.number).font = { bold: true };

const outDir = path.join(root, "docs");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "inventario-componentes-maindhealth.xlsx");
await wb.xlsx.writeFile(outPath);
console.log(`OK ${rows.length} filas → ${outPath}`);
console.log(`Archivos: ${files.length}`);
