export default function StationKioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen antialiased selection:bg-[#1d6eb8]/20">
      {children}
    </div>
  );
}
