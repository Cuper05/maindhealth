"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createMedicalDevice } from "@/lib/actions/medical-devices";
import {
  DEVICE_CATEGORY_LABELS,
  DEVICE_STATUS_LABELS,
  DEVICE_STATUSES,
} from "@/lib/db/schema/medical-devices";
import { FormAlert, SubmitButton, CancelLink } from "@/components/ui/PageHeader";
import {
  inputClassName,
  labelClassName,
  textareaClassName,
  selectClassName,
  cardClassName,
} from "@/lib/ui/classes";

export function NewDeviceForm({
  deviceTypes,
}: {
  deviceTypes: { id: number; name: string; category: string }[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createMedicalDevice, null);

  useEffect(() => {
    if (state?.ok && "deviceId" in state) router.push(`/dispositivos/${state.deviceId}`);
  }, [state, router]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-6">
      <FormAlert error={state && !state.ok ? state.error : undefined} />
      <section className={cardClassName}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClassName}>Tipo de equipo *</label>
            <select name="deviceTypeId" required className={selectClassName}>
              <option value="">Seleccionar…</option>
              {deviceTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({DEVICE_CATEGORY_LABELS[t.category] ?? t.category})
                </option>
              ))}
            </select>
          </div>
          <div><label className={labelClassName}>Marca</label><input name="brand" className={inputClassName} /></div>
          <div><label className={labelClassName}>Modelo</label><input name="model" className={inputClassName} /></div>
          <div><label className={labelClassName}>Número de serie</label><input name="serialNumber" className={inputClassName} /></div>
          <div><label className={labelClassName}>Ubicación</label><input name="location" className={inputClassName} /></div>
          <div><label className={labelClassName}>Fecha de alta</label><input type="date" name="registeredAt" defaultValue={today} className={inputClassName} /></div>
          <div><label className={labelClassName}>Última calibración</label><input type="date" name="lastCalibrationAt" className={inputClassName} /></div>
          <div><label className={labelClassName}>Último mantenimiento</label><input type="date" name="lastMaintenanceAt" className={inputClassName} /></div>
          <div>
            <label className={labelClassName}>Estatus *</label>
            <select name="status" defaultValue="activo" className={selectClassName}>
              {DEVICE_STATUSES.map((s) => (
                <option key={s} value={s}>{DEVICE_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName}>Observaciones</label>
            <textarea name="notes" rows={3} className={textareaClassName} />
          </div>
        </div>
      </section>
      <div className="flex gap-3">
        <SubmitButton label="Registrar equipo" pending={pending} />
        <CancelLink href="/dispositivos" />
      </div>
    </form>
  );
}
