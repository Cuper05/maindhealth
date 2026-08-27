export function WelcomeIllustration() {
  return (
    <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-br from-[#1d6eb8]/10 to-[#1d6eb8]/5">
      <svg viewBox="0 0 120 120" className="h-24 w-24" fill="none" aria-hidden>
        <circle cx="60" cy="42" r="22" stroke="#1d6eb8" strokeWidth="3" />
        <path d="M30 98c4-22 22-34 30-34s26 12 30 34" stroke="#1d6eb8" strokeWidth="3" strokeLinecap="round" />
        <path d="M60 20v-6M60 64v6M38 42h-6M82 42h6" stroke="#94b8d9" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function BloodPressureIllustration() {
  return (
    <figure className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col items-center justify-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/kiosk/bp-cuff-placement.png"
        alt="Cómo colocar el brazalete: dos dedos arriba del codo, manguera hacia abajo, brazo a la altura del corazón"
        className="min-h-0 w-full flex-1 rounded-xl object-contain object-center shadow-sm ring-1 ring-slate-200"
      />
      <figcaption className="w-full shrink-0 px-1 pb-1 text-center text-base font-semibold leading-snug text-slate-700 xl:text-lg">
        Coloque el brazalete así en el brazo izquierdo
      </figcaption>
    </figure>
  );
}

export function OximeterIllustration() {
  return (
    <figure className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col items-center justify-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/kiosk/oximeter-placement.png"
        alt="Cómo usar el oxímetro: dedo hasta el fondo, uña hacia arriba, mano quieta"
        className="min-h-0 w-full flex-1 rounded-xl object-contain object-center shadow-sm ring-1 ring-slate-200"
      />
      <figcaption className="w-full shrink-0 space-y-1 px-1 pb-1 text-center">
        <p className="text-base font-semibold leading-snug text-slate-700 xl:text-lg">
          Coloque el oxímetro así en el dedo
        </p>
        <p className="text-sm font-medium leading-snug text-amber-900 xl:text-base">
          Uñas largas o artificiales: ponga el dedo de lado
        </p>
      </figcaption>
    </figure>
  );
}

export function ScaleIllustration() {
  return (
    <svg viewBox="0 0 280 200" className="mx-auto h-48 w-full max-w-sm" fill="none" aria-hidden>
      {/* Columna de estadiómetro digital */}
      <rect x="48" y="28" width="18" height="140" rx="4" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
      <rect x="52" y="36" width="10" height="110" rx="2" fill="#e2e8f0" />
      <rect x="44" y="48" width="26" height="10" rx="2" fill="#1d6eb8" />
      <path d="M66 53h22" stroke="#1d6eb8" strokeWidth="3" strokeLinecap="round" />
      {/* Plataforma digital */}
      <rect x="88" y="148" width="150" height="22" rx="6" fill="#94a3b8" />
      <rect x="98" y="118" width="130" height="36" rx="10" fill="#e8f2fb" stroke="#1d6eb8" strokeWidth="2.5" />
      <rect x="112" y="126" width="70" height="20" rx="4" fill="#0f172a" />
      <text x="147" y="140" textAnchor="middle" fill="#38bdf8" fontSize="12" fontWeight="bold" fontFamily="ui-monospace, monospace">
        81.4 kg
      </text>
      <text x="198" y="140" textAnchor="middle" fill="#1d6eb8" fontSize="11" fontWeight="bold">
        1.72 m
      </text>
      {/* Silueta persona */}
      <circle cx="200" cy="72" r="14" fill="#f8d4d4" stroke="#e8a0a0" strokeWidth="2" />
      <path d="M200 86v34" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
      <path d="M188 100h24" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
      <path d="M200 120l-10 22M200 120l10 22" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Ícono compacto: báscula digital + columna de altura (estación). */
export function DigitalScaleHeightIcon({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      {/* Columna altura */}
      <rect x="8" y="6" width="8" height="44" rx="2" fill="#94a3b8" />
      <rect x="10" y="10" width="4" height="34" rx="1" fill="#e2e8f0" />
      <rect x="6" y="16" width="12" height="5" rx="1.5" fill="#1d6eb8" />
      <path d="M18 18.5h8" stroke="#1d6eb8" strokeWidth="2.5" strokeLinecap="round" />
      {/* Plataforma */}
      <rect x="20" y="48" width="36" height="8" rx="2" fill="#64748b" />
      <rect x="24" y="34" width="28" height="16" rx="4" fill="#e8f2fb" stroke="#1d6eb8" strokeWidth="2" />
      {/* Pantalla LED */}
      <rect x="28" y="38" width="20" height="8" rx="1.5" fill="#0f172a" />
      <path d="M31 42h6M40 42h5" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" />
      {/* Indicador digital arriba */}
      <circle cx="44" cy="20" r="3" fill="#1d6eb8" opacity="0.35" />
      <path d="M44 14v4M44 22v4" stroke="#1d6eb8" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function ThermometerIllustration() {
  return (
    <figure className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col items-center justify-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/kiosk/thermometer-axilla-placement.png"
        alt="Cómo medir la temperatura: termómetro en la axila, brazo pegado al cuerpo, punta contra la piel"
        className="min-h-0 w-full flex-1 rounded-xl object-contain object-center shadow-sm ring-1 ring-slate-200"
      />
      <figcaption className="w-full shrink-0 px-1 pb-1 text-center text-base font-semibold leading-snug text-slate-700 xl:text-lg">
        Coloque el termómetro en la axila
      </figcaption>
    </figure>
  );
}

export function EcgIllustration() {
  return (
    <figure className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col items-center justify-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/kiosk/ecg-finger-plates-placement.png"
        alt="Cómo usar el electrocardiograma de un solo canal: dedos de ambas manos en las placas metálicas"
        className="min-h-0 w-full flex-1 rounded-xl object-contain object-center shadow-sm ring-1 ring-slate-200"
      />
      <figcaption className="w-full shrink-0 space-y-1 px-1 pb-1 text-center">
        <p className="text-base font-semibold leading-snug text-slate-700 xl:text-lg">
          ECG de un canal: dedos en las placas metálicas
        </p>
        <p className="text-sm font-medium leading-snug text-slate-600 xl:text-base">
          Ambas manos quietas hasta que termine la onda
        </p>
      </figcaption>
    </figure>
  );
}

export function WaitingIllustration() {
  return (
    <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-[#1d6eb8]/10 xl:h-48 xl:w-48">
      <svg viewBox="0 0 80 80" className="h-20 w-20 xl:h-24 xl:w-24" fill="none" aria-hidden>
        <circle cx="40" cy="40" r="32" stroke="#1d6eb8" strokeWidth="3" strokeDasharray="8 6" />
        <path d="M40 20v22l14 8" stroke="#1d6eb8" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export type VitalIllustrationType =
  | "blood_pressure"
  | "oxygen"
  | "weight_height"
  | "temperature"
  | "ecg";

export function VitalIllustration({ type }: { type: VitalIllustrationType }) {
  switch (type) {
    case "blood_pressure":
      return <BloodPressureIllustration />;
    case "oxygen":
      return <OximeterIllustration />;
    case "weight_height":
      return <ScaleIllustration />;
    case "temperature":
      return <ThermometerIllustration />;
    case "ecg":
      return <EcgIllustration />;
  }
}
