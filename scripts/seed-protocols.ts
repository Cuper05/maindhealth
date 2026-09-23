/**
 * Actualiza solo protocolos/servicios de estación (sin re-sembrar usuarios).
 * Uso: npx tsx scripts/seed-protocols.ts
 */
import { config } from "dotenv";
config({ override: true });
config({ path: ".env.local", override: true });

async function main() {
  const { seedStationCommerce } = await import("../src/lib/kiosk/seed-commerce");
  await seedStationCommerce();
  console.log("Protocolos de estación actualizados.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
