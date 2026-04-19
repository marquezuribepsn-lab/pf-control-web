import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AlumnoPagosClient from "./AlumnoPagosClient";

export default async function AlumnosPagosPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=%2Falumnos%2Fpagos");
  }

  const role = String((session.user as { role?: string | null } | undefined)?.role || "")
    .trim()
    .toUpperCase();

  if (role !== "CLIENTE") {
    redirect("/clientes");
  }

  return <AlumnoPagosClient />;
}
