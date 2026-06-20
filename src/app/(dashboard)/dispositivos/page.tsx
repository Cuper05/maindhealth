import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  catalogDeviceTypesTable,
  DEVICE_STATUS_LABELS,
  medicalDevicesTable,
  type DeviceStatus,
} from "@/lib/db/schema";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/forms/DeviceEditor";
import { buttonPrimaryClassName } from "@/lib/ui/classes";

export default async function DispositivosPage() {
  const session = await requireSession();
  if (!session?.role || !can(session.role, "config:view")) redirect("/");

  const rows = await db
    .select({
      id: medicalDevicesTable.id,
      brand: medicalDevicesTable.brand,
      model: medicalDevicesTable.model,
      serialNumber: medicalDevicesTable.serialNumber,
      status: medicalDevicesTable.status,
      location: medicalDevicesTable.location,
      lastCalibrationAt: medicalDevicesTable.lastCalibrationAt,
      lastMaintenanceAt: medicalDevicesTable.lastMaintenanceAt,
      typeName: catalogDeviceTypesTable.name,
    })
    .from(medicalDevicesTable)
    .innerJoin(
      catalogDeviceTypesTable,
      eq(medicalDevicesTable.deviceTypeId, catalogDeviceTypesTable.id),
    )
    .orderBy(desc(medicalDevicesTable.createdAt));

  const alerts = rows.filter((r) =>
    ["en_mantenimiento", "calibracion_pendiente"].includes(r.status),
  );

  return (
    <div>
      <PageHeader
        title="Dispositivos médicos"
        description="Inventario, calibración y mantenimiento del teleconsultorio."
        action={
          <Link href="/dispositivos/nuevo" className={buttonPrimaryClassName}>
            + Alta de equipo
          </Link>
        }
      />

      {alerts.length > 0 && (
        <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-medium text-amber-900">
            Requieren atención ({alerts.length})
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {alerts.map((d) => (
              <li key={d.id}>
                <Link href={`/dispositivos/${d.id}`} className="text-amber-900 hover:underline">
                  {d.typeName}
                  {d.serialNumber ? ` · ${d.serialNumber}` : ""} —{" "}
                  {DEVICE_STATUS_LABELS[d.status as DeviceStatus]}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Equipo</th>
              <th className="px-4 py-3 font-medium">Marca / modelo</th>
              <th className="px-4 py-3 font-medium">Serie</th>
              <th className="px-4 py-3 font-medium">Ubicación</th>
              <th className="px-4 py-3 font-medium">Calibración</th>
              <th className="px-4 py-3 font-medium">Estatus</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Sin equipos.{" "}
                  <Link href="/dispositivos/nuevo" className="text-teal-700 hover:underline">
                    Registrar inventario
                  </Link>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{row.typeName}</td>
                  <td className="px-4 py-3">
                    {[row.brand, row.model].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.serialNumber ?? "—"}</td>
                  <td className="px-4 py-3">{row.location ?? "—"}</td>
                  <td className="px-4 py-3">{row.lastCalibrationAt ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status as DeviceStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dispositivos/${row.id}`} className="text-teal-700 hover:underline">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
