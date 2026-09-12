// Der HTML-Rahmen, den jede Mail dieser Anwendung bekommt.
//
// Bewusst schlicht und tabellenbasiert (kein Flexbox/Grid): Postfaecher wie
// Outlook rendern HTML-Mails mit einer eigenen, alten Engine, die modernes
// CSS grossteils ignoriert. Eine Mail, die im Browser gut aussieht und im
// Postfach zerfaellt, ist die teurere Wahl.
//
// Keine Organisationsfarbe wie bei der Einladungsseite (inviteBranding.ts):
// Das hier sind Systemmails von Taktane selbst (Bestaetigungslinks,
// spaeter vielleicht Passwort-Resets), nicht Post im Namen einer Organisation
// — sie sollen wie Taktane aussehen, nicht wie die Firma des Empfaengers.

import { DEFAULT_BRAND_COLOR } from '@/lib/org/branding'
import { SITE_NAME } from '@/lib/seo/site'

/** Reicht durch die HTML-Tags eines Textblocks, ohne echtes HTML einzulassen
 *  — Absenderfelder wie ein Name landen hier nie, aber sauber ist billiger
 *  als eine Annahme darueber, was garantiert sicher ist. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type MailLayoutInput = {
  /** Erscheint als Kopfzeile und als `<title>` fuer Postfaecher, die eine
   *  Vorschau daraus bauen. */
  title: string
  /** Fertiges HTML des Mailkoerpers (Absaetze, ein Knopf) — kein escapen
   *  mehr, das ist Sache des Aufrufers. */
  bodyHtml: string
}

/** Der fertige HTML-Umschlag um den Inhalt eines Templates. */
export function renderMailLayout({ title, bodyHtml }: MailLayoutInput): string {
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background-color:${DEFAULT_BRAND_COLOR};padding:20px 32px;">
                <span style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(SITE_NAME)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#18181b;font-size:14px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** Der Knopf, den jedes Bestaetigungs-Template braucht — eine Stelle statt
 *  wiederholtem Inline-CSS je Template. */
export function mailButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:24px;padding:12px 24px;background-color:${DEFAULT_BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>`
}

export { escapeHtml }
