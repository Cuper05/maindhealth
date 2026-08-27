"use client";

import type { PainLocationCode } from "@/lib/kiosk/symptom-catalog";

type Hotspot = {
  code: PainLocationCode;
  label: string;
  shortLabel: string;
  danger?: boolean;
  zIndex?: number;
  style: { top: string; left: string; width: string; height: string };
};

/**
 * Coordenadas % del PNG 1024×1536 (ratio 2:3).
 * Calibradas con reglas horizontales sobre el asset:
 *   rodilla/patela ≈ 63–69% · espinilla ≈ 69–84% · tobillo ≈ 84–88% · pie ≈ 88–95%
 * El contenedor usa background-size 100% 100% (sin object-contain) para 1:1.
 */
const FRONT_HOTSPOTS: Hotspot[] = [
  { code: "cabeza", label: "Cabeza", shortLabel: "Cabeza", style: { top: "4%", left: "42%", width: "16%", height: "9%" } },
  { code: "cuello", label: "Cuello (frente)", shortLabel: "Cuello", style: { top: "13%", left: "45%", width: "10%", height: "3.5%" } },
  { code: "pecho", label: "Pecho", shortLabel: "Pecho", danger: true, zIndex: 1, style: { top: "17%", left: "41%", width: "18%", height: "10%" } },
  { code: "hombro_der", label: "Hombro derecho", shortLabel: "Hombro der.", zIndex: 5, style: { top: "16.5%", left: "32%", width: "9%", height: "6%" } },
  { code: "hombro_izq", label: "Hombro izquierdo", shortLabel: "Hombro izq.", zIndex: 5, style: { top: "16.5%", left: "59%", width: "9%", height: "6%" } },
  { code: "brazo_superior_der", label: "Brazo (parte alta) derecho", shortLabel: "Brazo alto der.", style: { top: "22.5%", left: "27%", width: "8%", height: "16%" } },
  { code: "brazo_superior_izq", label: "Brazo (parte alta) izquierdo", shortLabel: "Brazo alto izq.", style: { top: "22.5%", left: "65%", width: "8%", height: "16%" } },
  { code: "abdomen_epigastrio", label: "Boca del estómago", shortLabel: "Estómago alto", style: { top: "27.5%", left: "40%", width: "20%", height: "5%" } },
  { code: "abdomen_umbilical", label: "Alrededor del ombligo", shortLabel: "Ombligo", style: { top: "32.5%", left: "40%", width: "20%", height: "5%" } },
  { code: "abdomen_bajo", label: "Abdomen bajo", shortLabel: "Abdomen bajo", style: { top: "37.5%", left: "40%", width: "20%", height: "7%" } },
  { code: "abdomen_flanco_dcho", label: "Flanco derecho", shortLabel: "Flanco der.", style: { top: "29%", left: "32%", width: "8%", height: "14%" } },
  { code: "abdomen_flanco_izq", label: "Flanco izquierdo", shortLabel: "Flanco izq.", style: { top: "29%", left: "60%", width: "8%", height: "14%" } },
  { code: "codo_der", label: "Codo derecho", shortLabel: "Codo der.", zIndex: 3, style: { top: "38.5%", left: "26%", width: "8%", height: "5%" } },
  { code: "codo_izq", label: "Codo izquierdo", shortLabel: "Codo izq.", zIndex: 3, style: { top: "38.5%", left: "66%", width: "8%", height: "5%" } },
  { code: "antebrazo_der", label: "Antebrazo derecho", shortLabel: "Antebrazo der.", style: { top: "44%", left: "22%", width: "10%", height: "8%" } },
  { code: "antebrazo_izq", label: "Antebrazo izquierdo", shortLabel: "Antebrazo izq.", style: { top: "44%", left: "68%", width: "10%", height: "8%" } },
  { code: "mano_der", label: "Mano derecha", shortLabel: "Mano der.", style: { top: "52%", left: "17%", width: "12%", height: "7%" } },
  { code: "mano_izq", label: "Mano izquierda", shortLabel: "Mano izq.", style: { top: "52%", left: "71%", width: "12%", height: "7%" } },
  // Piernas — reglas: patela 63–69, tobillo 84–88, pie 88–95
  { code: "muslo_der", label: "Muslo derecho", shortLabel: "Muslo der.", style: { top: "46%", left: "37%", width: "11%", height: "17%" } },
  { code: "muslo_izq", label: "Muslo izquierdo", shortLabel: "Muslo izq.", style: { top: "46%", left: "52%", width: "11%", height: "17%" } },
  { code: "rodilla_der", label: "Rodilla derecha", shortLabel: "Rodilla der.", zIndex: 4, style: { top: "63%", left: "37.5%", width: "10.5%", height: "6%" } },
  { code: "rodilla_izq", label: "Rodilla izquierda", shortLabel: "Rodilla izq.", zIndex: 4, style: { top: "63%", left: "52%", width: "10.5%", height: "6%" } },
  { code: "espinilla_der", label: "Espinilla derecha", shortLabel: "Espinilla der.", style: { top: "69.5%", left: "38%", width: "9%", height: "14.5%" } },
  { code: "espinilla_izq", label: "Espinilla izquierda", shortLabel: "Espinilla izq.", style: { top: "69.5%", left: "53%", width: "9%", height: "14.5%" } },
  { code: "tobillo_der", label: "Tobillo derecho", shortLabel: "Tobillo der.", style: { top: "84.5%", left: "39%", width: "7%", height: "3.5%" } },
  { code: "tobillo_izq", label: "Tobillo izquierdo", shortLabel: "Tobillo izq.", style: { top: "84.5%", left: "54%", width: "7%", height: "3.5%" } },
  { code: "pie_der", label: "Pie derecho", shortLabel: "Pie der.", style: { top: "88.5%", left: "37%", width: "10%", height: "6.5%" } },
  { code: "pie_izq", label: "Pie izquierdo", shortLabel: "Pie izq.", style: { top: "88.5%", left: "53%", width: "10%", height: "6.5%" } },
];

