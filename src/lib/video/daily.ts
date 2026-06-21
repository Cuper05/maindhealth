type DailyRoomResponse = {
  url?: string;
  name?: string;
  error?: string;
};

export type DailyRoom = {
  url: string;
  name: string;
};

export async function createDailyRoom(appointmentId: number): Promise<DailyRoom | null> {
  const apiKey = process.env.VIDEO_API_KEY ?? process.env.DAILY_API_KEY;
  if (!apiKey) return null;

  const roomName = `maindhealth-appt-${appointmentId}-${Date.now().toString(36)}`;

  try {
    const res = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: {
          enable_chat: true,
          enable_screenshare: true,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
        },
      }),
    });

    if (!res.ok) {
      console.error("[daily] room creation failed", await res.text());
      return null;
    }

    const data = (await res.json()) as DailyRoomResponse;
    if (!data.url || !data.name) return null;
    return { url: data.url, name: data.name };
  } catch (err) {
    console.error("[daily]", err);
    return null;
  }
}

export function isDailyEmbedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("daily.co");
}
