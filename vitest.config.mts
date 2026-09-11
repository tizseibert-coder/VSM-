import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Diese Datei heisst `.mts` und nicht `.ts`, seit Vite bei jedem Lauf warnte:
// Sie benutzt ESM-Syntax, wurde aber als CommonJS geladen, und der native
// Lader soll in einer kuenftigen Hauptfassung die Vorgabe werden. Die
// Endung macht sie eindeutig zu ESM — womit `__dirname` wegfaellt, das es
// dort nicht gibt. `import.meta.dirname` ist das Gegenstueck (ab Node 20.11,
// hier laeuft 22).
const hier = import.meta.dirname

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
      '@': path.resolve(hier, 'src'),
      // next-intl importiert 'next/navigation' ohne Endung. Node loest das in
      // Nexts package.json ueber die Exportkarte auf, Vitest nicht — ohne
      // diese Zeile scheitert jeder Test an einer Datei, die (und sei es
      // mittelbar) @/i18n/navigation zieht, mit "Cannot find module".
      'next/navigation': path.resolve(hier, 'node_modules/next/navigation.js'),
    },
  },
})
