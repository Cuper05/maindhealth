"use client";

import { useEffect, useRef } from "react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";
import { isDailyEmbedUrl } from "@/lib/video/daily";

export function DailyVideoRoom({
  meetingUrl,
  title = "Videollamada",
  userName,
  token,
  variant = "default",
  autoJoin = false,
}: {
  meetingUrl: string;
  title?: string;
  /** When set (e.g. kiosk patient), prefill Daily and skip the name form. */
  userName?: string | null;
  /** Daily meeting token (station: enable_prejoin_ui false). */
  token?: string | null;
  /** Station sala: large frame + auto-enter call. */
  variant?: "default" | "station";
  /** Alias for station auto-enter (no Join click). */
  autoJoin?: boolean;
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
  const trimmedName = userName?.trim();

  // Station always uses daily-js (token + auto-join). Named joins also use createFrame.
  if (isStation || trimmedName) {
    return (
      <DailyNamedFrame
        meetingUrl={meetingUrl}
        title={title}
        userName={trimmedName || "Paciente"}
        token={token?.trim() || null}
        station={isStation}
      />
    );
  }

  // Staff/portal default: plain iframe (keeps normal Daily prejoin if domain has it).
  const embedUrl = meetingUrl.includes("?")
    ? `${meetingUrl}&embed=true`
    : `${meetingUrl}?embed=true`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
      <p className="border-b border-slate-700 px-4 py-2 text-sm text-slate-200">{title}</p>
      <iframe
        src={embedUrl}
        allow="camera; microphone; fullscreen; display-capture"
        className="aspect-video w-full min-h-[360px] bg-black"
        title={title}
      />
    </div>
  );
}

function DailyNamedFrame({
  meetingUrl,
  title,
  userName,
  token,
  station,
}: {
  meetingUrl: string;
  title: string;
  userName: string;
  token: string | null;
  station: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    let call: DailyCall | null = null;
    let cancelled = false;

    const start = async () => {
      // Destroy any leftover frame from a previous mount in this container.
      parent.replaceChildren();

      call = DailyIframe.createFrame(parent, {
        showLeaveButton: true,
        showFullscreenButton: station,
        showUserNameChangeUI: false,
        iframeStyle: {
          width: "100%",
          height: "100%",
          border: "0",
          ...(station ? {} : { minHeight: "360px" }),
        },
      });

      if (cancelled) {
        await call.destroy();
        return;
      }

      // Token with enable_prejoin_ui:false skips "Are you ready to join?" / Join.
      await call.join({
        url: meetingUrl,
        userName,
        ...(token ? { token } : {}),
        startVideoOff: false,
        startAudioOff: false,
      });
    };

    void start().catch((err) => {
      console.error("[daily] join failed", err);
    });

    return () => {
      cancelled = true;
      const active = call;
      call = null;
      if (!active) return;
      void active.leave().finally(() => {
        void active.destroy();
      });
    };
  }, [meetingUrl, userName, token, station]);

  if (station) {
    return (
      <div className="h-full w-full bg-black" title={title}>
        <div
          ref={containerRef}
          className="h-full w-full bg-black [&_iframe]:h-full [&_iframe]:w-full"
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
      <p className="border-b border-slate-700 px-4 py-2 text-sm text-slate-200">{title}</p>
      <div
        ref={containerRef}
        className="aspect-video w-full min-h-[360px] bg-black [&_iframe]:h-full [&_iframe]:min-h-[360px] [&_iframe]:w-full"
        title={title}
      />
    </div>
  );
}
