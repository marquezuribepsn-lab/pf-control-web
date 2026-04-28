import { AdminRunningLoaderCard } from "@/components/admin/AdminRunningLoader";

export default function AdminLoading() {
  return (
    <main className="mx-auto max-w-7xl p-6 text-slate-100">
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
        <div className="flex justify-center">
          <AdminRunningLoaderCard message="Cargando..." detail="Preparando modulo admin..." />
        </div>
      </div>
    </main>
  );
}
