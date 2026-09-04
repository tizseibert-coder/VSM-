import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  // Ohne diese Zeile scheitert jeder Test an einer Datei, die `@/…`
  // importiert: Der Pfad steht in tsconfig.json, und den liest Vitest nicht.
  // Bis hierher kam das nicht vor, weil alle Testkandidaten in lib/vsm
  // ausschliesslich relativ importieren.
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
