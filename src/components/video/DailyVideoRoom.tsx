"use client";

import { isDailyEmbedUrl } from "@/lib/video/daily";

export function DailyVideoRoom({
  meetingUrl,
  title = "Videollamada",
}: {
  meetingUrl: string;
  title?: string;
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
