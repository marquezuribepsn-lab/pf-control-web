import { AdminRunningLoaderCard } from "@/components/admin/AdminRunningLoader";
import { ADMIN_CARD_SURFACE, ADMIN_PAGE_CONTAINER } from "@/components/admin/layoutTokens";

export default function AdminLoading() {
  return (
    <main className={ADMIN_PAGE_CONTAINER}>
      <div className={`${ADMIN_CARD_SURFACE} p-6 text-center`}>
        <div className="flex justify-center">
          <AdminRunningLoaderCard message="Cargando..." detail="Preparando modulo admin..." />
        </div>
      </div>
    </main>
  );
}
