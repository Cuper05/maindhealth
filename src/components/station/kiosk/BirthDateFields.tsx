"use client";

import { kioskHelperClassName, kioskLabelClassName } from "./KioskTheme";

const MONTHS = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

function daysInMonth(year: number, month: number) {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

/** Fecha de nacimiento en tres selectores táctiles (día / mes / año). */
export function BirthDateFields({
  labelClassName,
  selectClassName,
  defaultValue,
  day,
  month,
  year,
  onChange,
}: {
  labelClassName: string;
  selectClassName: string;
  defaultValue?: string;
  day?: string;
  month?: string;
  year?: string;
  onChange?: (next: { day: string; month: string; year: string }) => void;
}) {
  const controlled = Boolean(onChange);
  const parsed = defaultValue && /^\d{4}-\d{2}-\d{2}$/.test(defaultValue) ? defaultValue : "";
  const [y0, m0, d0] = parsed ? parsed.split("-") : ["", "", ""];
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => String(thisYear - i));

  const dayValue = controlled ? (day ?? "") : d0;
  const monthValue = controlled ? (month ?? "") : m0;
  const yearValue = controlled ? (year ?? "") : y0;

  function emit(next: { day: string; month: string; year: string }, form: HTMLFormElement | null) {
    if (onChange) {
      onChange(next);
      return;
    }
    syncHidden(form, next);
  }

  return (
    <div className="sm:col-span-2">
      <p className={labelClassName}>Fecha de nacimiento</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={kioskLabelClassName}>Día</label>
          <select
            name="birthDay"
            {...(controlled
              ? {
                  value: dayValue,
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                    emit(
                      { day: e.target.value, month: monthValue, year: yearValue },
                      e.currentTarget.form,
                    ),
                }
              : {
                  defaultValue: d0,
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                    syncHidden(e.currentTarget.form),
                })}
            className={selectClassName}
          >
            <option value="">Día</option>
            {Array.from({ length: 31 }, (_, i) => {
              const v = String(i + 1).padStart(2, "0");
              return (
                <option key={v} value={v}>
                  {i + 1}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className={kioskLabelClassName}>Mes</label>
          <select
            name="birthMonth"
            {...(controlled
              ? {
                  value: monthValue,
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                    emit(
                      { day: dayValue, month: e.target.value, year: yearValue },
                      e.currentTarget.form,
                    ),
                }
              : {
                  defaultValue: m0,
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                    syncHidden(e.currentTarget.form),
                })}
            className={selectClassName}
          >
            <option value="">Mes</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={kioskLabelClassName}>Año</label>
          <select
            name="birthYear"
            {...(controlled
              ? {
                  value: yearValue,
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                    emit(
                      { day: dayValue, month: monthValue, year: e.target.value },
                      e.currentTarget.form,
                    ),
                }
              : {
                  defaultValue: y0,
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
                    syncHidden(e.currentTarget.form),
                })}
            className={selectClassName}
          >
            <option value="">Año</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!controlled ? <input type="hidden" name="birthDate" defaultValue={parsed} /> : null}
      <p className={`mt-2 ${kioskHelperClassName}`}>
        Elija día, mes y año por separado — es más rápido en pantalla táctil.
      </p>
    </div>
  );
}

function syncHidden(
  form: HTMLFormElement | null,
  next?: { day: string; month: string; year: string },
) {
  if (!form) return;
  const day = next?.day ?? String(new FormData(form).get("birthDay") ?? "");
  const month = next?.month ?? String(new FormData(form).get("birthMonth") ?? "");
  const year = next?.year ?? String(new FormData(form).get("birthYear") ?? "");
  const hidden = form.elements.namedItem("birthDate") as HTMLInputElement | null;
  if (!hidden) return;
  if (year && month && day) {
    const max = daysInMonth(Number(year), Number(month));
    const d = Math.min(Number(day), max);
    hidden.value = `${year}-${month}-${String(d).padStart(2, "0")}`;
  } else {
    hidden.value = "";
  }
}

export function birthDateFromForm(fd: FormData): string | undefined {
  const direct = String(fd.get("birthDate") ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  const day = String(fd.get("birthDay") ?? "").padStart(2, "0");
  const month = String(fd.get("birthMonth") ?? "");
  const year = String(fd.get("birthYear") ?? "");
  if (year && month && day && day !== "00") return `${year}-${month}-${day}`;
  return undefined;
}
