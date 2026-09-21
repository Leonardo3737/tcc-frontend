import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Vitest em vez de Jest: o projeto ja usa Vite/esbuild via Next, e o Vitest
 * entende `paths` do tsconfig e ESM sem configuracao extra de transformacao.
 *
 * `environment: 'jsdom'` cobre os testes de componente; a logica pura
 * (autorizacao, erros, fuso) roda igualmente bem nele.
 */
export default defineConfig({
  plugins: [react()],
  // Resolucao nativa dos `paths` do tsconfig — dispensa o plugin.
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // O alvo sao as regras, nao a renderizacao: componentes de apresentacao
      // pura entram indiretamente pelos testes de fluxo.
      include: ['src/lib/**', 'src/features/**/api/**', 'src/components/**'],
    },
  },
});
