export default function RegistroExitosoPage() {
  return (
    <main className="mx-auto max-w-2xl px-3 py-4 text-center sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-green-600 sm:text-3xl">¡Registro exitoso!</h1>
        <p className="mt-4 text-base text-neutral-600 sm:text-lg">
          Gracias por registrarte. Tu perfil ha sido creado correctamente.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          El entrenador revisará tu información y se pondrá en contacto contigo pronto.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <p className="text-neutral-700">
          Si tienes alguna pregunta, puedes contactar al entrenador directamente.
        </p>
      </div>
    </main>
  );
}