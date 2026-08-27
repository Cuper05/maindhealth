/**
 * Impresión silenciosa vía servicio local de estación (127.0.0.1:3929).
 * Evita el diálogo "Guardar archivo" de Microsoft Print to PDF.
 */

const BRIDGE_URL = "http://127.0.0.1:3929";

export async function printStationPdf(
  pdfBytes: ArrayBuffer,
  onProgress?: (msg: string) => void,
): Promise<{ printer: string }> {
  onProgress?.("Contactando servicio local de impresión…");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    onProgress?.("Enviando receta a la impresora física…");
    const res = await fetch(`${BRIDGE_URL}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: pdfBytes,
      signal: ctrl.signal,
    });
    const data = (await res.json()) as {
      ok?: boolean;
      printer?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "No se pudo imprimir en la estación");
    }
    onProgress?.(`Impreso en ${data.printer ?? "impresora"}`);
    return { printer: data.printer || "impresora" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Failed to fetch|NetworkError|abort/i.test(msg)) {
      throw new Error(
        "No hay servicio de impresión (127.0.0.1:3929). Abra iniciar-servicio-impresora.bat en la PC de la estación.",
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}
