/**
 * Catálogo de protocolos ambulatorios de estación — BORRADOR para firma médica.
 *
 * Fuentes orientativas (no sustituyen criterio clínico ni GPC vigentes del médico firmante):
 * - CENETEC / Secretaría de Salud (faringoamigdalitis, IRAs)
 * - Consenso resistencia antimicrobiana (México) — criterios tipo Centor
 * - GPC IMSS / literatura IVU no complicada (nitrofurantoína, fosfomicina)
 * - Práctica ambulatoria estándar: dispepsia, cefalea tensional, lumbalgia mecánica
 *
 * ESTADO: pending_physician_signoff
 * El médico responsable debe revisar dosis, duración, exclusiones y activar en producción.
 */

import type { ProtocolMedication } from "@/lib/db/schema/station-commerce";

export type StationProtocolDraft = {
  code: string;
  name: string;
  description: string;
  diagnosisLabel: string;
  /** Match del motivo de consulta (frases específicas). */
  keywords: string[];
  /** Si aparecen en el motivo/antecedentes → NO emitir receta; teleconsulta. */
  exclusionKeywords: string[];
  /** Criterios de inclusión (texto para el médico). */
  inclusion: string[];
  /** Criterios de exclusión (texto para el médico). */
  exclusion: string[];
  treatmentPlan: string;
  instructions: string;
  medications: ProtocolMedication[];
  /** Referencias bibliográficas / guías (revisión humana). */
  references: string[];
  /** Severidad máxima autonómica. */
  maxAutonomousSeverity: "low" | "moderate";
};

