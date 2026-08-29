import type { KioskStep } from "@/lib/db/schema/station-kiosk";

const MUTE_KEY = "maindhealth:kiosk-voice-muted";

/** Cómo debe sonar la marca en voz (TTS). */
export const BRAND_VOICE = "Mainjeealt";

/** Bienvenida hablada al iniciar consulta. */
export const KIOSK_WELCOME_VOICE = `Bienvenido a la estación de telemedicina de ${BRAND_VOICE}. Estamos aquí para cuidarle.`;

function joinVoiceSteps(steps: readonly string[]) {
  return steps.join(" ");
}

/** Instrucciones en pantalla = mismas frases que habla la bocina (una por botón). */
export const WEIGHT_HEIGHT_VOICE_STEPS = [
  "Paso uno: peso y altura.",
  "Toque Leer báscula ahora para iniciar.",
  "Luego súbase, párese erguido mirando al frente, y espere.",
  "Cuando termine, la voz le dirá que baje y toque Continuar.",
] as const;

export const BLOOD_PRESSURE_VOICE_STEPS = [
  "Paso dos: presión arterial.",
  "Toque Leer presión ahora. El cable USB se queda puesto.",
  "Coloque el brazalete en el brazo izquierdo, a la altura del corazón, y pulse inicio en el aparato.",
  "Cuando vea el número, toque Ya vi el resultado. Luego retire el brazalete y colóquelo en su lugar.",
] as const;

export const OXYGEN_VOICE_STEPS = [
  "Paso tres: oxígeno y pulso.",
  "Encienda el oxímetro, coloque el dedo hasta el fondo y toque Leer oxímetro ahora para iniciar.",
  "Espere la lectura estable.",
  "Al terminar, retire el oxímetro y colóquelo en su lugar asignado.",
] as const;

/** Nota visible/hablada: uñas largas o artificiales. */
export const OXYGEN_NAIL_TIP =
  "Si tiene uñas largas o artificiales, coloque el dedo de lado para obtener una buena lectura.";

export const TEMPERATURE_VOICE_STEPS = [
  "Paso cuatro: temperatura.",
  "Tome el termómetro de su lugar asignado.",
  "Colóquelo en la axila, bien pegado a la piel, y baje el brazo para sujetarlo.",
  "Manténgalo así hasta que termine la medición.",
  "Al terminar, retire el termómetro y colóquelo de nuevo en su lugar asignado.",
] as const;

export const ECG_VOICE_STEPS = [
  "Paso cinco: electrocardiograma de un solo canal.",
  "Siéntese y coloque los dedos de ambas manos sobre las placas metálicas del aparato.",
  "Mida unos treinta segundos. Si el aparato pide guardar, acepte. El cable USB se queda puesto.",
  "Cuando termine, toque Leer electrocardiograma.",
] as const;

/** Frases humanas por paso — guía hablada del kiosko táctil. */
export const KIOSK_VOICE_SCRIPTS: Partial<Record<KioskStep, string>> = {
  welcome: `${KIOSK_WELCOME_VOICE} Escuchará las instrucciones por la bocina de la estación. Toque Iniciar atención cuando esté listo. Si se siente muy mal, hay una opción de ayuda urgente.`,
  service: `Con calma, elija el servicio que necesita. Estamos con usted en cada paso.`,
  payment:
    "Escriba su correo electrónico con el teclado táctil. Luego toque Generar QR para pagar. Escanee el código con su celular, pague ahí con su tarjeta, y esta pantalla continuará sola cuando el pago quede aprobado.",
  identification: `Díganos si es su primera visita a ${BRAND_VOICE}, o si ya tiene su perfil. También puede entrar con su usuario y contraseña. Si los olvidó, elija Olvidé mi usuario o contraseña: búsquese por teléfono o correo y cree una clave nueva.`,
  registration:
    "Vamos a registrar sus datos con cuidado. Use el teclado en pantalla si lo necesita. El correo electrónico es obligatorio: ahí le enviaremos su receta. Al final puede crear un usuario sencillo para volver más rápido la próxima vez.",
  symptoms:
    "Cuéntenos qué siente. Toque las opciones que mejor describan cómo se encuentra. Las tarjetas en color ámbar son síntomas de alerta: si marca uno, priorizaremos teleconsulta con un médico si es necesario. Deslice hacia abajo si no ve todas las opciones. No hay prisa.",
  antecedents:
    "Su historial de salud. Responda sí o no: diabetes, presión alta, asma, corazón y alergias a medicamentos. Luego toque Continuar.",
  consent:
    "Le pedimos su consentimiento informado. Escuche o lea con calma, escriba su nombre y acepte para continuar. Estamos para cuidarle.",
  clinical:
    "Seleccione sus síntomas y complete el formulario. Debe aceptar el consentimiento antes de continuar.",
  preparation:
    "Muy bien. Ahora tomaremos sus signos vitales, uno por uno. En cada aparato le diremos cuándo iniciar y cuándo terminó. Toque Continuar para empezar con la báscula: peso y altura.",
  weight_height: joinVoiceSteps(WEIGHT_HEIGHT_VOICE_STEPS),
  blood_pressure: joinVoiceSteps(BLOOD_PRESSURE_VOICE_STEPS),
  oxygen: joinVoiceSteps(OXYGEN_VOICE_STEPS),
  temperature: joinVoiceSteps(TEMPERATURE_VOICE_STEPS),
  ecg: joinVoiceSteps(ECG_VOICE_STEPS),
  summary:
    "Revise sus signos vitales. Cada uno muestra el rango normal y si está dentro o fuera. Esta información también quedará en su receta, de forma clara, para que el médico y usted la tengan. Cuando esté listo, toque Revisar mi atención con el equipo médico.",
  analysis:
    "Un momento, por favor. El equipo médico de la estación está revisando su información con cuidado. Quédese aquí.",
  result:
    "Su receta se enviará a su correo electrónico. Indique si también desea una copia impresa: toque Sí o No. Cualquier opción termina la atención y vuelve al inicio.",
  waiting: `Respire despacio. Mire la pantalla principal frente a usted, donde está la cámara. Hable hacia el micrófono de la estación. Un doctor se conectará pronto. Aquí en la pantalla táctil ya no necesita tocar nada.`,
  consultation:
    "La teleconsulta está en la pantalla principal. Mire a la cámara y hable con claridad hacia el micrófono. Está en buenas manos.",
};

