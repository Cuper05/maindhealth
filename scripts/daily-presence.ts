import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { appointmentsTable } from "../src/lib/db/schema";

async function main() {
  const apptId = Number(process.argv[2] || 10);
  const apiKey = process.env.VIDEO_API_KEY ?? process.env.DAILY_API_KEY;
  const [a] = await db
    .select({
      id: appointmentsTable.id,
      meetingUrl: appointmentsTable.meetingUrl,
      meetingRoomName: appointmentsTable.meetingRoomName,
    })
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, apptId));
  if (!a) {
    console.log(JSON.stringify({ error: "no appointment", apptId }));
    return;
  }
  const room = a.meetingRoomName || "";
  const headers = { Authorization: `Bearer ${apiKey ?? ""}` };
  const roomRes = await fetch(`https://api.daily.co/v1/rooms/${encodeURIComponent(room)}`, {
    headers,
  });
  const presenceRes = await fetch(
    `https://api.daily.co/v1/rooms/${encodeURIComponent(room)}/presence`,
    { headers },
  );
  const meetingsRes = await fetch("https://api.daily.co/v1/meetings?limit=10", { headers });
  const roomJson = await roomRes.json().catch(() => ({ status: roomRes.status }));
  const presenceJson = await presenceRes.json().catch(() => ({ status: presenceRes.status }));
  const meetingsJson = await meetingsRes.json().catch(() => ({ status: meetingsRes.status }));
  console.log(
    JSON.stringify(
      {
        appt: a,
        hasKey: Boolean(apiKey),
        roomStatus: roomRes.status,
        room: roomJson,
        presenceStatus: presenceRes.status,
        presence: presenceJson,
        meetingsStatus: meetingsRes.status,
        meetings: meetingsJson,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
