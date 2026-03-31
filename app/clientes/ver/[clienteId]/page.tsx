import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    clienteId: string;
  }>;
};

export default async function ClienteDetalleRedirectPage({ params }: PageProps) {
  const { clienteId } = await params;
  let normalizedClienteId = clienteId || "";
  try {
    normalizedClienteId = decodeURIComponent(normalizedClienteId);
  } catch {
    // keep raw value if it is not URI-encoded
  }
  const encoded = encodeURIComponent(normalizedClienteId);
  redirect(`/clientes?detalle=1&cliente=${encoded}&tab=datos`);
}