/** Ayuda urgente: primero pagar (QR en celular), luego teleconsulta. */
export const CRISIS_PAY_FIRST_VOICE =
  "Entendido. Primero realizaremos el pago de la consulta general. Escriba su correo, genere el código QR y páguelo con su celular. Cuando el pago quede aprobado, avisaremos al médico de inmediato.";

/** Tras mostrar el QR de Stripe: guía mientras espera el pago en el celular. */
export const STRIPE_QR_WAITING_VOICE =
  "Escanee el código QR con su celular y complete el pago allí. Puede escribir el número de tarjeta en su teléfono. Esta pantalla detectará el pago sola; no hace falta acercar la tarjeta a ningún terminal.";

/** Teleconsulta terminó: liberar kiosco. */
export const TELECONSULTA_ENDED_VOICE =
  "Su teleconsulta terminó. Gracias. La estación queda lista para el siguiente paciente.";

/** Mensajes de calma en modo crisis (se rotan). */
export const CRISIS_CALM_SCRIPTS = [
  "Está a salvo. Quédese aquí con nosotros. Respire despacio: inspire por la nariz… y suelte el aire por la boca.",
  "Todo estará bien. Un médico de la estación se está conectando para atenderle. No está solo.",
  "Relaje los hombros. Respire otra vez con calma. Estamos cuidándole en este momento.",
  "Muy bien. Siga respirando lento. En un momento verá al doctor en la pantalla de enfrente.",
];

/** Segunda página del historial (medicamentos). */
export const ANTECEDENTS_PAGE2_VOICE =
  "¿Toma algún medicamento actualmente? Si sí, escríbalo. Si no toma ninguno, déjelo vacío y toque Continuar.";

/** Al iniciar la lectura: recordar subir a la báscula. */
export const SCALE_MOUNT_VOICE =
  "Iniciamos peso y altura. Súbase a la báscula ahora. Párese erguido, mirando al frente, y quédese quieto.";

/** Tras registrar peso y altura con éxito. */
export const SCALE_SUCCESS_VOICE =
  "Listo. Terminó la medición de peso y altura. Baje de la báscula con cuidado y toque Continuar.";

/** Al iniciar lectura del oxímetro (botón). */
export const OXYGEN_START_VOICE =
  "Iniciamos la lectura del oxímetro. Mantenga el dedo quieto hasta que terminemos. Si tiene uñas largas o artificiales, coloque el dedo de lado para obtener una buena lectura.";

/** Tras SpO₂/FC: retirar y devolver al lugar. */
export const OXYGEN_SUCCESS_VOICE =
  "Listo. Terminó la medición de oxígeno y pulso. Retire el oxímetro del dedo y colóquelo de nuevo en su lugar asignado. Luego toque Continuar.";

/** Al iniciar lectura de presión (botón). */
export const BP_START_VOICE =
  "El cable se queda puesto. Coloque el brazalete y pulse el botón de inicio en el aparato. Cuando vea el número, toque Ya vi el resultado.";

/** Tras presión arterial: retirar brazalete y devolver. */
export const BP_SUCCESS_VOICE =
  "Listo. Terminó la medición de la presión. Retire el brazalete del brazo y colóquelo de nuevo en su lugar asignado. Luego toque Continuar.";

