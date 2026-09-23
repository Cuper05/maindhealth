import { config } from "dotenv";
config({ override: true });
config({ path: ".env.local", override: true });

async function main() {
  const { expireStaleWaitingDoctorSessions, getWaitingDoctorStationSessions } =
    await import("../src/lib/queries/station-waiting");

  const closed = await expireStaleWaitingDoctorSessions();
  const waiting = await getWaitingDoctorStationSessions();
  console.log(`closed=${closed} remaining_fresh_waiting=${waiting.length}`);
  for (const w of waiting) {
    console.log(`  still: appt=${w.appointmentId} ${w.patientName}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
