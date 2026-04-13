import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AlumnosPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=%2Falumnos%2Finicio");
  }

  const role = String((session.user as { role?: string | null } | undefined)?.role || "")
    .trim()
    .toUpperCase();

  if (role !== "CLIENTE") {
    redirect("/clientes");
  }

  redirect("/alumnos/inicio");
}
