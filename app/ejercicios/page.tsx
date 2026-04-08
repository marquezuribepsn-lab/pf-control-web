import { redirect } from "next/navigation";

export default function EjerciciosPage() {
  redirect("/sesiones?seccion=ejercicios");
}
