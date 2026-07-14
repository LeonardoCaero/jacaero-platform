import { Resend } from "resend";
import { env } from "../../config/env.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendInvitationEmail(to: string, inviteUrl: string, roleName: string) {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — invitation link for ${to}: ${inviteUrl}`);
    return;
  }

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Invitación a J.A. Caero",
    html: `
      <p>Te han invitado a unirte a la plataforma de J.A. Caero como <strong>${roleName}</strong>.</p>
      <p><a href="${inviteUrl}">Activa tu cuenta aquí</a></p>
      <p>Este enlace caduca en ${env.INVITATION_EXPIRES_IN_DAYS} días.</p>
    `,
  });
}
