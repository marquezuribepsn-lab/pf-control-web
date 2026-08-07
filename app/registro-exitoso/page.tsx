export default function RegistroExitosoPage() {
  return (
    <main className="mx-auto max-w-2xl p-6 text-center">
      <div className="mb-6">
        <h1 className="text-3xl font-bold pf-v2-t-ok">¡Registro exitoso!</h1>
        <p className="text-lg pf-v2-t-40 mt-4">
          Gracias por registrarte. Tu perfil ha sido creado correctamente.
        </p>
        <p className="text-sm pf-v2-t-40 mt-2">
          El entrenador revisará tu información y se pondrá en contacto contigo pronto.
        </p>
      </div>

      <div className="rounded-2xl pf-v2-s-hi p-6 shadow-sm">
        <p className="pf-v2-t">
          Si tienes alguna pregunta, puedes contactar al entrenador directamente.
        </p>
      </div>
    </main>
  );
}