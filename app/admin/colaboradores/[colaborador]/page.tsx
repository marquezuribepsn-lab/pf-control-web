import { redirect } from "next/navigation";

export default async function ColaboradorDetallePage({
  params,
}: {
  params: Promise<{ colaborador: string }>;
}) {
  const resolvedParams = await params;
  const colaboradorId = encodeURIComponent(String(resolvedParams.colaborador || "").trim());
  redirect(`/admin/usuarios?panel=colaboradores&colaborador=${colaboradorId}`);
}
