type DailyRoomResponse = {
  url?: string;
  name?: string;
  error?: string;
  info?: string;
};

export type DailyRoom = {
  url: string;
  name: string;
};

export type CreateDailyRoomResult =
  | { ok: true; room: DailyRoom }
  | { ok: false; error: string };

function dailyApiKey(): string | null {
  return process.env.VIDEO_API_KEY ?? process.env.DAILY_API_KEY ?? null;
}

export async function createDailyRoom(appointmentId: number): Promise<CreateDailyRoomResult> {
  const apiKey = dailyApiKey();
  if (!apiKey) {
    const error = "VIDEO_API_KEY no configurada — no se puede crear la sala Daily";
    console.error("[daily]", error);
    return { ok: false, error };
  }

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
        privacy: "public",
        properties: {
          enable_chat: true,
          enable_screenshare: true,
          start_video_off: false,
          start_audio_off: false,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const error = `Daily API ${res.status}: ${body.slice(0, 240) || res.statusText}`;
      console.error("[daily] room creation failed", error);
      return { ok: false, error };
    }

    const data = (await res.json()) as DailyRoomResponse;
    if (!data.url || !data.name) {
      const error = "Daily respondió sin URL de sala";
      console.error("[daily]", error, data);
      return { ok: false, error };
    }
    return { ok: true, room: { url: data.url, name: data.name } };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Error de red al crear sala Daily";
    console.error("[daily]", err);
    return { ok: false, error };
  }
}

export type CreateDailyTokenResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

/**
 * Meeting token for station auto-join. `enable_prejoin_ui: false` skips Daily's
 * "Are you ready to join?" lobby (client-side showPrejoinUI is not in daily-js).
 */
export async function createStationDailyToken(input: {
  roomName: string;
  userName: string;
}): Promise<CreateDailyTokenResult> {
  const apiKey = dailyApiKey();
  if (!apiKey) {
    const error = "VIDEO_API_KEY no configurada — no se puede crear token Daily";
    console.error("[daily]", error);
    return { ok: false, error };
  }

  try {
    const res = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          room_name: input.roomName,
          user_name: input.userName,
          start_video_off: false,
          start_audio_off: false,
          enable_prejoin_ui: false,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const error = `Daily token API ${res.status}: ${body.slice(0, 240) || res.statusText}`;
      console.error("[daily] token creation failed", error);
      return { ok: false, error };
    }

    const data = (await res.json()) as { token?: string };
    if (!data.token) {
      const error = "Daily respondió sin token";
      console.error("[daily]", error, data);
      return { ok: false, error };
    }
    return { ok: true, token: data.token };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Error de red al crear token Daily";
    console.error("[daily]", err);
    return { ok: false, error };
  }
}

/** Extract room name from https://domain.daily.co/room-name */
export function parseDailyRoomName(meetingUrl: string | null | undefined): string | null {
  if (!meetingUrl) return null;
  try {
    const pathname = new URL(meetingUrl).pathname.replace(/^\/+/, "");
    const name = pathname.split("/")[0]?.trim();
    return name || null;
  } catch {
    return null;
  }
}

export function isDailyEmbedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes("daily.co");
}
