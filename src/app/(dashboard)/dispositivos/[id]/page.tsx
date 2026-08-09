import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { catalogDeviceTypesTable, medicalDevicesTable } from "@/lib/db/schema";
import { getDeviceTypes } from "@/lib/queries/catalogs";
import { getDeviceReadings } from "@/lib/queries/device-readings";
import { getActivePatients } from "@/lib/queries/catalogs";
import { DeviceReadingForm } from "@/components/forms/DeviceReadingForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeviceEditor } from "@/components/forms/DeviceEditor";
import { cardClassName } from "@/lib/ui/classes";

export default async function DispositivoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!session?.role || !can(session.role, "config:view")) redirect("/dispositivos");

  const { id } = await params;
  const deviceId = Number(id);
  if (!Number.isFinite(deviceId)) notFound();

  const [row] = await db
    .select({
      id: medicalDevicesTable.id,
      deviceTypeId: medicalDevicesTable.deviceTypeId,
      brand: medicalDevicesTable.brand,
      model: medicalDevicesTable.model,
      serialNumber: medicalDevicesTable.serialNumber,
      registeredAt: medicalDevicesTable.registeredAt,
      lastCalibrationAt: medicalDevicesTable.lastCalibrationAt,
      lastMaintenanceAt: medicalDevicesTable.lastMaintenanceAt,
      status: medicalDevicesTable.status,
      location: medicalDevicesTable.location,
      notes: medicalDevicesTable.notes,
      typeName: catalogDeviceTypesTable.name,
      typeCategory: catalogDeviceTypesTable.category,
    })
    .from(medicalDevicesTable)
    .innerJoin(catalogDeviceTypesTable, eq(medicalDevicesTable.deviceTypeId, catalogDeviceTypesTable.id))
    .where(eq(medicalDevicesTable.id, deviceId));

  if (!row) notFound();

  // Solo equipos clínicos miden signos vitales (baumanómetro, oxímetro, etc.).
  // Tecnológicos/soporte (cámara, micrófono, PC) no muestran captura de lecturas.
  const supportsVitalReadings = row.typeCategory === "clinico";

  const [deviceTypes, readings, patients] = await Promise.all([
    getDeviceTypes(),
    supportsVitalReadings && can(session.role, "readings:view")
      ? getDeviceReadings(deviceId)
      : Promise.resolve([]),
    supportsVitalReadings && can(session.role, "readings:write")
      ? getActivePatients()
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title={row.typeName}
        description={[row.brand, row.model].filter(Boolean).join(" ") || "Sin marca/modelo"}
        backHref="/dispositivos"
      />
      <DeviceEditor device={row} deviceTypes={deviceTypes} />

      {supportsVitalReadings && can(session.role, "readings:write") && (
        <DeviceReadingForm
          deviceId={deviceId}
          patients={patients.map((p) => ({
            id: p.id,
            label: `${p.chartNumber} — ${p.firstName} ${p.lastNamePaternal}`,
          }))}
        />
      )}

      {supportsVitalReadings && can(session.role, "readings:view") && (
        <section className={`${cardClassName} mt-6`}>
          <h2 className="mb-4 font-medium text-slate-900">Lecturas recientes</h2>
          {readings.length === 0 ? (
            <p className="text-sm text-slate-500">Sin lecturas registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pb-2 pr-4">Fecha</th>
                    <th className="pb-2 pr-4">Paciente</th>
                    <th className="pb-2 pr-4">PA</th>
                    <th className="pb-2 pr-4">SpO2</th>
                    <th className="pb-2">FC</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-2 pr-4">{r.recordedAt.toLocaleString("es-MX")}</td>
                      <td className="py-2 pr-4">{r.patientName ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {r.systolicPressure}/{r.diastolicPressure}
                      </td>
                      <td className="py-2 pr-4">{r.oxygenSaturation ?? "—"}</td>
                      <td className="py-2">{r.heartRate ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
