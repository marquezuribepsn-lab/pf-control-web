import {
  sendAdminAlumnoRegisteredEmail,
  sendColaboradorCredentials,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../lib/email";

function targetMailbox() {
  return (
    process.env.SMOKE_MAIN_EMAIL ||
    process.env.SMOKE_MAILBOX_BASE ||
    process.env.BREVO_SENDER_EMAIL ||
    process.env.MAIL_FROM ||
    ""
  ).trim();
}

async function main() {
  const to = targetMailbox();

  if (!to) {
    throw new Error(
      "No se encontro mailbox de destino. Configura SMOKE_MAIN_EMAIL o SMOKE_MAILBOX_BASE."
    );
  }

  const stamp = new Date().toISOString().slice(0, 19).replace("T", " ");

  await sendVerificationEmail(to, `preview-verify-${Date.now()}`);
  await sendPasswordResetEmail(to, `preview-reset-${Date.now()}`);
  await sendColaboradorCredentials(to, "Preview123!", "Colaborador Preview");
  await sendColaboradorCredentials(to, "BAJA", "Colaborador Preview");
  await sendAdminAlumnoRegisteredEmail({
    nombre: "Alumno Preview",
    estado: "activo",
    fechaNacimiento: "2000-01-01",
    altura: "175",
    peso: "70",
    club: "Club Preview",
    objetivo: "Mejorar rendimiento",
    observaciones: `Envio de prueba ${stamp}`,
    practicaDeporte: false,
  });

  console.log(`Envios completados a ${to}`);
}

main().catch((error) => {
  console.error("Fallo el envio de previews:", error);
  process.exit(1);
});
