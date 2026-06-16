import { LoginFormWrapper } from "@/components/LoginForm";
import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 to-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-teal-100 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-teal-600">
          Telemedicina
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{APP_NAME}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Teleconsultorio — agenda, pacientes y consultas en línea.
        </p>
        <div className="mt-6">
          <LoginFormWrapper />
        </div>
      </div>
    </div>
  );
}
