import { config } from "dotenv";
config({ override: true });
config({ path: ".env.local", override: true });

async function main() {
  const { db } = await import("../src/lib/db");
  const { stationClinicalProtocolsTable } = await import("../src/lib/db/schema");
  const rows = await db
    .select({
      code: stationClinicalProtocolsTable.code,
      name: stationClinicalProtocolsTable.name,
      active: stationClinicalProtocolsTable.active,
    })
    .from(stationClinicalProtocolsTable)
    .orderBy(stationClinicalProtocolsTable.code);

  for (const row of rows) {
    console.log(`${row.active ? "ON " : "OFF"} ${row.code} — ${row.name}`);
  }
  console.log(`---\nTOTAL ${rows.length} · ACTIVOS ${rows.filter((r) => r.active).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
