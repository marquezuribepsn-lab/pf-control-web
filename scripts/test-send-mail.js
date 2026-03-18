
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env.production') });
const nodemailer = require('nodemailer');

const transporter = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : process.env.MAILTRAP_HOST && process.env.MAILTRAP_USER && process.env.MAILTRAP_PASS
  ? nodemailer.createTransport({
      host: process.env.MAILTRAP_HOST,
      port: Number(process.env.MAILTRAP_PORT) || 587,
      secure: Number(process.env.MAILTRAP_PORT) === 465,
      auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS,
      },
    })
  : nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASSWORD,
      },
    });

async function sendMailTest() {
  try {
    if (process.env.BREVO_API_KEY && (process.env.BREVO_SENDER_EMAIL || process.env.MAIL_FROM)) {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: {
            email: process.env.BREVO_SENDER_EMAIL || process.env.MAIL_FROM,
            name: process.env.BREVO_SENDER_NAME || 'PF Control',
          },
          to: [{ email: 'marquezuribepsn@gmail.com' }],
          subject: 'Prueba email PF Control',
          htmlContent: '<h2>Envio funcionando</h2><p>Este es un correo de prueba desde PF Control.</p>',
        }),
      });

      if (!response.ok) {
        throw new Error(`Brevo API error: ${response.status} ${await response.text()}`);
      }
    } else {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.GMAIL_USER || 'test@pf-control.com',
        to: 'marquezuribepsn@gmail.com',
        subject: 'Prueba email PF Control',
        html: '<h2>Envio funcionando</h2><p>Este es un correo de prueba desde PF Control.</p>',
      });
    }

    console.log('Mail enviado correctamente');
  } catch (err) {
    console.error('Error al enviar mail:', err);
    process.exit(1);
  }
}

sendMailTest();