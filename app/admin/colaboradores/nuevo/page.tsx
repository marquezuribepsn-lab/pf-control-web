import { redirect } from "next/navigation";

export default function NuevoColaboradorPage() {
  redirect("/admin/usuarios?panel=colaboradores&create=1");
}
