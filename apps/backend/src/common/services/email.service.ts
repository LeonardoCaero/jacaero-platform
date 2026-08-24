import { Resend } from "resend";
import { env } from "../../config/env.js";
import { logger } from "./logger.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

// Base64-embedded so the logo needs no image hosting; PNG (not inline <svg>) because most
// email clients strip <svg> from HTML emails. Regenerate from the source logo file if it ever changes.
const LOGO_BASE64 =
  "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";

export type Lang = "en" | "es";

const FOOTER: Record<Lang, string> = {
  es: "J.A. Caero &middot; este correo se envió automáticamente, no respondas a esta dirección.",
  en: "J.A. Caero &middot; this email was sent automatically, please don't reply to this address.",
};

// Real emails reference the logo as a CID attachment (see sendInvitationEmail) — most clients
// (Gmail, Outlook) silently strip data: URIs from HTML emails. The web preview has no attachment
// pipeline, so it embeds the image directly as a data: URI, which browsers render fine.
function layout(preheader: string, bodyHtml: string, logoSrc: string, lang: Lang) {
  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#fafafa;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 0;text-align:center;">
                <img src="${logoSrc}" width="56" height="56" alt="J.A. Caero" style="display:inline-block;" />
                <div style="margin-top:8px;font-size:20px;font-weight:600;letter-spacing:0.04em;color:#111113;">J.A. Caero</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;color:#111113;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
          </table>
          <p style="max-width:480px;margin:16px 0 0;color:#6b7280;font-size:12px;">
            ${FOOTER[lang]}
          </p>
        </td>
      </tr>
    </table>
  `;
}

function button(url: string, label: string) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="border-radius:10px;background:#111113;">
          <a href="${url}" style="display:inline-block;padding:12px 24px;color:#fafafa;font-size:14px;font-weight:600;text-decoration:none;">${label}</a>
        </td>
      </tr>
    </table>
  `;
}

const INVITATION_COPY: Record<
  Lang,
  { subject: string; preheader: (role: string) => string; greeting: string; body: (role: string) => string; button: string; expiry: (days: number) => string }
> = {
  es: {
    subject: "Invitación a J.A. Caero",
    preheader: (role) => `Te han invitado a unirte a J.A. Caero como ${role}.`,
    greeting: "Hola,",
    body: (role) => `Te han invitado a unirte a la plataforma de <strong>J.A. Caero</strong> como <strong>${role}</strong>.`,
    button: "Activar mi cuenta",
    expiry: (days) => `Este enlace caduca en ${days} días. Si no esperabas esta invitación, puedes ignorar este correo.`,
  },
  en: {
    subject: "Invitation to J.A. Caero",
    preheader: (role) => `You've been invited to join J.A. Caero as ${role}.`,
    greeting: "Hi,",
    body: (role) => `You've been invited to join the <strong>J.A. Caero</strong> platform as <strong>${role}</strong>.`,
    button: "Activate my account",
    expiry: (days) => `This link expires in ${days} days. If you weren't expecting this invitation, you can ignore this email.`,
  },
};

export function buildInvitationEmail(inviteUrl: string, roleName: string, lang: Lang = "es", forWebPreview = false) {
  const copy = INVITATION_COPY[lang];
  const html = layout(
    copy.preheader(roleName),
    `
      <p style="margin:0 0 4px;">${copy.greeting}</p>
      <p style="margin:0;">${copy.body(roleName)}</p>
      ${button(inviteUrl, copy.button)}
      <p style="margin:0;color:#6b7280;font-size:13px;">${copy.expiry(env.INVITATION_EXPIRES_IN_DAYS)}</p>
    `,
    forWebPreview ? `data:image/png;base64,${LOGO_BASE64}` : "cid:logo",
    lang,
  );

  return { subject: copy.subject, html };
}

export async function sendInvitationEmail(to: string, inviteUrl: string, roleName: string, lang: Lang = "es") {
  const { subject, html } = buildInvitationEmail(inviteUrl, roleName, lang);

  if (!resend) {
    logger.info(`[email] RESEND_API_KEY not set — invitation link for ${to}: ${inviteUrl}`);
    return;
  }

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    attachments: [{ filename: "logo.png", content: LOGO_BASE64, contentType: "image/png", contentId: "logo" }],
  });
}
