import { redirect } from "next/navigation";

export default function ColaboradoresPage() {
  redirect("/admin/usuarios?panel=colaboradores");
}
