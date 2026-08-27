import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  /** Ancho visual en px. */
  width?: number;
  priority?: boolean;
  /** compact = solo cabe en header; full = con tagline legible */
  size?: "compact" | "full";
};

/**
 * Logotipo oficial MaindHealth (cruz + nombre + tagline).
 * No modifica el asset: solo escala.
 */
export function BrandLogo({
  className = "",
  width,
  priority = false,
  size = "compact",
}: BrandLogoProps) {
  const w = width ?? (size === "full" ? 280 : 160);
  const h = Math.round(w * (546 / 854));
  return (
    <Image
      src="/brand/maindhealth-logo.png"
      alt="MaindHealth"
      width={w}
      height={h}
      priority={priority}
      className={`block h-auto max-w-full object-contain ${className}`}
      style={{ width: w, height: "auto" }}
    />
  );
}
