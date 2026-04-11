import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AlumnoVisionClient from "./AlumnoVisionClient";

export default async function AlumnosPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=%2Falumnos");
  }

  const role = String((session.user as { role?: string | null } | undefined)?.role || "")
    .trim()
    .toUpperCase();

  if (role !== "CLIENTE") {
    redirect("/clientes");
  }

  return (
    <AlumnoVisionClient
      currentEmail={String(session.user.email || "")}
      currentName={String(session.user.name || "")}
    />
  );
}
