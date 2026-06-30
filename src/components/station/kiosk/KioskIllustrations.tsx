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
    <svg viewBox="0 0 280 200" className="mx-auto h-48 w-full max-w-sm" fill="none" aria-hidden>
      <rect x="40" y="60" width="200" height="100" rx="16" fill="#e8f2fb" stroke="#c5daf0" strokeWidth="2" />
      <rect x="60" y="80" width="80" height="60" rx="8" fill="#1d6eb8" opacity="0.15" />
      <path d="M100 50c-30 0-50 20-50 45" stroke="#1d6eb8" strokeWidth="8" strokeLinecap="round" />
      <ellipse cx="100" cy="110" rx="35" ry="22" fill="#f8d4d4" stroke="#e8a0a0" strokeWidth="2" />
      <rect x="155" y="95" width="60" height="35" rx="6" fill="white" stroke="#1d6eb8" strokeWidth="2" />
      <text x="185" y="118" textAnchor="middle" fill="#1d6eb8" fontSize="14" fontWeight="bold">
        118/76
      </text>
    </svg>
  );
}

export function OximeterIllustration() {
  return (
    <svg viewBox="0 0 280 200" className="mx-auto h-48 w-full max-w-sm" fill="none" aria-hidden>
      <rect x="90" y="70" width="100" height="70" rx="12" fill="#e8f2fb" stroke="#c5daf0" strokeWidth="2" />
      <ellipse cx="140" cy="105" rx="28" ry="20" fill="#f8d4d4" stroke="#e8a0a0" strokeWidth="2" />
      <rect x="115" y="85" width="50" height="40" rx="20" fill="#1d6eb8" opacity="0.2" stroke="#1d6eb8" strokeWidth="2" />
      <circle cx="200" cy="105" r="28" fill="white" stroke="#22c55e" strokeWidth="3" />
      <text x="200" y="110" textAnchor="middle" fill="#22c55e" fontSize="16" fontWeight="bold">
        98%
      </text>
    </svg>
  );
}

export function ScaleIllustration() {
  return (
    <svg viewBox="0 0 280 200" className="mx-auto h-48 w-full max-w-sm" fill="none" aria-hidden>
      <rect x="70" y="130" width="140" height="20" rx="4" fill="#94a3b8" />
      <rect x="85" y="100" width="110" height="30" rx="6" fill="#e8f2fb" stroke="#1d6eb8" strokeWidth="2" />
      <circle cx="140" cy="75" r="18" fill="#f8d4d4" stroke="#e8a0a0" strokeWidth="2" />
      <path d="M140 93v25" stroke="#64748b" strokeWidth="3" />
      <path d="M125 115h30" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
      <text x="140" y="118" textAnchor="middle" fill="#1d6eb8" fontSize="12" fontWeight="bold">
        81.4 kg
      </text>
    </svg>
  );
}

export function ThermometerIllustration() {
  return (
    <svg viewBox="0 0 280 200" className="mx-auto h-48 w-full max-w-sm" fill="none" aria-hidden>
      <rect x="120" y="50" width="40" height="100" rx="20" fill="#e8f2fb" stroke="#1d6eb8" strokeWidth="2" />
      <circle cx="140" cy="155" r="22" fill="#ef4444" opacity="0.8" />
      <rect x="133" y="70" width="14" height="70" rx="7" fill="#ef4444" opacity="0.6" />
      <path d="M180 80h40M180 100h30M180 120h35" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
      <text x="210" y="105" fill="#1d6eb8" fontSize="14" fontWeight="bold">
        36.7°C
      </text>
    </svg>
  );
}

export function WaitingIllustration() {
  return (
    <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-[#1d6eb8]/10">
      <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none" aria-hidden>
        <circle cx="40" cy="40" r="32" stroke="#1d6eb8" strokeWidth="3" strokeDasharray="8 6" />
        <path d="M40 20v22l14 8" stroke="#1d6eb8" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export type VitalIllustrationType = "blood_pressure" | "oxygen" | "weight_height" | "temperature";

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
  }
}
