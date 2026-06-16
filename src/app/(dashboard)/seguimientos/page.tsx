import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function SeguimientosPage() {
  return (
    <ModulePlaceholder
      title="Seguimiento del paciente"
      description="Evolución clínica, observaciones y próxima revisión."
      phase={1}
      tables={["follow_ups"]}
    />
  );
}
