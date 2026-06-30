import { NextResponse } from "next/server";
import { getActiveDoctors } from "@/lib/queries/catalogs";
import { formatPersonName } from "@/lib/format/name";

export async function GET() {
  const doctors = await getActiveDoctors();
  return NextResponse.json({
    doctors: doctors.map((d) => ({
      id: d.id,
      name: formatPersonName(d),
      specialty: d.specialty,
    })),
  });
}
