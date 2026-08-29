import { LoginFormWrapper } from "@/components/LoginForm";
import { BrandLogo } from "@/components/BrandLogo";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 to-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-teal-100 bg-white p-8 shadow-sm">
        <BrandLogo width={220} priority className="mx-auto" />
        <p className="mt-4 text-center text-sm text-slate-600">
          Teleconsultorio — agenda, pacientes y consultas en línea.
        </p>
        <div className="mt-6">
          <LoginFormWrapper />
        </div>
      </div>
    </div>
  );
}
