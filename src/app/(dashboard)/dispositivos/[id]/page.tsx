import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { catalogDeviceTypesTable, medicalDevicesTable } from "@/lib/db/schema";
import { getDeviceTypes } from "@/lib/queries/catalogs";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeviceEditor } from "@/components/forms/DeviceEditor";

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

  const deviceTypes = await getDeviceTypes();

  return (
    <div>
      <PageHeader
        title={row.typeName}
        description={[row.brand, row.model].filter(Boolean).join(" ") || "Sin marca/modelo"}
        backHref="/dispositivos"
      />
      <DeviceEditor device={row} deviceTypes={deviceTypes} />
    </div>
  );
}
