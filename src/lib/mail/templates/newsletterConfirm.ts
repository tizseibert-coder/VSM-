// Die Bestaetigungsmail des Newsletter-Doppel-Opt-in.
//
// Erstes und bislang einziges Template — siehe lib/mail/send.ts fuer den
// allgemeinen Versandweg, den jedes weitere Template genauso benutzt.

import { getTranslations } from 'next-intl/server'
import { mailButton, renderMailLayout } from '../layout'

export type NewsletterConfirmMail = {
  subject: string
  html: string
  text: string
}

/**
 * Baut Betreff, HTML und Text der Bestaetigungsmail in der Sprache des
 * Interessenten.
 *
 * `confirmUrl` traegt den rohen Token (siehe lib/crm/newsletter.ts, warum nur
 * sein Hash in der Datenbank steht) — diese Funktion selbst weiss nichts von
 * Token oder Datenbank, nur vom fertigen Link.
 */
export async function newsletterConfirmMail(
  locale: string,
  confirmUrl: string
): Promise<NewsletterConfirmMail> {
  const t = await getTranslations({ locale, namespace: 'Mail' })

  const subject = t('newsletterConfirmSubject')
  const title = t('newsletterConfirmTitle')
  const intro = t('newsletterConfirmBody')
  const button = t('newsletterConfirmButton')
  const footer = t('newsletterConfirmFooter')

  const html = renderMailLayout({
    title: subject,
    bodyHtml: `
      <p style="margin:0 0 4px;font-size:18px;font-weight:600;">${title}</p>
      <p style="margin:16px 0 0;">${intro}</p>
      ${mailButton(confirmUrl, button)}
      <p style="margin:24px 0 0;color:#71717a;font-size:12px;line-height:1.6;">${footer}</p>
    `,
  })

  const text = `${title}\n\n${intro}\n\n${confirmUrl}\n\n${footer}`

  return { subject, html, text }
}
