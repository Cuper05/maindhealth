import Image from "next/image";

type MaindOsLogoProps = {
  className?: string;
  width?: number;
  priority?: boolean;
};

/**
 * Logotipo MaindOS (placa metálica + Maind + icono + S).
 * Se usa tal cual, sin recortes ni cambios de color.
 */
export function MaindOsLogo({
  className = "",
  width = 220,
  priority = false,
}: MaindOsLogoProps) {
  const height = Math.round(width * (341 / 1024));
  return (
    <Image
      src="/brand/maindos-logo.png"
      alt="MaindOS"
      width={width}
      height={height}
      priority={priority}
      className={`block h-auto max-w-full object-contain ${className}`}
      style={{ width, height: "auto" }}
    />
  );
}
