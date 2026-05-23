import { Resend } from 'resend';

const FROM = process.env.EMAIL_FROM ?? 'Zeus Fisioterapia <noreply@zeus.es>';

interface CancellationRequestEmailParams {
    to: string;
    patientName: string;
    appointmentDate: string;
    serviceName: string;
    professionalName: string;
    confirmLink: string;
}

export async function sendCancellationRequestEmail({
    to,
    patientName,
    appointmentDate,
    serviceName,
    professionalName,
    confirmLink,
}: CancellationRequestEmailParams): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
        console.log('[email:dev] Cancellation email skipped (no RESEND_API_KEY). to:', to);
        return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirma la cancelación de tu cita</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a1a;padding:28px 40px;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Zeus Fisioterapia</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#6b6b6b;">Hola, <strong style="color:#1a1a1a;">${escapeHtml(patientName)}</strong></p>
              <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;line-height:1.3;">
                Solicitud de cancelación de cita
              </h1>

              <!-- Appointment summary card -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="background:#f9f8f5;border:1px solid #ebebeb;border-radius:8px;margin-bottom:32px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#9b9b9b;">Cita</p>
                    <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#1a1a1a;">${escapeHtml(serviceName)}</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#4a4a4a;">${escapeHtml(appointmentDate)}</p>
                    <p style="margin:0;font-size:14px;color:#4a4a4a;">Con <strong>${escapeHtml(professionalName)}</strong></p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4a4a4a;">
                Hemos recibido tu solicitud para cancelar esta cita. Para confirmar la cancelación,
                haz clic en el botón de abajo. <strong>Este enlace caduca en 24 horas.</strong>
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
                <tr>
                  <td style="border-radius:8px;background:#1a1a1a;">
                    <a href="${confirmLink}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;
                              color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                      Confirmar cancelación
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#9b9b9b;line-height:1.5;">
                Si no solicitaste esta cancelación, ignora este mensaje. Tu cita permanecerá activa.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #ebebeb;">
              <p style="margin:0;font-size:12px;color:#b0b0b0;line-height:1.5;">
                Zeus Fisioterapia &mdash; Este es un mensaje automático, no respondas a este correo.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await resend.emails.send({
        from: FROM,
        to,
        subject: 'Confirma la cancelación de tu cita',
        html,
    });
}

interface ProfessionalWelcomeEmailParams {
    to: string;
    fullName: string;
    setupLink: string;
}

export async function sendProfessionalWelcomeEmail({
    to,
    fullName,
    setupLink,
}: ProfessionalWelcomeEmailParams): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
        console.log('[email:dev] Professional welcome email skipped (no RESEND_API_KEY). to:', to);
        return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido a Zeus Fisioterapia</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">
          <tr>
            <td style="background:#1a1a1a;padding:28px 40px;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Zeus Fisioterapia</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#6b6b6b;">Hola, <strong style="color:#1a1a1a;">${escapeHtml(fullName)}</strong></p>
              <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;line-height:1.3;">
                Bienvenido al equipo
              </h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4a4a4a;">
                Se ha creado tu cuenta como profesional en el panel de Zeus Fisioterapia.
                Para acceder, primero establece tu contraseña con el botón de abajo.
                <strong>Este enlace caduca en 1 hora.</strong>
              </p>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
                <tr>
                  <td style="border-radius:8px;background:#1a1a1a;">
                    <a href="${setupLink}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;
                              color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                      Establecer contraseña
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#9b9b9b;line-height:1.5;">
                Si no esperabas este correo, ignóralo.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #ebebeb;">
              <p style="margin:0;font-size:12px;color:#b0b0b0;line-height:1.5;">
                Zeus Fisioterapia &mdash; Este es un mensaje automático, no respondas a este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await resend.emails.send({
        from: FROM,
        to,
        subject: 'Bienvenido al panel de Zeus Fisioterapia',
        html,
    });
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
