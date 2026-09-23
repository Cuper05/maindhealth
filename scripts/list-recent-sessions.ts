import { config } from "dotenv";
config({ override: true });
config({ path: ".env.local", override: true });

async function main() {
  const { db } = await import("../src/lib/db");
  const { appointmentsTable, stationKioskSessionsTable } = await import(
    "../src/lib/db/schema"
  );
  const { desc, eq } = await import("drizzle-orm");

  const sessions = await db
    .select({
      id: stationKioskSessionsTable.id,
      appt: stationKioskSessionsTable.appointmentId,
      status: stationKioskSessionsTable.status,
      device: stationKioskSessionsTable.deviceStatus,
      updatedAt: stationKioskSessionsTable.updatedAt,
      draft: stationKioskSessionsTable.assessmentDraft,
    })
    .from(stationKioskSessionsTable)
    .orderBy(desc(stationKioskSessionsTable.updatedAt))
    .limit(6);

  for (const s of sessions) {
    const d =
      s.draft && typeof s.draft === "object"
        ? (s.draft as Record<string, unknown>)
        : {};
    let room: string | null = null;
    let urlTail: string | null = null;
    if (s.appt) {
      const [a] = await db
        .select({
          url: appointmentsTable.meetingUrl,
          room: appointmentsTable.meetingRoomName,
        })
        .from(appointmentsTable)
        .where(eq(appointmentsTable.id, s.appt))
        .limit(1);
      room = a?.room ?? null;
      urlTail = a?.url?.slice(-48) ?? null;
    }
    console.log(
      JSON.stringify({
        id: s.id,
        appt: s.appt,
        status: s.status,
        device: s.device,
        ageMin: Math.round((Date.now() - new Date(s.updatedAt).getTime()) / 60000),
        videoOpened: d.videoOpened === true,
        doctorPresent: d.doctorPresent === true,
        callEnded: d.callEnded === true,
        room,
        urlTail,
      }),
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
