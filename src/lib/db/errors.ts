import { NextResponse } from "next/server";

export function isDbComputeQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const cause =
    error && typeof error === "object" && "cause" in error
      ? String((error as { cause?: unknown }).cause)
      : "";
  return /compute time quota|exceeded the compute|code:\s*['"]?53000/i.test(
    `${message} ${cause}`,
  );
}

export function stationDbErrorResponse(error: unknown, fallback = "Error interno de la estación") {
  console.error(error);
  return NextResponse.json(
    {
      error: isDbComputeQuotaError(error)
        ? "La base de datos de la estación está saturada. Avise al personal (cuota Neon)."
        : fallback,
    },
    { status: 503 },
  );
}
