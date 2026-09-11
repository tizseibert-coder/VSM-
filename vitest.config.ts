import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // next-intl liegt in node_modules und wuerde sonst an Vite vorbei vom
    // Node-Resolver geladen — dann greift der Aliasname unten nicht.
    server: { deps: { inline: ['next-intl'] } },
  },
  // Ohne diese Zeile scheitert jeder Test an einer Datei, die `@/…`
  // importiert: Der Pfad steht in tsconfig.json, und den liest Vitest nicht.
  // Bis hierher kam das nicht vor, weil alle Testkandidaten in lib/vsm
  // ausschliesslich relativ importieren.
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // next-intl importiert 'next/navigation' ohne Endung. Node loest das in
      // Nexts package.json ueber die Exportkarte auf, Vitest nicht — ohne
      // diese Zeile scheitert jeder Test an einer Datei, die (und sei es
      // mittelbar) @/i18n/navigation zieht, mit "Cannot find module".
      'next/navigation': path.resolve(__dirname, 'node_modules/next/navigation.js'),
    },
  },
})