const BACK_HOTSPOTS: Hotspot[] = [
  { code: "nuca", label: "Nuca", shortLabel: "Nuca", style: { top: "3.5%", left: "42%", width: "16%", height: "9%" } },
  { code: "cuello_esp", label: "Cuello (espalda)", shortLabel: "Cuello (espalda)", style: { top: "12.5%", left: "45%", width: "10%", height: "3.5%" } },
  { code: "hombro_izq_esp", label: "Hombro izquierdo (espalda)", shortLabel: "Hombro izq. (espalda)", zIndex: 5, style: { top: "16.5%", left: "32%", width: "9%", height: "6%" } },
  { code: "hombro_der_esp", label: "Hombro derecho (espalda)", shortLabel: "Hombro der. (espalda)", zIndex: 5, style: { top: "16.5%", left: "59%", width: "9%", height: "6%" } },
  { code: "omoplato_izq", label: "Omóplato izquierdo", shortLabel: "Omóplato izq.", style: { top: "17%", left: "34%", width: "13%", height: "9%" } },
  { code: "omoplato_der", label: "Omóplato derecho", shortLabel: "Omóplato der.", style: { top: "17%", left: "53%", width: "13%", height: "9%" } },
  { code: "brazo_superior_izq_esp", label: "Brazo alto izquierdo (espalda)", shortLabel: "Brazo alto izq. (espalda)", style: { top: "22.5%", left: "27%", width: "8%", height: "16%" } },
  { code: "brazo_superior_der_esp", label: "Brazo alto derecho (espalda)", shortLabel: "Brazo alto der. (espalda)", style: { top: "22.5%", left: "65%", width: "8%", height: "16%" } },
  { code: "dorsal_izq", label: "Dorsal izquierda", shortLabel: "Dorsal izq.", style: { top: "26%", left: "35%", width: "13%", height: "9%" } },
  { code: "dorsal_der", label: "Dorsal derecha", shortLabel: "Dorsal der.", style: { top: "26%", left: "52%", width: "13%", height: "9%" } },
  { code: "lumbar_izq", label: "Lumbar izquierda", shortLabel: "Lumbar izq.", style: { top: "35.5%", left: "36%", width: "12%", height: "8%" } },
  { code: "lumbar_der", label: "Lumbar derecha", shortLabel: "Lumbar der.", style: { top: "35.5%", left: "52%", width: "12%", height: "8%" } },
  { code: "gluteo_izq", label: "Glúteo izquierdo", shortLabel: "Glúteo izq.", style: { top: "44%", left: "35%", width: "14%", height: "11%" } },
  { code: "gluteo_der", label: "Glúteo derecho", shortLabel: "Glúteo der.", style: { top: "44%", left: "51%", width: "14%", height: "11%" } },
  { code: "codo_izq_esp", label: "Codo izquierdo (espalda)", shortLabel: "Codo izq. (espalda)", zIndex: 3, style: { top: "38.5%", left: "26%", width: "8%", height: "5%" } },
  { code: "codo_der_esp", label: "Codo derecho (espalda)", shortLabel: "Codo der. (espalda)", zIndex: 3, style: { top: "38.5%", left: "66%", width: "8%", height: "5%" } },
  { code: "antebrazo_izq_esp", label: "Antebrazo izquierdo (espalda)", shortLabel: "Antebrazo izq. (espalda)", style: { top: "44%", left: "22%", width: "10%", height: "8%" } },
  { code: "antebrazo_der_esp", label: "Antebrazo derecho (espalda)", shortLabel: "Antebrazo der. (espalda)", style: { top: "44%", left: "68%", width: "10%", height: "8%" } },
  { code: "mano_izq_esp", label: "Mano izquierda (espalda)", shortLabel: "Mano izq. (espalda)", style: { top: "52%", left: "17%", width: "12%", height: "7%" } },
  { code: "mano_der_esp", label: "Mano derecha (espalda)", shortLabel: "Mano der. (espalda)", style: { top: "52%", left: "71%", width: "12%", height: "7%" } },
  // Espalda piernas — rodilla atrás ≈66–71, pantorrilla ≈71–84
  { code: "muslo_izq_esp", label: "Muslo izquierdo (espalda)", shortLabel: "Muslo izq. (espalda)", style: { top: "55%", left: "37%", width: "11%", height: "11%" } },
  { code: "muslo_der_esp", label: "Muslo derecho (espalda)", shortLabel: "Muslo der. (espalda)", style: { top: "55%", left: "52%", width: "11%", height: "11%" } },
  { code: "rodilla_izq_esp", label: "Rodilla izquierda (espalda)", shortLabel: "Rodilla izq. (espalda)", zIndex: 4, style: { top: "66%", left: "37.5%", width: "10.5%", height: "5%" } },
  { code: "rodilla_der_esp", label: "Rodilla derecha (espalda)", shortLabel: "Rodilla der. (espalda)", zIndex: 4, style: { top: "66%", left: "52%", width: "10.5%", height: "5%" } },
  { code: "pantorrilla_izq_esp", label: "Pantorrilla izquierda", shortLabel: "Pantorrilla izq.", style: { top: "71.5%", left: "38%", width: "9%", height: "12.5%" } },
  { code: "pantorrilla_der_esp", label: "Pantorrilla derecha", shortLabel: "Pantorrilla der.", style: { top: "71.5%", left: "53%", width: "9%", height: "12.5%" } },
  { code: "tobillo_izq_esp", label: "Tobillo izquierdo (espalda)", shortLabel: "Tobillo izq. (espalda)", style: { top: "84.5%", left: "39%", width: "7%", height: "3.5%" } },
  { code: "tobillo_der_esp", label: "Tobillo derecho (espalda)", shortLabel: "Tobillo der. (espalda)", style: { top: "84.5%", left: "54%", width: "7%", height: "3.5%" } },
  { code: "pie_izq_esp", label: "Pie / talón izquierdo", shortLabel: "Pie izq. (espalda)", style: { top: "88.5%", left: "37%", width: "10%", height: "6.5%" } },
  { code: "pie_der_esp", label: "Pie / talón derecho", shortLabel: "Pie der. (espalda)", style: { top: "88.5%", left: "53%", width: "10%", height: "6.5%" } },
];