export const STATION_PROTOCOL_DRAFTS: StationProtocolDraft[] = [
  {
    code: "GI_LEVE",
    name: "Dispepsia / molestia epigástrica leve",
    description:
      "Molestia en boca del estómago o acidez sin signos de alarma digestiva. Autónomo solo si es leve-moderado.",
    diagnosisLabel: "Dispepsia / síndrome dispéptico leve",
    keywords: [
      "dolor en epigastrio",
      "boca del estómago",
      "gastritis",
      "acidez",
      "indigestión",
      "indigestion",
      "ardor estomacal",
      "reflujo",
    ],
    exclusionKeywords: [
      "sangre en vomito",
      "vómito con sangre",
      "heces negras",
      "melena",
      "dolor intenso",
      "abdomen en tabla",
      "ictericia",
      "embarazo",
    ],
    inclusion: [
      "Adulto ≥18 años",
      "Molestia epigástrica o pirosis ≤7 días o recurrente leve conocida",
      "Sin signos de alarma digestiva",
      "Puede tolerar vía oral",
    ],
    exclusion: [
      "Hematemesis, melena o rectorragia",
      "Dolor abdominal intenso / defensa",
      "Pérdida de peso no intencional, disfagia progresiva",
      "Embarazo conocido o sospechado",
      "Antecedente de úlcera complicada reciente sin seguimiento",
    ],
    treatmentPlan:
      "Dieta blanda, evitar AINE/alcohol/irritantes. IBP a dosis estándar 7 días. Antiácido a demanda corto plazo.",
    instructions:
      "Si aparece sangre, heces negras, dolor intenso, vómito incoercible o mareo, detenga el tratamiento y solicite teleconsulta o urgencias.",
    medications: [
      {
        medication: "Omeprazol",
        dose: "20 mg",
        frequency: "Cada 24 horas en ayunas",
        duration: "7 días",
        route: "Oral",
        instructions: "30 minutos antes del desayuno.",
      },
      {
        medication: "Hidróxido de aluminio y magnesio (antiácido)",
        dose: "10 ml",
        frequency: "Cada 8 horas si hay ardor",
        duration: "3 días",
        route: "Oral",
        instructions: "Después de alimentos o al sentir ardor. Separar 2 h del omeprazol.",
      },
    ],
    references: [
      "Práctica clínica ambulatoria dispepsia funcional / pirosis sin alarmas (GPC locales a validar por médico firmante).",
    ],
    maxAutonomousSeverity: "moderate",
  },
  {
    code: "DIARREA_LEVE",
    name: "Diarrea aguda leve sin deshidratación",
    description: "Diarrea acuosa sin sangre ni signos de deshidratación moderada-grave.",
    diagnosisLabel: "Diarrea aguda leve",
    keywords: ["diarrea", "evacuaciones líquidas", "heces líquidas"],
    exclusionKeywords: [
      "sangre en heces",
      "heces con sangre",
      "fiebre alta",
      "deshidratacion",
      "deshidratación",
      "no orina",
      "embarazo",
      "vómito incoercible",
    ],
    inclusion: [
      "Adulto ≥18 años",
      "Diarrea <7 días",
      "Sin sangre visible",
      "Tolera líquidos por vía oral",
    ],
    exclusion: [
      "Disentería / sangre en heces",
      "Signos de deshidratación moderada-grave",
      "Inmunosupresión conocida",
      "Embarazo",
      "Diarrea del viajero prolongada o post-antibiótico grave (sospecha C. difficile) → médico",
    ],
    treatmentPlan:
      "Rehidratación oral prioritaria. Racecadotrilo sintomático. No antibiótico empírico de rutina.",
    instructions:
      "Beba sales de rehidratación. Si hay sangre, fiebre alta, mucha sed, mareo o no orina, teleconsulta/urgencias. No use antidiarreicos tipo loperamida si hay fiebre o sangre.",
    medications: [
      {
        medication: "Sales de rehidratación oral",
        dose: "según sed",
        frequency: "Tras cada evacuación líquida",
        duration: "2–3 días",
        route: "Oral",
        instructions: "Preparar según instructivo del sobre; beber a sorbos.",
      },
      {
        medication: "Racecadotrilo",
        dose: "100 mg",
        frequency: "Cada 8 horas",
        duration: "3 días",
        route: "Oral",
        instructions: "Suspender al normalizar evacuaciones.",
      },
    ],
    references: [
      "Manejo sintomático diarrea aguda ambulatoria; antibiótico solo si disentería o criterios específicos (revisión médica).",
    ],
    maxAutonomousSeverity: "low",
  },
  {
    code: "NAUSEA_LEVE",
    name: "Náusea / vómito leve",
    description: "Náuseas con o sin vómito ocasional, sin abdomen agudo.",
    diagnosisLabel: "Náusea/vómito leve",
    keywords: ["náuseas y vómito", "náuseas", "nauseas", "vómito", "vomito"],
    exclusionKeywords: [
      "sangre",
      "proyectil",
      "abdomen en tabla",
      "embarazo",
      "trauma craneal",
      "cefalea intensa",
    ],
    inclusion: ["Adulto ≥18 años", "Vómito <5 veces/24 h o náusea predominante", "Tolera sorbos de líquido"],
    exclusion: [
      "Hematemesis",
      "Vómito en proyectil + cefalea intensa",
      "Sospecha abdomen agudo",
      "Embarazo (hiperémesis / evaluación obstétrica)",
      "Diabetes con posible cetoacidosis",
    ],
    treatmentPlan: "Reposo gástrico breve, sorbos de líquidos claros, antiemético corto plazo.",
    instructions:
      "Si no tolera nada por vía oral en 12 h, hay sangre, dolor abdominal intenso o mareo intenso → teleconsulta/urgencias.",
    medications: [
      {
        medication: "Metoclopramida",
        dose: "10 mg",
        frequency: "Cada 8 horas si hay náusea",
        duration: "2 días",
        route: "Oral",
        instructions: "30 min antes de alimentos. Evitar si hay síntomas extrapiramidales; no conducir si causa sueño.",
      },
    ],
    references: ["Uso sintomático antiemético ambulatorio; validar contraindicaciones por médico firmante."],
    maxAutonomousSeverity: "low",
  },
  {
    code: "CEFALEA_LEVE",
    name: "Cefalea tensional / migraña leve conocida",
    description: "Cefalea sin signos neurológicos de alarma.",
    diagnosisLabel: "Cefalea tensional leve",
    keywords: ["dolor de cabeza", "cefalea", "migraña", "migrana", "dolor en la cabeza"],
    exclusionKeywords: [
      "peor dolor de la vida",
      "confusión",
      "debilidad de un lado",
      "visión doble",
      "rigidez de cuello",
      "fiebre con cefalea",
      "trauma",
      "embarazo",
    ],
    inclusion: [
      "Adulto ≥18 años",
      "Cefalea similar a episodios previos o patrón tensional",
      "Sin déficit neurológico reportado",
    ],
    exclusion: [
      "Cefalea en trueno / la peor de la vida",
      "Déficit neurológico focal, convulsión, alteración del alerta",
      "Fiebre + rigidez de cuello",
      "Traumatismo craneal reciente",
      "Embarazo / posparto reciente con cefalea nueva",
    ],
    treatmentPlan: "Analgesia escalonada, hidratación, reposo en ambiente oscuro si migraña.",
    instructions:
      "Si el dolor es el peor de su vida, hay confusión, debilidad, visión doble o fiebre con cuello rígido → urgencias.",
    medications: [
      {
        medication: "Paracetamol",
        dose: "500–1000 mg",
        frequency: "Cada 8 horas si hay dolor",
        duration: "3 días",
        route: "Oral",
        instructions: "No exceder 3 g/día. Cuidado en hepatopatía.",
      },
      {
        medication: "Ibuprofeno",
        dose: "400 mg",
        frequency: "Cada 8 horas si persiste",
        duration: "2 días",
        route: "Oral",
        instructions: "Con alimentos. Evitar si úlcera, IRC, anticoagulación o alergia AINE.",
      },
    ],
    references: ["Criterios de alarma en cefalea (práctica neurológica ambulatoria)."],
    maxAutonomousSeverity: "moderate",
  },
  {
    code: "IRA_VIRAL_LEVE",
    name: "IRA viral / resfriado común",
    description: "Síntomas de vías aéreas superiores sin criterios de antibioticoterapia.",
    diagnosisLabel: "Infección respiratoria alta probable viral",
    keywords: [
      "congestión nasal",
      "resfriado",
      "gripe",
      "moqueo",
      "estornudos",
      "tos seca",
      "tos",
      "fiebre",
      "fiebre con tos",
      "fiebre y congestion",
      "fiebre y congestión",
    ],
    exclusionKeywords: [
      "falta de aire",
      "dificultad para respirar",
      "saturacion",
      "dolor de pecho",
      "fiebre más de 3 días",
      "esputo con sangre",
      "embarazo",
    ],
    inclusion: [
      "Adulto ≥18 años",
      "Congestión, rinorrea, estornudos y/o tos seca",
      "Estado general conservado",
      "Sin hipoxemia ni disnea de reposo",
    ],
    exclusion: [
      "Disnea, SpO₂ baja, dolor torácico",
      "Sospecha neumonía",
      "Inmunosupresión",
      "Embarazo con fiebre",
    ],
    treatmentPlan:
      "Sintomáticos. NO antibiótico empírico (mayoría viral). Hidratación y reposo relativo.",
    instructions:
      "Si aparece falta de aire, dolor de pecho, fiebre >3 días o confusión → teleconsulta inmediata.",
    medications: [
      {
        medication: "Paracetamol",
        dose: "500 mg",
        frequency: "Cada 8 horas si dolor/fiebre",
        duration: "3 días",
        route: "Oral",
        instructions: "Máximo 3 g/día.",
      },
      {
        medication: "Loratadina",
        dose: "10 mg",
        frequency: "Cada 24 horas",
        duration: "5 días",
        route: "Oral",
        instructions: "Si hay congestión/estornudos.",
      },
      {
        medication: "Ambroxol",
        dose: "30 mg",
        frequency: "Cada 8 horas si tos productiva",
        duration: "5 días",
        route: "Oral",
        instructions: "Con abundante agua.",
      },
    ],
    references: [
      "Consenso resistencia antimicrobiana México — evitar antibiótico en IRA viral.",
      "CENETEC / guías IRAs (validar versión vigente).",
    ],
    maxAutonomousSeverity: "low",
  },
  {
    code: "FARINGITIS_BACT",
    name: "Faringoamigdalitis (probable bacteriana) — con antibiótico",
    description:
      "Dolor de garganta con criterios clínicos que justifican antibiótico empírico ambulatorio (tipo Centor alto). Requiere firma médica.",
    diagnosisLabel: "Faringoamigdalitis aguda — esquema amoxicilina",
    keywords: [
      "dolor de garganta",
      "amigdalitis",
      "faringitis",
      "anginas",
      "amígdalas",
      "amigdalas",
      "garganta con pus",
      "fiebre",
      "fiebre y dolor de garganta",
    ],
    exclusionKeywords: [
      "dificultad para tragar saliva",
      "babear",
      "falta de aire",
      "cuello hinchado",
      "estridor",
      "alergia a penicilina",
      "embarazo",
      "mononucleosis",
    ],
    inclusion: [
      "Adulto ≥18 años",
      "Odinofagia + fiebre o exudado o adenopatía dolorosa (criterios tipo Centor ≥3 preferible)",
      "Sin compromiso de vía aérea",
    ],
    exclusion: [
      "Sospecha absceso periamigdalino / vía aérea comprometida",
      "Alergia a penicilina/betalactámicos",
      "Sospecha mononucleosis (evitar amoxicilina si rash típico)",
      "Embarazo (ajustar esquema con médico)",
      "Inmunosupresión",
    ],
    treatmentPlan:
      "Amoxicilina 500 mg c/8 h × 7–10 días (médico puede preferir 10 días). Analgesia. Completar esquema.",
    instructions:
      "Complete TODO el antibiótico. Si no puede tragar saliva, babea, tiene cuello hinchado o falta de aire → urgencias. Si aparece alergia cutánea intensa, detenga y contacte médico.",
    medications: [
      {
        medication: "Amoxicilina",
        dose: "500 mg",
        frequency: "Cada 8 horas",
        duration: "7 días",
        route: "Oral",
        instructions:
          "Con o sin alimentos. Contraindicada en alergia a penicilina. Alternativa solo por médico.",
      },
      {
        medication: "Paracetamol",
        dose: "500 mg",
        frequency: "Cada 8 horas si dolor/fiebre",
        duration: "3 días",
        route: "Oral",
        instructions: "Máximo 3 g/día.",
      },
    ],
    references: [
      "Guía CENETEC / SS faringoamigdalitis — amoxicilina primera línea en FAA por SBHGA.",
      "Consenso RAM México — Centor ≥3 justifica antibiótico.",
      "HIMFG guía ambulatoria faringoamigdalitis/otitis/sinusitis.",
    ],
    maxAutonomousSeverity: "moderate",
  },
  {
    code: "IVU_LEVE",
    name: "Cistitis aguda no complicada (mujer)",
    description:
      "Síntomas bajos de IVU en mujer no embarazada, sin datos de pielonefritis. Antibiótico de primera línea.",
    diagnosisLabel: "Cistitis aguda no complicada",
    keywords: [
      "ardor al orinar",
      "infección urinaria",
      "infeccion urinaria",
      "cistitis",
      "orina con ardor",
      "síntomas urinarios",
    ],
    exclusionKeywords: [
      "embarazo",
      "dolor lumbar",
      "dolor en la espalda baja con fiebre",
      "fiebre alta",
      "hombre",
      "vómito",
      "catheter",
      "sonda urinaria",
      "sangre abundante",
    ],
    inclusion: [
      "Mujer adulta no embarazada",
      "Disuria / polaquiuria / urgencia miccional",
      "Sin fiebre alta ni dolor en fosa renal",
      "Sin sonda urinaria",
    ],
    exclusion: [
      "Embarazo o sospecha",
      "Pielonefritis (fiebre, dolor lumbar, náusea)",
      "IVU en hombre (siempre médico)",
      "IVU recurrente compleja / urológica conocida",
      "Inmunosupresión",
    ],
    treatmentPlan:
      "Nitrofurantoína 100 mg c/12 h × 5 días (ajustar según GPC local firmada). Sintomático corto con fenazopiridina.",
    instructions:
      "Beba abundantes líquidos. Si aparece fiebre, dolor de espalda/costado, vómito o embarazo → teleconsulta/urgencias. Completar antibiótico.",
    medications: [
      {
        medication: "Nitrofurantoína",
        dose: "100 mg",
        frequency: "Cada 12 horas",
        duration: "5 días",
        route: "Oral",
        instructions: "Con alimentos. No usar si ERC avanzada (validar con médico).",
      },
      {
        medication: "Fenazopiridina",
        dose: "100 mg",
        frequency: "Cada 8 horas",
        duration: "2 días",
        route: "Oral",
        instructions: "Solo alivio de ardor. Orina naranja/roja esperable.",
      },
    ],
    references: [
      "GPC IMSS / MAPPA IVU — nitrofurantoína en cistitis no complicada.",
      "Alternativas fosfomicina 3 g DU o TMP-SMX según resistencia local (decisión médica).",
    ],
    maxAutonomousSeverity: "moderate",
  },
  {
    code: "SINUSITIS_LEVE",
    name: "Sinusitis aguda bacteriana probable",
    description: "Síntomas sinusales persistentes o bifásicos que sugieren bacterialidad. Antibiótico con amox/clav.",
    diagnosisLabel: "Sinusitis aguda — esquema ambulatorio",
    keywords: [
      "sinusitis",
      "dolor facial",
      "presión en senos",
      "dolor en frente y mejillas",
      "mocos verdes varios días",
    ],
    exclusionKeywords: [
      "hinchazón del ojo",
      "visión doble",
      "confusión",
      "rigidez de cuello",
      "alergia a penicilina",
      "embarazo",
    ],
    inclusion: [
      "Adulto ≥18 años",
      "Síntomas ≥10 días o empeoramiento después de mejoría inicial",
      "Sin complicaciones orbitarias/neurológicas",
    ],
    exclusion: [
      "Celulitis orbitaria / oftalmoplejía / diplopía",
      "Signos meníngeos",
      "Alergia a betalactámicos",
      "Inmunosupresión grave",
    ],
    treatmentPlan: "Amoxicilina/clavulanato 875/125 mg c/12 h × 7 días + analgesia.",
    instructions:
      "Si hay hinchazón alrededor del ojo, visión doble, confusión o cuello rígido → urgencias. Completar antibiótico.",
    medications: [
      {
        medication: "Amoxicilina / ácido clavulánico",
        dose: "875 mg / 125 mg",
        frequency: "Cada 12 horas",
        duration: "7 días",
        route: "Oral",
        instructions: "Con alimentos. Diarrea intensa → contactar médico.",
      },
      {
        medication: "Paracetamol",
        dose: "500 mg",
        frequency: "Cada 8 horas si dolor",
        duration: "3 días",
        route: "Oral",
        instructions: "Máximo 3 g/día.",
      },
    ],
    references: [
      "HIMFG / guías ambulatorias sinusitis.",
      "IDSA sinusitis adulta (orientativo; adaptar a México y resistencia local).",
    ],
    maxAutonomousSeverity: "moderate",
  },
  {
    code: "LUMBALGIA_LEVE",
    name: "Lumbalgia mecánica leve",
    description: "Dolor lumbar mecánico sin déficit neurológico ni red flags.",
    diagnosisLabel: "Lumbalgia mecánica leve",
    keywords: [
      "dolor lumbar",
      "espalda baja",
      "dolor de espalda baja",
      "lumbalgia",
      "dolor de espalda media",
      "dolor lumbar espalda baja",
      "dolor de espalda",
      "dolor de espalda alta",
      "dolor de cuello",
    ],
    exclusionKeywords: [
      "incontinencia",
      "pérdida de fuerza",
      "anestesia en silla de montar",
      "trauma fuerte",
      "fiebre con dolor de espalda",
      "cáncer",
      "embarazo",
    ],
    inclusion: ["Adulto ≥18 años", "Dolor lumbar mecánico", "Deambulación posible", "Sin déficit neurológico"],
    exclusion: [
      "Síndrome de cauda equina",
      "Déficit motor progresivo",
      "Traumatismo mayor / osteoporosis con sospecha fractura",
      "Fiebre + dolor lumbar (posible infeccioso)",
      "Antecedente oncológico con dolor nuevo",
    ],
    treatmentPlan: "AINEs cortos + analgesia; actividad relativa; calor local; evitar reposo absoluto prolongado.",
    instructions:
      "Si hay pérdida de fuerza, incontinencia, anestesia perineal o fiebre → urgencias/teleconsulta inmediata.",
    medications: [
      {
        medication: "Naproxeno",
        dose: "250–500 mg",
        frequency: "Cada 12 horas",
        duration: "3 días",
        route: "Oral",
        instructions: "Con alimentos. Evitar si úlcera, IRC, anticoagulación, alergia AINE.",
      },
      {
        medication: "Paracetamol",
        dose: "500 mg",
        frequency: "Cada 8 horas si persiste",
        duration: "3 días",
        route: "Oral",
        instructions: "Puede alternarse respetando horarios y techos de dosis.",
      },
    ],
    references: ["Guías de lumbalgia inespecífica: red flags neurológicas/infecciosas/oncológicas."],
    maxAutonomousSeverity: "moderate",
  },
  {
    code: "MIALGIA_LEVE",
    name: "Mialgias / dolor musculoesquelético leve",
    description: "Dolor muscular o generalizado leve sin sospecha sistémica grave.",
    diagnosisLabel: "Mialgia leve",
    keywords: [
      "dolor generalizado",
      "dolor muscular",
      "mialgias",
      "dolor en brazos",
      "dolor en piernas",
      "dolor articular",
    ],
    exclusionKeywords: ["debilidad progresiva", "orina oscura", "fiebre alta", "rigidez matutina intensa"],
    inclusion: ["Adulto ≥18 años", "Dolor muscular post-esfuerzo o viral leve", "Sin debilidad objetiva reportada"],
    exclusion: ["Rabdomiólisis sospechada", "Artritis inflamatoria aguda", "Déficit neurológico"],
    treatmentPlan: "Analgesia, hidratación, reposo relativo.",
    instructions: "Si aparece debilidad marcada, orina muy oscura o fiebre alta → teleconsulta.",
    medications: [
      {
        medication: "Paracetamol",
        dose: "500 mg",
        frequency: "Cada 8 horas",
        duration: "3 días",
        route: "Oral",
        instructions: "Máximo 3 g/día.",
      },
      {
        medication: "Ibuprofeno",
        dose: "400 mg",
        frequency: "Cada 8 horas si inflamación",
        duration: "3 días",
        route: "Oral",
        instructions: "Con alimentos.",
      },
    ],
    references: ["Manejo sintomático musculoesquelético ambulatorio."],
    maxAutonomousSeverity: "low",
  },
  {
    code: "OTITIS_EXTERNA_LEVE",
    name: "Otitis externa leve",
    description: "Dolor de oído sugestivo de otitis externa sin mastoiditis ni inmunosupresión.",
    diagnosisLabel: "Otitis externa leve",
    keywords: ["dolor de oído", "otitis", "oído", "oido"],
    exclusionKeywords: [
      "parálisis facial",
      "fiebre alta",
      "hinchazón detrás de la oreja",
      "secreción abundante con fiebre",
      "diabetes descompensada",
    ],
    inclusion: ["Adulto ≥18 años", "Dolor ótico ± secreción leve", "Sin signos de otitis media complicada"],
    exclusion: ["Mastoiditis", "Otitis maligna (diabético/inmunosuprimido)", "Parálisis facial", "Trauma perforante"],
    treatmentPlan: "Gotas óticas antibióticas + analgesia. Mantener oído seco.",
    instructions: "Si hay hinchazón retroauricular, fiebre alta o parálisis facial → urgencias.",
    medications: [
      {
        medication: "Ciprofloxacino ótico",
        dose: "3–4 gotas",
        frequency: "Cada 12 horas",
        duration: "7 días",
        route: "Ótica",
        instructions: "Oído hacia arriba 1–2 min tras aplicar.",
      },
      {
        medication: "Paracetamol",
        dose: "500 mg",
        frequency: "Cada 8 horas si dolor",
        duration: "3 días",
        route: "Oral",
        instructions: "Máximo 3 g/día.",
      },
    ],
    references: ["Guías ambulatorias otitis externa; validar presentación comercial disponible en estación."],
    maxAutonomousSeverity: "low",
  },
  {
    code: "CONJUNTIVITIS_LEVE",
    name: "Conjuntivitis infecciosa leve",
    description: "Ojo rojo con secreción sin dolor intenso ni pérdida visual.",
    diagnosisLabel: "Conjuntivitis leve",
    keywords: ["ojo rojo", "conjuntivitis", "secreción ocular", "ojos llorosos"],
    exclusionKeywords: [
      "visión borrosa",
      "dolor intenso ocular",
      "fotofobia intensa",
      "herpes",
      "cuerpo extraño",
    ],
    inclusion: ["Adulto ≥18 años", "Hiperemia conjuntival ± secreción", "Agudeza visual subjetiva conservada"],
    exclusion: [
      "Queratitis / uveítis sospechada",
      "Trauma / cuerpo extraño",
      "Pérdida visual",
      "Uso de lentes de contacto con dolor (riesgo Pseudomonas) → médico",
    ],
    treatmentPlan: "Higiene ocular + antibiótico tópico de amplio uso ambulatorio.",
    instructions:
      "No comparta toallas. Si dolor intenso, visión borrosa o fotofobia → valoración oftalmológica/teleconsulta.",
    medications: [
      {
        medication: "Tobramicina oftálmica",
        dose: "1 gota",
        frequency: "Cada 6 horas",
        duration: "5 días",
        route: "Oftálmica",
        instructions: "No tocar el ojo con el gotero. Lavado de manos.",
      },
    ],
    references: ["Manejo empírico conjuntivitis bacteriana ambulatoria; lentes de contacto = exclusión."],
    maxAutonomousSeverity: "low",
  },
  {
    code: "DERMATITIS_LEVE",
    name: "Prurito / dermatitis leve",
    description: "Erupción o comezón localizada sin anafilaxia ni compromiso sistémico.",
    diagnosisLabel: "Dermatitis / prurito leve",
    keywords: ["erupción en piel", "comezón", "urticaria leve", "ronchas", "dermatitis"],
    exclusionKeywords: [
      "hinchazón de labios",
      "hinchazón de lengua",
      "silbido al respirar",
      "desmayo",
      "fiebre con erupción",
      "ampollas generalizadas",
    ],
    inclusion: ["Adulto ≥18 años", "Prurito o erupción localizada", "Sin compromiso respiratorio"],
    exclusion: [
      "Anafilaxia / angioedema",
      "Síndrome de Stevens-Johnson / necrolisis sospechada",
      "Erupción febril con mal estado general",
      "Celulitis con fiebre",
    ],
    treatmentPlan: "Antihistamínico + corticosteroide tópico suave en zona limitada.",
    instructions:
      "Si hinchazón de labios/lengua, silbido, desmayo o ampollas generalizadas → urgencias (no espere).",
    medications: [
      {
        medication: "Cetirizina",
        dose: "10 mg",
        frequency: "Cada 24 horas",
        duration: "5 días",
        route: "Oral",
        instructions: "Puede causar somnolencia leve.",
      },
      {
        medication: "Hidrocortisona crema 1%",
        dose: "capa fina",
        frequency: "Cada 12 horas",
        duration: "5 días",
        route: "Tópica",
        instructions: "Solo zona afectada. Evitar cara/genitales prolongado sin indicación.",
      },
    ],
    references: ["Dermatología ambulatoria básica; anafilaxia siempre fuera de autónomo."],
    maxAutonomousSeverity: "low",
  },
  {
    code: "ABDOMEN_BAJO_LEVE",
    name: "Dolor abdominal bajo / cólico leve",
    description: "Dolor hipogástrico o periumbilical leve sin abdomen agudo.",
    diagnosisLabel: "Dolor abdominal bajo leve",
    keywords: [
      "dolor en abdomen bajo",
      "hipogastrio",
      "dolor bajo vientre",
      "alrededor del ombligo",
      "dolor en flanco izquierdo del abdomen",
      "dolor en flanco derecho del abdomen",
      "dolor estomacal",
      "dolor alrededor del ombligo",
    ],
    exclusionKeywords: [
      "abdomen en tabla",
      "dolor intenso",
      "embarazo",
      "sangre",
      "fiebre con dolor abdominal",
      "vómito bilioso",
    ],
    inclusion: ["Adulto ≥18 años", "Dolor cólico leve-moderado", "Estable hemodinámicamente (clínica)"],
    exclusion: [
      "Abdomen agudo",
      "Embarazo / dolor pélvico en mujer en edad fértil sin descartar gestación → médico",
      "Fiebre + dolor",
      "Ictericia",
    ],
    treatmentPlan: "Antiespasmódico + analgesia suave; vigilancia estrecha de alarmas.",
    instructions:
      "Dolor intenso, fiebre, vómito persistente, defensa abdominal o posible embarazo → teleconsulta/urgencias.",
    medications: [
      {
        medication: "Butilhioscina",
        dose: "10 mg",
        frequency: "Cada 8 horas si cólico",
        duration: "2 días",
        route: "Oral",
        instructions: "Puede causar sequedad bucal.",
      },
      {
        medication: "Paracetamol",
        dose: "500 mg",
        frequency: "Cada 8 horas si dolor",
        duration: "2 días",
        route: "Oral",
        instructions: "Preferir sobre AINE si irritación gástrica.",
      },
    ],
    references: ["Abdomen agudo siempre exclusión; dolor en mujer fértil requiere criterio médico reforzado."],
    maxAutonomousSeverity: "low",
  },
  {
    code: "FIEBRE_VIRAL_LEVE",
    name: "Síndrome febril leve (probable viral) — sintomático",
    description:
      "Fiebre y/o malestar con o sin dolor leve, sin signos de alarma. Tratamiento sintomático (NO antibiótico empírico solo por fiebre).",
    diagnosisLabel: "Síndrome febril leve — probable viral",
    keywords: [
      "fiebre",
      "febrícula",
      "febricula",
      "temperatura alta",
      "calentura",
      "escalofríos",
      "escalofrios",
      "malestar general con fiebre",
    ],
    exclusionKeywords: [
      "fiebre más de 3 días",
      "fiebre mas de 3 dias",
      "desde 3–7 días",
      "desde 3-7 dias",
      "más de 1 semana",
      "mas de 1 semana",
      "rigidez de nuca",
      "cuello rígido",
      "cuello rigido",
      "petequias",
      "manchas rojas con fiebre",
      "confusión",
      "confusion",
      "convulsion",
      "convulsión",
      "falta de aire",
      "dolor de pecho",
      "embarazo",
      "inmunosupres",
    ],
    inclusion: [
      "Adulto ≥18 años",
      "Fiebre o febrícula de pocas horas a ≤2 días",
      "Estado general conservado, vía oral tolerada",
      "Sin signos meníngeos, petequias, disnea ni dolor torácico",
      "Temperatura en estación < 39.5 °C",
    ],
    exclusion: [
      "Fiebre ≥39.5 °C o >3 días",
      "Sospecha meningitis / sepsis",
      "Inmunosupresión o embarazo",
      "Focalización que requiera otro protocolo (p. ej. faringitis bacteriana, IVU con alarma)",
    ],
    treatmentPlan:
      "Antitérmico/analgésico. Hidratación y reposo. NO antibiótico solo por fiebre. Reevaluar si persiste >48–72 h o aparecen alarmas.",
    instructions:
      "Beba líquidos. Controles de temperatura. Si la fiebre dura más de 3 días, sube mucho, hay rigidez de cuello, manchas en piel, confusión, falta de aire o dolor de pecho → teleconsulta/urgencias de inmediato.",
    medications: [
      {
        medication: "Paracetamol",
        dose: "500 mg",
        frequency: "Cada 8 horas si fiebre o dolor",
        duration: "3 días",
        route: "Oral",
        instructions: "Máximo 3 g/día. Con alimentos si molesta el estómago.",
      },
      {
        medication: "Ibuprofeno",
        dose: "400 mg",
        frequency: "Cada 8 horas si fiebre o dolor (alternar o usar si no basta paracetamol)",
        duration: "3 días",
        route: "Oral",
        instructions:
          "Con alimentos. Evitar si úlcera, sangrado digestivo, enfermedad renal o alergia a AINE. No combinar con otros AINE.",
      },
    ],
    references: [
      "Práctica ambulatoria: fiebre aguda sin foco — sintomáticos y reevaluación.",
      "Evitar antibiótico empírico sin foco bacteriano claro (resistencia antimicrobiana).",
    ],
    maxAutonomousSeverity: "low",
  },
];

export function getProtocolSafety(code: string) {
  const p = STATION_PROTOCOL_DRAFTS.find((x) => x.code === code);
  if (!p) return null;
  return {
    exclusionKeywords: p.exclusionKeywords,
    maxAutonomousSeverity: p.maxAutonomousSeverity,
  };
}
