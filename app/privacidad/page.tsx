import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad — PF Control",
  description:
    "Cómo PF Control recopila, usa, almacena y protege tus datos personales, y cómo podés ejercer tus derechos, incluido el borrado de tu cuenta.",
};

const LAST_UPDATED = "16 de junio de 2026";
const CONTACT_EMAIL = "soporte@pf-control.com";

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-slate-800">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-slate-900">Política de Privacidad</h1>
        <p className="mt-2 text-sm text-slate-500">Última actualización: {LAST_UPDATED}</p>
        <p className="mt-4 text-base leading-relaxed text-slate-700">
          Esta política describe cómo <strong>PF Control</strong> (&ldquo;la aplicación&rdquo;, &ldquo;nosotros&rdquo;)
          recopila, utiliza, almacena y protege tu información personal cuando usás la
          plataforma a través de la web o de la aplicación móvil. Al usar PF Control aceptás
          las prácticas descritas en este documento.
        </p>
      </header>

      <Section title="1. Información que recopilamos">
        <p>Recopilamos únicamente los datos necesarios para que la plataforma funcione:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li><strong>Datos de cuenta:</strong> nombre completo, email y contraseña (almacenada de forma cifrada).</li>
          <li><strong>Datos de contacto:</strong> número de teléfono (opcional, usado para avisos por WhatsApp).</li>
          <li><strong>Datos físicos y deportivos:</strong> edad, fecha de nacimiento, altura, peso, rutinas de entrenamiento, planes nutricionales, check-ins y progreso, cuando vos o tu entrenador los cargan.</li>
          <li><strong>Datos de uso:</strong> fechas de inicio de sesión y actividad básica para el funcionamiento del servicio.</li>
        </ul>
      </Section>

      <Section title="2. Cómo usamos tu información">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Brindar y mantener el servicio de seguimiento de entrenamiento y nutrición.</li>
          <li>Permitir que tu entrenador gestione tus planes y tu progreso.</li>
          <li>Enviarte avisos y recordatorios por email o WhatsApp (por ejemplo, el check-in semanal).</li>
          <li>Gestionar pagos de suscripción cuando corresponda.</li>
          <li>Verificar tu identidad y proteger la seguridad de tu cuenta.</li>
        </ul>
        <p className="mt-3">No vendemos ni alquilamos tus datos personales a terceros.</p>
      </Section>

      <Section title="3. Terceros con los que compartimos datos">
        <p>Solo compartimos datos con proveedores necesarios para operar el servicio:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li><strong>MercadoPago:</strong> para procesar pagos de suscripción (cuando aplica).</li>
          <li><strong>WhatsApp / proveedor de email:</strong> para enviarte notificaciones y recordatorios.</li>
        </ul>
        <p className="mt-3">Estos proveedores solo reciben la información mínima necesaria para cumplir su función.</p>
      </Section>

      <Section title="4. Almacenamiento y seguridad">
        <p>
          Tus datos se almacenan en servidores seguros. Las contraseñas se guardan cifradas
          (hash) y nunca en texto plano. Aplicamos medidas técnicas y organizativas razonables
          para proteger tu información frente a accesos no autorizados.
        </p>
      </Section>

      <Section title="5. Tus derechos">
        <p>En cualquier momento podés:</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>Acceder y actualizar tus datos personales desde la sección <strong>Cuenta</strong>.</li>
          <li><strong>Eliminar tu cuenta</strong> y todos los datos asociados desde <strong>Cuenta → Eliminar cuenta</strong>, o escribiéndonos a {CONTACT_EMAIL}.</li>
          <li>Solicitar una copia de tus datos.</li>
        </ul>
        <p className="mt-3">
          La eliminación de la cuenta borra de forma permanente tu usuario y los datos
          vinculados a él (asignaciones, etiquetas, tokens y suscripción). Esta acción no se
          puede deshacer.
        </p>
      </Section>

      <Section title="6. Retención de datos">
        <p>
          Conservamos tus datos mientras tu cuenta esté activa. Cuando eliminás tu cuenta,
          los datos personales asociados se borran de forma permanente, salvo aquellos que
          debamos conservar por obligaciones legales o contables.
        </p>
      </Section>

      <Section title="7. Menores de edad">
        <p>
          PF Control está pensado para mayores de 16 años. Si un menor usa la plataforma, debe
          hacerlo con el consentimiento y supervisión de su entrenador o tutor responsable.
        </p>
      </Section>

      <Section title="8. Cambios en esta política">
        <p>
          Podemos actualizar esta política ocasionalmente. Publicaremos la versión vigente en
          esta página con su fecha de última actualización.
        </p>
      </Section>

      <Section title="9. Contacto">
        <p>
          Si tenés preguntas sobre esta política o sobre tus datos, escribinos a{" "}
          <a className="font-semibold text-emerald-700 underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="mb-2 text-xl font-bold text-slate-900">{title}</h2>
      <div className="text-base leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}
