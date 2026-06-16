import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function DispositivosPage() {
  return (
    <ModulePlaceholder
      title="Dispositivos médicos"
      description="Inventario, calibración, mantenimiento y estatus operativo del teleconsultorio."
      phase={2}
      tables={["medical_devices", "catalog_device_types"]}
    />
  );
}
