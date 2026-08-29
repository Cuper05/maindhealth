import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function StationKioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen touch-pan-x touch-pan-y overscroll-none antialiased selection:bg-[#1d6eb8]/20">
      {children}
    </div>
  );
}
