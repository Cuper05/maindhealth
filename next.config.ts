import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.0.10"],
  // pdfkit reads AFM/ICC files from node_modules at runtime; keep it external
  // and force those assets into the serverless trace (otherwise Vercel 500s / no email PDF).
  serverExternalPackages: ["pdfkit", "qrcode"],
  outputFileTracingIncludes: {
    "/api/station/prescription/[id]/pdf": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/station/prescription/[id]/email": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/prescriptions/[id]/pdf": ["./node_modules/pdfkit/js/data/**/*"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
