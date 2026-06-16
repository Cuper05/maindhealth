import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export default function DocumentosPage() {
  return (
    <ModulePlaceholder
      title="Documentos clínicos"
      description="PDFs, laboratorios, imágenes y recetas previas del paciente."
      phase={2}
      tables={["clinical_documents"]}
    />
  );
}
