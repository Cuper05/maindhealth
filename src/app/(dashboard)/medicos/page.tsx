import { redirect } from "next/navigation";

/** La gestión de médicos está en Configuración. */
export default function MedicosRedirectPage() {
  redirect("/configuracion");
}
