"use client";

import { useActionState } from "react";
import {
  updateDeviceMaintenance,
  updateMedicalDevice,
} from "@/lib/actions/medical-devices";
import {
  DEVICE_CATEGORY_LABELS,
  DEVICE_STATUS_LABELS,
  DEVICE_STATUSES,
  type DeviceStatus,
} from "@/lib/db/schema/medical-devices";
import { FormAlert, SubmitButton } from "@/components/ui/PageHeader";
import {
  inputClassName,
  labelClassName,
  textareaClassName,
  selectClassName,
  cardClassName,
} from "@/lib/ui/classes";

type DeviceTypeOption = { id: number; name: string; category: string };

type DeviceData = {
  id: number;
  deviceTypeId: number;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  registeredAt: string;
  lastCalibrationAt: string | null;
  lastMaintenanceAt: string | null;
  status: string;
  location: string | null;
  notes: string | null;
  typeName: string;
  typeCategory: string;
};

export function DeviceEditor({
  device,
  deviceTypes,
}: {
  device: DeviceData;
  deviceTypes: DeviceTypeOption[];
}) {
  const boundUpdate = updateMedicalDevice.bind(null, device.id);
  const boundMaintenance = updateDeviceMaintenance.bind(null, device.id);
  const [editState, editAction, editPending] = useActionState(boundUpdate, null);
  const [maintState, maintAction, maintPending] = useActionState(boundMaintenance, null);

  return (
    <div className="space-y-6">
      <section className={cardClassName}>
        <h2 className="mb-4 font-medium text-slate-900">Datos del equipo</h2>
        <FormAlert
          error={editState && !editState.ok ? editState.error : undefined}
          success={editState?.ok ? "Equipo actualizado" : undefined}
        />
        <form action={editAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClassName}>Tipo de equipo *</label>
              <select name="deviceTypeId" required defaultValue={device.deviceTypeId} className={selectClassName}>
                {deviceTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({DEVICE_CATEGORY_LABELS[t.category] ?? t.category})
                  </option>
                ))}
              </select>
            </div>
            <Field label="Marca" name="brand" defaultValue={device.brand} />
            <Field label="Modelo" name="model" defaultValue={device.model} />
            <Field label="Número de serie" name="serialNumber" defaultValue={device.serialNumber} />
            <Field label="Ubicación" name="location" defaultValue={device.location} />
            <Field label="Fecha de alta" name="registeredAt" type="date" defaultValue={device.registeredAt} />
            <Field label="Última calibración" name="lastCalibrationAt" type="date" defaultValue={device.lastCalibrationAt} />
            <Field label="Último mantenimiento" name="lastMaintenanceAt" type="date" defaultValue={device.lastMaintenanceAt} />
            <StatusSelect defaultValue={device.status} />
            <div className="sm:col-span-2">
              <label className={labelClassName}>Observaciones</label>
              <textarea name="notes" rows={3} defaultValue={device.notes ?? ""} className={textareaClassName} />
            </div>
          </div>
          <SubmitButton label="Guardar cambios" pending={editPending} />
        </form>
      </section>

      <section className={cardClassName}>
        <h2 className="mb-4 font-medium text-slate-900">Mantenimiento rápido</h2>
        <FormAlert
          error={maintState && !maintState.ok ? maintState.error : undefined}
          success={maintState?.ok ? "Mantenimiento registrado" : undefined}
        />
        <form action={maintAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Última calibración" name="lastCalibrationAt" type="date" defaultValue={device.lastCalibrationAt} />
            <Field label="Último mantenimiento" name="lastMaintenanceAt" type="date" defaultValue={device.lastMaintenanceAt} />
            <StatusSelect defaultValue={device.status} />
          </div>
          <div>
            <label className={labelClassName}>Notas</label>
            <textarea name="notes" rows={2} defaultValue={device.notes ?? ""} className={textareaClassName} />
          </div>
          <SubmitButton label="Registrar mantenimiento" pending={maintPending} />
        </form>
      </section>
    </div>
  );
}

function Field({ label, name, type = "text", defaultValue }: {
  label: string; name: string; type?: string; defaultValue?: string | null;
}) {
  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <input type={type} name={name} defaultValue={defaultValue ?? ""} className={inputClassName} />
    </div>
  );
}

function StatusSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <div>
      <label className={labelClassName}>Estatus *</label>
      <select name="status" defaultValue={defaultValue} className={selectClassName}>
        {DEVICE_STATUSES.map((s) => (
          <option key={s} value={s}>{DEVICE_STATUS_LABELS[s]}</option>
        ))}
      </select>
    </div>
  );
}

export function StatusBadge({ status }: { status: DeviceStatus }) {
  const colors: Record<DeviceStatus, string> = {
    activo: "bg-teal-100 text-teal-800",
    en_mantenimiento: "bg-amber-100 text-amber-800",
    calibracion_pendiente: "bg-orange-100 text-orange-800",
    baja: "bg-slate-200 text-slate-600",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}>
      {DEVICE_STATUS_LABELS[status]}
    </span>
  );
}
