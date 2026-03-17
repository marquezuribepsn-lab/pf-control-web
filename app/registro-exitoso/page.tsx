export default function RegistroExitosoPage() {
  return (
    <main className="mx-auto max-w-2xl p-6 text-center">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-green-600">¡Registro exitoso!</h1>
        <p className="text-lg text-neutral-600 mt-4">
          Gracias por registrarte. Tu perfil ha sido creado correctamente.
        </p>
        <p className="text-sm text-neutral-500 mt-2">
          El entrenador revisará tu información y se pondrá en contacto contigo pronto.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-neutral-700">
          Si tienes alguna pregunta, puedes contactar al entrenador directamente.
        </p>
      </div>
    </main>
  );
}