const EXTRA_ZONES: Array<{ code: PainLocationCode; label: string }> = [
  { code: "articulaciones", label: "Articulaciones" },
  { code: "generalizado", label: "Todo el cuerpo" },
];

function hotspotClass(active: boolean, danger?: boolean) {
  if (active) {
    return danger
      ? "border-amber-500 bg-amber-400/55 shadow-[inset_0_0_0_999px_rgba(245,158,11,0.18)]"
      : "border-[#1d6eb8] bg-[#1d6eb8]/45 shadow-[inset_0_0_0_999px_rgba(29,110,184,0.16)]";
  }
  return "border-transparent bg-transparent hover:border-[#1d6eb8]/40 hover:bg-[#1d6eb8]/18";
}

function BodyFigure({
  title,
  src,
  alt,
  hotspots,
  selected,
  onToggle,
}: {
  title: string;
  src: string;
  alt: string;
  hotspots: Hotspot[];
  selected: PainLocationCode[];
  onToggle: (code: PainLocationCode) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-3">
      <p className="mb-1 text-center text-base font-bold uppercase tracking-wide text-slate-600">
        {title}
      </p>
      {/*
        background-size 100% 100% + aspect 2/3 = misma geometría que el PNG.
        Evita object-contain, que desalinea los % si hay letterboxing.
      */}
      <div
        role="img"
        aria-label={alt}
        className="relative mx-auto aspect-[2/3] w-full max-w-[360px] bg-white bg-center bg-no-repeat xl:max-w-[420px]"
        style={{ backgroundImage: `url(${src})`, backgroundSize: "100% 100%" }}
      >
        {hotspots.map((spot, i) => {
          const active = selected.includes(spot.code);
          return (
            <button
              key={`${spot.code}-${i}`}
              type="button"
              aria-pressed={active}
              aria-label={spot.label}
              title={spot.label}
              onClick={() => onToggle(spot.code)}
              className={`absolute rounded-xl border-2 transition active:scale-[0.99] ${hotspotClass(active, spot.danger)}`}
              style={{ ...spot.style, zIndex: spot.zIndex ?? 2 }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function BodyPainMap({
  selected,
  onToggle,
}: {
  selected: PainLocationCode[];
  onToggle: (code: PainLocationCode) => void;
}) {
  const allHotspots = [...FRONT_HOTSPOTS, ...BACK_HOTSPOTS];
  const selectedLabels = Array.from(
    new Set(allHotspots.filter((h) => selected.includes(h.code)).map((h) => h.shortLabel)),
  );
  const selectedExtras = EXTRA_ZONES.filter((z) => selected.includes(z.code)).map((z) => z.label);
  const chips = [...selectedLabels, ...selectedExtras];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
        <BodyFigure
          title="Frente"
          src="/kiosk/body-map-front.png"
          alt="Diagrama anatómico de frente"
          hotspots={FRONT_HOTSPOTS}
          selected={selected}
          onToggle={onToggle}
        />
        <BodyFigure
          title="Espalda"
          src="/kiosk/body-map-back.png"
          alt="Diagrama anatómico de espalda"
          hotspots={BACK_HOTSPOTS}
          selected={selected}
          onToggle={onToggle}
        />
      </div>

      <p className="text-center text-sm text-slate-500">
        Espinilla = frente de la pierna · Pantorrilla = atrás
      </p>

      {chips.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-2">
          {chips.map((label) => (
            <li
              key={label}
              className="rounded-lg bg-[#e8f2fc] px-3 py-1.5 text-sm font-semibold text-[#155a96]"
            >
              {label}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {EXTRA_ZONES.map((z) => {
          const active = selected.includes(z.code);
          return (
            <button
              key={z.code}
              type="button"
              onClick={() => onToggle(z.code)}
              className={`min-h-[52px] min-w-[10rem] flex-1 rounded-xl border-2 px-4 py-3 text-lg font-semibold transition sm:flex-none xl:text-xl ${
                active
                  ? "border-[#1d6eb8] bg-[#1d6eb8] text-white"
                  : "border-slate-200 bg-white text-slate-800 hover:border-[#1d6eb8]/50 hover:bg-slate-50"
              }`}
            >
              {z.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