/** Tras temperatura: retirar termómetro y devolver. */
export const TEMP_SUCCESS_VOICE =
  "Listo. Terminó la medición de temperatura. Retire el termómetro de la axila y colóquelo de nuevo en su lugar asignado. Luego toque Continuar.";

/** Al iniciar lectura del ECG (botón). */
export const ECG_START_VOICE =
  "Buscamos el electrocardiograma en el aparato. Si ya midió y guardó, deje el USB conectado. Si aún no mide, hágalo ahora y luego toque Leer otra vez.";

/** Tras ECG. */
export const ECG_SUCCESS_VOICE =
  "Listo. Terminó el electrocardiograma. Puede soltar las placas y toque Continuar.";

/** Frases de fin por paso de signos vitales (cuando la lectura queda registrada). */
export const VITAL_DONE_VOICE: Partial<Record<KioskStep, string>> = {
  weight_height: SCALE_SUCCESS_VOICE,
  blood_pressure: BP_SUCCESS_VOICE,
  oxygen: OXYGEN_SUCCESS_VOICE,
  temperature: TEMP_SUCCESS_VOICE,
  ecg: ECG_SUCCESS_VOICE,
};


/** Limpia texto para TTS: sin símbolos que se lean en voz alta, con pausas naturales. */
export function sanitizeForSpeech(text: string): string {
  return text
    .replace(/MaindHealth/gi, BRAND_VOICE)
    .replace(/Maind Health/gi, BRAND_VOICE)
    .replace(/Maindjealt/gi, BRAND_VOICE)
    .replace(/Maindgeeealt/gi, BRAND_VOICE)
    .replace(/Mainjeealt/gi, BRAND_VOICE)
    .replace(/\s*[·•|/\\]\s*/g, ". ")
    .replace(/\s*[–—]\s*/g, ", ")
    .replace(/[/\\]/g, " ")
    .replace(/[«»""„]/g, "")
    .replace(/[{}[\]()<>]/g, " ")
    .replace(/[*_#=`~^]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*\.\s*\./g, ".")
    .trim();
}

function forSpeech(text: string): string {
  return sanitizeForSpeech(text);
}

export function isKioskVoiceMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setKioskVoiceMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function pickSpanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => /es-MX/i.test(v.lang)) ||
    voices.find((v) => /es-US/i.test(v.lang)) ||
    voices.find((v) => /^es\b/i.test(v.lang)) ||
    voices.find((v) => /spanish|español/i.test(v.name));
  return preferred ?? null;
}

export function stopKioskVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function speakKiosk(
  text: string,
  opts?: { force?: boolean; onEnd?: () => void },
) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    opts?.onEnd?.();
    return;
  }
  if (!opts?.force && isKioskVoiceMuted()) {
    opts?.onEnd?.();
    return;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    opts?.onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(forSpeech(trimmed));
  utter.lang = "es-MX";
  utter.rate = 0.9;
  utter.pitch = 1;
  utter.volume = 1;
  const voice = pickSpanishVoice();
  if (voice) utter.voice = voice;

  let ended = false;
  let started = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    opts?.onEnd?.();
  };
  utter.onend = finish;
  utter.onerror = finish;

  const speakNow = () => {
    if (started || ended) return;
    started = true;
    try {
      window.speechSynthesis.resume();
    } catch {
      /* ignore */
    }
    window.speechSynthesis.speak(utter);
  };

  // Edge: cancel() a veces bloquea el siguiente speak si es inmediato.
  const startDelayMs = opts?.force ? 80 : 120;
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      window.setTimeout(speakNow, startDelayMs);
    }, { once: true });
    window.setTimeout(speakNow, 350);
  } else {
    window.setTimeout(speakNow, startDelayMs);
  }
}

export function speakKioskStep(step: KioskStep, opts?: { force?: boolean }) {
  const script = KIOSK_VOICE_SCRIPTS[step];
  if (script) speakKiosk(script, opts);
}

/**
 * Habla un error de validación de forma humana:
 * sin símbolos, y con pausa entre cada punto pendiente.
 */
export function speakKioskError(message: string) {
  const raw = message.trim();
  if (!raw) return;
  const parts = raw
    .split(/\s*[·|;]\s*|\.\s+/)
    .map((p) => sanitizeForSpeech(p.replace(/^\d+\.\s*/, "")))
    .filter((p) => p.length > 2);
  const body =
    parts.length <= 1
      ? sanitizeForSpeech(raw)
      : parts.map((p, i) => `${i + 1}. ${p}`).join(". ");
  speakKiosk(`Un momento. ${body}. Cuando lo complete, toque Continuar.`, {
    force: true,
  });
}
