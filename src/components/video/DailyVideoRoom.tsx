"use client";

import { useEffect, useRef, useState } from "react";
import DailyIframe, { type DailyCall, type DailyParticipant } from "@daily-co/daily-js";
import { isDailyEmbedUrl } from "@/lib/video/daily";

export function DailyVideoRoom({
  meetingUrl,
  title = "Videollamada",
  userName,
  token,
  variant = "default",
  autoJoin = false,
  appointmentId,
}: {
  meetingUrl: string;
  title?: string;
  userName?: string | null;
  token?: string | null;
  variant?: "default" | "station" | "doctor";
  autoJoin?: boolean;
  appointmentId?: number;
}) {
  if (!isDailyEmbedUrl(meetingUrl)) {
    return (
      <a
        href={meetingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex rounded-lg bg-teal-700 px-4 py-2 text-sm text-white hover:bg-teal-800"
      >
        Abrir videollamada
      </a>
    );
  }

  const isStation = variant === "station" || autoJoin;
  const isDoctor = variant === "doctor";
  const trimmedName = userName?.trim();

  if (isStation) {
    return (
      <StationCallObject
        meetingUrl={meetingUrl}
        userName={trimmedName || "Paciente"}
        token={token?.trim() || null}
        appointmentId={appointmentId}
      />
    );
  }

  if (isDoctor || trimmedName) {
    return (
      <DoctorDailyFrame
        meetingUrl={meetingUrl}
        title={title}
        userName={trimmedName || "Médico"}
        token={token?.trim() || null}
        appointmentId={appointmentId}
      />
    );
  }

  const embedUrl = meetingUrl.includes("?")
    ? `${meetingUrl}&embed=true`
    : `${meetingUrl}?embed=true`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
      <p className="border-b border-slate-700 px-4 py-2 text-sm text-slate-200">{title}</p>
      <iframe
        src={embedUrl}
        allow="camera; microphone; fullscreen; display-capture"
        className="aspect-video w-full min-h-[70dvh] bg-black sm:min-h-[420px]"
        title={title}
      />
    </div>
  );
}

function postVideoEvent(
  appointmentId: number,
  event: "doctor_joined" | "call_ended",
) {
  return fetch("/api/station/video-opened", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appointmentId, event }),
  });
}

function attachTrack(
  el: HTMLVideoElement | HTMLAudioElement | null,
  track: MediaStreamTrack | null | undefined,
) {
  if (!el || !track) return;
  const cur = el.srcObject;
  if (cur instanceof MediaStream && cur.getTracks()[0] === track) {
    void el.play().catch(() => {
      /* autoplay policy */
    });
    return;
  }
  el.srcObject = new MediaStream([track]);
  void el.play().catch(() => {
    /* autoplay policy */
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (err) => {
        window.clearTimeout(t);
        reject(err);
      },
    );
  });
}

function mediaTrackOf(
  p: DailyParticipant | undefined,
  kind: "video" | "audio",
): MediaStreamTrack | null {
  if (!p) return null;
  const state = p.tracks?.[kind];
  if (!state || state.state === "off") return null;
  const t =
    (state as { persistentTrack?: MediaStreamTrack; track?: MediaStreamTrack })
      .persistentTrack ?? state.track;
  return t ?? null;
}

function videoTrackOf(p: DailyParticipant | undefined): MediaStreamTrack | null {
  return mediaTrackOf(p, "video");
}

function audioTrackOf(p: DailyParticipant | undefined): MediaStreamTrack | null {
  return mediaTrackOf(p, "audio");
}

async function enableStationEchoCancel(call: DailyCall) {
  try {
    await call.updateInputSettings({
      audio: {
        settings: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        // Reduce eco de sala (voz del mic que vuelve por la bocina vía el celular).
        processor: { type: "noise-cancellation" },
      },
    });
  } catch {
    try {
      await call.updateInputSettings({
        audio: {
          settings: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        },
      });
    } catch (err) {
      console.warn("[station-daily] echoCancel settings", err);
    }
  }
}

