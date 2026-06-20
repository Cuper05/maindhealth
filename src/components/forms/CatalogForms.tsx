"use client";

import { useActionState } from "react";
import {
  createDiagnosis,
  createMedication,
  createSymptom,
  toggleDiagnosisActive,
  toggleMedicationActive,
  toggleSymptomActive,
} from "@/lib/actions/catalogs";
import { FormAlert, SubmitButton } from "@/components/ui/PageHeader";
import {
  cardClassName,
  inputClassName,
  labelClassName,
  textareaClassName,
} from "@/lib/ui/classes";

function AddSymptomForm() {
  const [state, formAction, pending] = useActionState(createSymptom, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert
        error={state && !state.ok ? state.error : undefined}
        success={state?.ok ? "Síntoma registrado." : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClassName}>Nombre *</label>
          <input name="name" required className={inputClassName} />
        </div>
        <div>
          <label className={labelClassName}>Categoría</label>
          <input name="category" placeholder="Ej. Respiratorio" className={inputClassName} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClassName}>Descripción</label>
          <textarea name="description" rows={2} className={textareaClassName} />
        </div>
      </div>
      <SubmitButton label="Agregar síntoma" pending={pending} />
    </form>
  );
}

function AddDiagnosisForm() {
  const [state, formAction, pending] = useActionState(createDiagnosis, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert
        error={state && !state.ok ? state.error : undefined}
        success={state?.ok ? "Diagnóstico registrado." : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClassName}>Código CIE-10</label>
          <input name="code" placeholder="Ej. J06.9" className={inputClassName} />
        </div>
        <div>
          <label className={labelClassName}>Nombre *</label>
          <input name="name" required className={inputClassName} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClassName}>Descripción</label>
          <textarea name="description" rows={2} className={textareaClassName} />
        </div>
      </div>
      <SubmitButton label="Agregar diagnóstico" pending={pending} />
    </form>
  );
}

function AddMedicationForm() {
  const [state, formAction, pending] = useActionState(createMedication, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert
        error={state && !state.ok ? state.error : undefined}
        success={state?.ok ? "Medicamento registrado." : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClassName}>Nombre comercial *</label>
          <input name="name" required className={inputClassName} />
        </div>
        <div>
          <label className={labelClassName}>Genérico</label>
          <input name="genericName" className={inputClassName} />
        </div>
        <div>
          <label className={labelClassName}>Forma</label>
          <input name="form" placeholder="Tableta, cápsula…" className={inputClassName} />
        </div>
        <div>
          <label className={labelClassName}>Concentración</label>
          <input name="strength" placeholder="500 mg" className={inputClassName} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClassName}>Descripción</label>
          <textarea name="description" rows={2} className={textareaClassName} />
        </div>
      </div>
      <SubmitButton label="Agregar medicamento" pending={pending} />
    </form>
  );
}

function ToggleButton({
  id,
  active,
  toggleAction,
}: {
  id: number;
  active: boolean;
  toggleAction: (id: number, active: boolean) => Promise<void>;
}) {
  return (
    <form action={toggleAction.bind(null, id, !active)}>
      <button
        type="submit"
        className={`rounded px-2 py-1 text-xs font-medium ${
          active
            ? "text-amber-800 hover:bg-amber-50"
            : "text-teal-700 hover:bg-teal-50"
        }`}
      >
        {active ? "Desactivar" : "Activar"}
      </button>
    </form>
  );
}

export function CatalogSymptomsPanel({
  rows,
}: {
  rows: {
    id: number;
    name: string;
    category: string | null;
    description: string | null;
    active: boolean;
  }[];
}) {
  return (
    <div className="space-y-6">
      <section className={cardClassName}>
        <h2 className="mb-4 text-lg font-medium text-slate-800">Nuevo síntoma</h2>
        <AddSymptomForm />
      </section>
      <CatalogTable
        emptyMessage="Sin síntomas registrados."
        headers={["Nombre", "Categoría", "Descripción", "Estatus", ""]}
        rows={rows.map((row) => (
          <tr key={row.id} className="border-t border-slate-100">
            <td className="px-4 py-3 font-medium">{row.name}</td>
            <td className="px-4 py-3">{row.category ?? "—"}</td>
            <td className="px-4 py-3 max-w-xs truncate text-slate-600">
              {row.description ?? "—"}
            </td>
            <td className="px-4 py-3">
              <StatusPill active={row.active} />
            </td>
            <td className="px-4 py-3">
              <ToggleButton
                id={row.id}
                active={row.active}
                toggleAction={toggleSymptomActive}
              />
            </td>
          </tr>
        ))}
      />
    </div>
  );
}

export function CatalogDiagnosesPanel({
  rows,
}: {
  rows: {
    id: number;
    code: string | null;
    name: string;
    description: string | null;
    active: boolean;
  }[];
}) {
  return (
    <div className="space-y-6">
      <section className={cardClassName}>
        <h2 className="mb-4 text-lg font-medium text-slate-800">Nuevo diagnóstico</h2>
        <AddDiagnosisForm />
      </section>
      <CatalogTable
        emptyMessage="Sin diagnósticos registrados."
        headers={["Código", "Nombre", "Descripción", "Estatus", ""]}
        rows={rows.map((row) => (
          <tr key={row.id} className="border-t border-slate-100">
            <td className="px-4 py-3 font-mono text-xs">{row.code ?? "—"}</td>
            <td className="px-4 py-3 font-medium">{row.name}</td>
            <td className="px-4 py-3 max-w-xs truncate text-slate-600">
              {row.description ?? "—"}
            </td>
            <td className="px-4 py-3">
              <StatusPill active={row.active} />
            </td>
            <td className="px-4 py-3">
              <ToggleButton
                id={row.id}
                active={row.active}
                toggleAction={toggleDiagnosisActive}
              />
            </td>
          </tr>
        ))}
      />
    </div>
  );
}

export function CatalogMedicationsPanel({
  rows,
}: {
  rows: {
    id: number;
    name: string;
    genericName: string | null;
    form: string | null;
    strength: string | null;
    description: string | null;
    active: boolean;
  }[];
}) {
  return (
    <div className="space-y-6">
      <section className={cardClassName}>
        <h2 className="mb-4 text-lg font-medium text-slate-800">Nuevo medicamento</h2>
        <AddMedicationForm />
      </section>
      <CatalogTable
        emptyMessage="Sin medicamentos registrados."
        headers={["Nombre", "Genérico", "Forma", "Concentración", "Estatus", ""]}
        rows={rows.map((row) => (
          <tr key={row.id} className="border-t border-slate-100">
            <td className="px-4 py-3 font-medium">{row.name}</td>
            <td className="px-4 py-3">{row.genericName ?? "—"}</td>
            <td className="px-4 py-3">{row.form ?? "—"}</td>
            <td className="px-4 py-3">{row.strength ?? "—"}</td>
            <td className="px-4 py-3">
              <StatusPill active={row.active} />
            </td>
            <td className="px-4 py-3">
              <ToggleButton
                id={row.id}
                active={row.active}
                toggleAction={toggleMedicationActive}
              />
            </td>
          </tr>
        ))}
      />
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-600"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function CatalogTable({
  headers,
  rows,
  emptyMessage,
}: {
  headers: string[];
  rows: React.ReactNode[];
  emptyMessage: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-8 text-center text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows
          )}
        </tbody>
      </table>
    </div>
  );
}
