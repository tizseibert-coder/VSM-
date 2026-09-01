import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return {
    // Die Vorlage haengt den Produktnamen an jede Unterseite an, damit ein
    // Browser-Tab oder ein geteilter Link erkennbar bleibt, wenn er neben
    // zwanzig anderen steht.
    title: {
      default: t("title"),
      template: "%s · VSM Builder",
    },
    description: t("description"),
    applicationName: "VSM Builder",
    openGraph: {
      type: "website",
      locale: t("ogLocale"),
      siteName: "VSM Builder",
      title: t("ogTitle"),
      description: t("ogDescription"),
    },
    // Das Bild selbst liefert `app/opengraph-image.tsx` ueber die
    // Dateikonvention. X/Twitter greift auf dasselbe Bild zurueck, braucht
    // dafuer aber die Kartenart — ohne sie bleibt der Link auch dort eine
    // Textzeile.
    twitter: {
      card: "summary_large_image",
    },
  };
}

// Beide Sprachen statisch vorrendern, statt bei jeder Anfrage neu zu
// entscheiden — next-intl empfiehlt das fuer den [locale]-Root-Layout.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  // Das [locale]-Segment wirkt wie ein Catch-all fuer unbekannte Pfade
  // (z. B. /irgendwas.txt) — ein ungueltiger Wert landet hier als 404
  // statt eine falsche Sprache stillschweigend zu rendern.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    // `lang` folgt jetzt der erkannten/gewaehlten Sprache statt fest auf
    // "de" zu stehen — sonst waere die englische Fassung fuer
    // Screenreader weiterhin als Deutsch ausgezeichnet.
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* `font-sans` ist die einzige Stelle, an der die Schriftfamilie gesetzt
          wird — der Canvas liest sie zur Laufzeit von hier ab. */}
      <body className="min-h-full flex flex-col font-sans">
        <NextIntlClientProvider>
          {children}
          <LocaleSwitcher />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
