import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AlumnoVisionClient from "../AlumnoVisionClient";

type AlumnoCategory = "inicio" | "rutina" | "nutricion" | "progreso" | "musica";

const ALLOWED_CATEGORIES: AlumnoCategory[] = [
  "inicio",
  "rutina",
  "nutricion",
  "progreso",
  "musica",
];

function normalizeCategory(value: string): AlumnoCategory | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (ALLOWED_CATEGORIES.includes(normalized as AlumnoCategory)) {
    return normalized as AlumnoCategory;
  }
  return null;
}

export default async function AlumnosCategoriaPage({
  params,
}: {
  params: Promise<{ categoria: string }>;
}) {
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

  const resolvedParams = await params;
  const category = normalizeCategory(decodeURIComponent(resolvedParams.categoria || ""));

  if (!category) {
    redirect("/alumnos/inicio");
  }

  return (
    <AlumnoVisionClient
      currentEmail={String(session.user.email || "")}
      currentName={String(session.user.name || "")}
      initialCategory={category}
    />
  );
}
