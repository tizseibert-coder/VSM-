import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Die Vorlage haengt den Produktnamen an jede Unterseite an, damit ein
  // Browser-Tab oder ein geteilter Link erkennbar bleibt, wenn er neben
  // zwanzig anderen steht.
  title: {
    default: "VSM Builder — Wertstromanalyse mit Live-Berechnung",
    template: "%s · VSM Builder",
  },
  description:
    "Wertstromdiagramme nach Rother/Shook zeichnen, Durchlaufzeit, Taktzeit und Wertschoepfungsanteil live berechnen, Future-State-Szenarien gegeneinander rechnen.",
  applicationName: "VSM Builder",
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "VSM Builder",
    title: "VSM Builder — Wertstromanalyse mit Live-Berechnung",
    description:
      "Wertstromdiagramme nach Rother/Shook zeichnen, Kennzahlen live berechnen, Future-State-Szenarien vergleichen.",
  },
  // Das Bild selbst liefert `app/opengraph-image.tsx` ueber die
  // Dateikonvention. X/Twitter greift auf dasselbe Bild zurueck, braucht
  // dafuer aber die Kartenart — ohne sie bleibt der Link auch dort eine
  // Textzeile.
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Das Produkt ist durchgaengig deutsch. `lang="en"` aus der Vorlage
    // brachte falsche Silbentrennung, die falsche Vorlesestimme bei
    // Screenreadern und ein Signal gegen uns in der Suche.
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* `font-sans` ist die einzige Stelle, an der die Schriftfamilie gesetzt
          wird — der Canvas liest sie zur Laufzeit von hier ab. */}
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