const STATION_SPEAKER_VOL = 0.62;
const STATION_DUCK_VOL = 0.05;

/**
 * Mientras el paciente habla al mic, baja la bocina para no oír su propia voz
 * (eco de ida y vuelta por el altavoz del celular del médico).
 */
function startStationSpeakerDuck(
  localAudioTrack: MediaStreamTrack,
  getAudioEl: () => HTMLAudioElement | null,
  isCancelled: () => boolean,
): () => void {
  let ctx: AudioContext | null = null;
  let raf = 0;
  let restoreTimer = 0;

  try {
    ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(new MediaStream([localAudioTrack]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (isCancelled()) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i]! - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const el = getAudioEl();
      if (el && rms > 0.035) {
        el.volume = STATION_DUCK_VOL;
        window.clearTimeout(restoreTimer);
        restoreTimer = window.setTimeout(() => {
          const a = getAudioEl();
          if (a) a.volume = STATION_SPEAKER_VOL;
        }, 400);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  } catch (err) {
    console.warn("[station-daily] duck failed", err);
  }

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(restoreTimer);
    void ctx?.close();
  };
}

/**
 * Estación Dell: callObject + startCamera (NO iframe).
 * Audio del médico en <audio>; anti-eco con AEC + duck de bocina al hablar.
 */
function StationCallObject({
  meetingUrl,
  userName,
  token,
  appointmentId,
}: {
  meetingUrl: string;
  userName: string;
  token: string | null;
  appointmentId?: number;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const startedRef = useRef(false);
  const remoteSeenRef = useRef(false);
  const endingRef = useRef(false);
  const [label, setLabel] = useState("Encendiendo cámara…");
  const [camError, setCamError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [doctorOn, setDoctorOn] = useState(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let call: DailyCall | null = null;
    let cancelled = false;
    let micOn = false;
    let stopDuck: (() => void) | null = null;
    let freezeWatch = 0;

    const setSpeakerVolume = (vol: number) => {
      if (remoteAudioRef.current) remoteAudioRef.current.volume = vol;
    };

    const endCall = (reason: string) => {
      if (!appointmentId || endingRef.current) return;
      endingRef.current = true;
      console.info("[station-daily] end", reason);
      setEnded(true);
      setDoctorOn(false);
      setLabel("Consulta terminada");
      if (remoteRef.current) remoteRef.current.srcObject = null;
      if (localRef.current) localRef.current.srcObject = null;
      let went = false;
      const goStandby = () => {
        if (went) return;
        went = true;
        window.location.replace("/estacion");
      };
      void postVideoEvent(appointmentId, "call_ended").finally(goStandby);
      window.setTimeout(goStandby, 1200);
      try {
        void call?.leave();
      } catch {
        /* ignore */
      }
    };

    const remoteStillHere = () => {
      const parts = call?.participants() ?? {};
      return Object.values(parts).some((p) => {
        const part = p as DailyParticipant | null | undefined;
        if (!part || part.local) return false;
        return Boolean(videoTrackOf(part) || audioTrackOf(part));
      });
    };

    const notifyDoctor = () => {
      if (!appointmentId || remoteSeenRef.current) return;
      remoteSeenRef.current = true;
      setDoctorOn(true);
      void postVideoEvent(appointmentId, "doctor_joined").catch(() => {
        remoteSeenRef.current = false;
        setDoctorOn(false);
      });
    };

    const enableMicWithAntiEcho = async () => {
      if (!call || micOn) return;
      micOn = true;
      try {
        await enableStationEchoCancel(call);
        await call.setLocalAudio(true);
        const localTrack = audioTrackOf(call.participants().local);
        if (localTrack) {
          stopDuck?.();
          stopDuck = startStationSpeakerDuck(
            localTrack,
            () => remoteAudioRef.current,
            () => cancelled,
          );
        }
      } catch {
        micOn = false;
      }
    };

    const ensureLocalCamera = async (active: DailyCall) => {
      for (let i = 0; i < 8; i++) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === "videoinput");
          const cam =
            cams.find((c) => /logi|webcam|c920|c270|c930|hd|usb/i.test(c.label)) ??
            cams[0];
          if (cam) {
            await active.setInputDevicesAsync({ videoDeviceId: cam.deviceId });
          }
          await active.setLocalVideo(true);
          if (active.localVideo()) {
            attachTrack(localRef.current, videoTrackOf(active.participants().local));
            return true;
          }
        } catch (err) {
          console.warn("[station-daily] ensureLocalCamera", err);
        }
        await new Promise((r) => setTimeout(r, 600));
      }
      return false;
    };

    const refreshMedia = () => {
      if (!call) return;
      const parts = call.participants();
      attachTrack(localRef.current, videoTrackOf(parts.local));
      const remote = Object.values(parts).find((p) => {
        const part = p as DailyParticipant | null | undefined;
        return Boolean(part) && !part!.local;
      }) as DailyParticipant | undefined;
      if (remote) {
        notifyDoctor();
        setLabel("Médico conectado");
        attachTrack(remoteRef.current, videoTrackOf(remote));
        // Solo audio REMOTO a la bocina — nunca el mic local.
        attachTrack(remoteAudioRef.current, audioTrackOf(remote));
        setSpeakerVolume(STATION_SPEAKER_VOL);
        void enableMicWithAntiEcho();
      }
    };

    const start = async () => {
      try {
        const existing = DailyIframe.getCallInstance?.();
        if (existing) {
          try {
            await existing.destroy();
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }

      call = DailyIframe.createCallObject({
        subscribeToTracksAutomatically: true,
        allowMultipleCallInstances: false,
        dailyConfig: {
          userMediaAudioConstraints: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          userMediaVideoConstraints: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
      });

      call.on("track-started", (ev) => {
        if (cancelled || !ev?.participant || !ev.track) return;
        if (ev.participant.local) {
          // Nunca reproducir audio local en la bocina (eco inmediato).
          if (ev.track.kind === "video") {
            attachTrack(localRef.current, ev.track);
            setLabel(
              remoteSeenRef.current ? "Médico conectado" : "Cámara ON — en sala",
            );
          } else if (ev.track.kind === "audio" && micOn && !stopDuck) {
            stopDuck = startStationSpeakerDuck(
              ev.track,
              () => remoteAudioRef.current,
              () => cancelled,
            );
          }
          return;
        }
        notifyDoctor();
        setLabel("Médico conectado");
        if (ev.track.kind === "video") {
          attachTrack(remoteRef.current, ev.track);
        } else if (ev.track.kind === "audio") {
          attachTrack(remoteAudioRef.current, ev.track);
          setSpeakerVolume(STATION_SPEAKER_VOL);
          void enableMicWithAntiEcho();
        }
      });

      call.on("participant-joined", (ev) => {
        if (cancelled || ev?.participant?.local) return;
        notifyDoctor();
        setLabel("Médico conectado");
        refreshMedia();
      });

      call.on("participant-updated", () => {
        if (cancelled) return;
        window.clearTimeout((call as DailyCall & { __mhRefresh?: number }).__mhRefresh);
        (call as DailyCall & { __mhRefresh?: number }).__mhRefresh = window.setTimeout(() => {
          if (!cancelled) refreshMedia();
        }, 300);
      });

      call.on("participant-left", (ev) => {
        if (cancelled || !appointmentId || ev?.participant?.local) return;
        if (!remoteSeenRef.current) return;
        if (!remoteStillHere()) endCall("participant-left");
      });

      call.on("track-stopped", (ev) => {
        if (cancelled || !appointmentId || ev?.participant?.local) return;
        if (!remoteSeenRef.current) return;
        window.setTimeout(() => {
          if (cancelled || endingRef.current) return;
          if (!remoteStillHere()) endCall("track-stopped");
        }, 700);
      });

      call.on("left-meeting", () => {
        if (!cancelled && remoteSeenRef.current) endCall("left-meeting");
      });

      call.on("error", (ev) => {
        console.error("[station-daily] error", ev);
        if (!cancelled) {
          setCamError("Error Daily — recargue la sala");
          setLabel("Error de video");
        }
      });

      try {
        setLabel("Pidiendo cámara…");
        try {
          await withTimeout(
            call.startCamera({
              startVideoOff: false,
              startAudioOff: true,
              audioSource: true,
              videoSource: true,
            }),
            8000,
            "timeout cámara",
          );
        } catch (err) {
          console.warn("[station-daily] startCamera", err);
        }
        if (cancelled) return;
        await enableStationEchoCancel(call);
        attachTrack(localRef.current, videoTrackOf(call.participants().local));
        setLabel("Cámara lista — entrando a sala…");

        await withTimeout(
          call.join({
            url: meetingUrl,
            userName,
            ...(token ? { token } : {}),
            startVideoOff: false,
            startAudioOff: true,
          }),
          12000,
          "timeout sala Daily",
        );
        if (cancelled) return;

        await enableStationEchoCancel(call);
        await call.setLocalVideo(true);
        try {
          await call.setLocalAudio(false);
        } catch {
          /* ignore */
        }

        refreshMedia();
        const published = await ensureLocalCamera(call);
        setLabel(
          remoteSeenRef.current
            ? "Médico conectado"
            : published
              ? "Cámara ON — esperando médico"
              : "Sin cámara publicada — reintentando…",
        );

        let goneTicks = 0;
        freezeWatch = window.setInterval(() => {
          if (cancelled || endingRef.current || !remoteSeenRef.current) return;
          if (!remoteStillHere()) {
            goneTicks += 1;
            if (goneTicks >= 10) endCall("remote-gone");
          } else {
            goneTicks = 0;
          }
        }, 800);
      } catch (err) {
        console.error("[station-daily] join/camera failed", err);
        if (!cancelled) {
          setCamError(
            err instanceof Error
              ? err.message
              : "No se pudo usar la cámara. Permita cámara en Edge/Chrome.",
          );
          setLabel("Error de cámara");
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (freezeWatch) window.clearInterval(freezeWatch);
      stopDuck?.();
      const active = call;
      call = null;
      if (active) {
        void active.leave().finally(() => {
          void active.destroy();
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-[90%] rounded-lg bg-slate-900/90 px-3 py-2 text-sm font-semibold text-white">
        {label}
        {camError ? (
          <span className="mt-1 block text-xs font-normal text-amber-200">{camError}</span>
        ) : null}
      </div>

      <video
        ref={remoteRef}
        autoPlay
        playsInline
        muted
        className={
          doctorOn
            ? "absolute inset-0 h-full w-full bg-black object-cover"
            : "hidden"
        }
      />

      {/* La cámara se publica al médico, pero no se muestra en la Dell. */}
      <video
        ref={localRef}
        autoPlay
        playsInline
        muted
        data-station-local-preview=""
        aria-hidden
        className="pointer-events-none absolute h-px w-px opacity-0"
      />

      {ended ? (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#0c2a47] text-white">
          <p className="text-4xl font-semibold">Consulta terminada</p>
          <p className="mt-3 text-xl text-blue-100">Volviendo a estación lista…</p>
        </div>
      ) : null}

      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
    </div>
  );
}

/**
 * Médico: call object (no Prebuilt).
 * El paciente (remoto) llena la pantalla; la cámara del celular queda en PIP.
 */
function DoctorDailyFrame({
  meetingUrl,
  title,
  userName,
  token,
  appointmentId,
}: {
  meetingUrl: string;
  title: string;
  userName: string;
  token: string | null;
  appointmentId?: number;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const startedRef = useRef(false);
  const endingRef = useRef(false);
  const [label, setLabel] = useState("Conectando…");
  const [patientOn, setPatientOn] = useState(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let call: DailyCall | null = null;
    let cancelled = false;

    const notifyEnded = () => {
      if (!appointmentId || endingRef.current) return;
      endingRef.current = true;
      void postVideoEvent(appointmentId, "call_ended").catch(() => {
        /* ignore */
      });
    };

    const refreshMedia = () => {
      if (!call) return;
      const parts = call.participants();
      attachTrack(localRef.current, videoTrackOf(parts.local));
      const remote = Object.values(parts).find((p) => {
        const part = p as DailyParticipant | null | undefined;
        return Boolean(part) && !part!.local;
      }) as DailyParticipant | undefined;
      if (remote) {
        setPatientOn(true);
        setLabel("Paciente en estación");
        attachTrack(remoteRef.current, videoTrackOf(remote));
        attachTrack(remoteAudioRef.current, audioTrackOf(remote));
      }
    };

    const start = async () => {
      try {
        const existing = DailyIframe.getCallInstance?.();
        if (existing) {
          try {
            await existing.leave();
          } catch {
            /* ignore */
          }
          try {
            await existing.destroy();
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }

      call = DailyIframe.createCallObject({
        subscribeToTracksAutomatically: true,
        allowMultipleCallInstances: false,
      });

      call.on("track-started", (ev) => {
        if (cancelled || !ev?.participant || !ev.track) return;
        if (ev.participant.local) {
          if (ev.track.kind === "video") {
            attachTrack(localRef.current, ev.track);
          }
          return;
        }
        setPatientOn(true);
        setLabel("Paciente en estación");
        if (ev.track.kind === "video") {
          attachTrack(remoteRef.current, ev.track);
        } else if (ev.track.kind === "audio") {
          attachTrack(remoteAudioRef.current, ev.track);
        }
      });

      call.on("participant-joined", (ev) => {
        if (cancelled || ev?.participant?.local) return;
        setPatientOn(true);
        setLabel("Paciente en estación");
        refreshMedia();
      });

      call.on("participant-updated", () => {
        if (cancelled) return;
        window.clearTimeout((call as DailyCall & { __mhRefresh?: number }).__mhRefresh);
        (call as DailyCall & { __mhRefresh?: number }).__mhRefresh = window.setTimeout(() => {
          if (!cancelled) refreshMedia();
        }, 300);
      });

      call.on("left-meeting", () => {
        if (!cancelled) notifyEnded();
      });

      await call.join({
        url: meetingUrl,
        userName,
        ...(token ? { token } : {}),
        startVideoOff: false,
        startAudioOff: false,
      });

      if (cancelled) return;
      try {
        await call.setLocalVideo(true);
        await call.setLocalAudio(true);
      } catch {
        /* ignore */
      }
      refreshMedia();
      if (!cancelled) {
        setLabel((prev) =>
          prev === "Paciente en estación" ? prev : "En llamada — esperando estación",
        );
      }
    };

    void start().catch((err) => {
      console.error("[daily-doctor] join failed", err);
      if (!cancelled) setLabel("Error de conexión");
    });

    return () => {
      cancelled = true;
      const active = call;
      call = null;
      if (active) {
        void active.leave().finally(() => {
          void active.destroy();
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="relative overflow-hidden bg-black sm:rounded-xl sm:border sm:border-slate-800"
      title={title}
      data-doctor-video=""
    >
      <p className="relative z-20 border-b border-slate-800 bg-slate-950/90 px-3 py-2 text-sm font-medium text-slate-100">
        {title}
        <span className="mt-0.5 block text-xs font-normal text-slate-400">{label}</span>
      </p>
      <div className="relative h-[min(72dvh,900px)] w-full bg-black sm:h-[min(70dvh,780px)]">
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full bg-black object-cover"
        />
        {/* Se publica la cámara del celular, pero no se muestra. En pantalla va el paciente. */}
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          aria-hidden
          className="pointer-events-none absolute h-px w-px opacity-0"
        />
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      </div>
    </div>
  );
}
