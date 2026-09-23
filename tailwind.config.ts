import type { Config } from 'tailwindcss';

/**
 * As cores sao declaradas como variaveis CSS (globals.css) e referenciadas aqui
 * com <alpha-value>. Isso permite que `bg-superficie/50` funcione e que o tema
 * mude trocando as variaveis, sem recompilar utilitarios.
 */
const cor = (nome: string) => `rgb(var(--cor-${nome}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fundo: { DEFAULT: cor('fundo'), suave: cor('fundo-suave') },
        superficie: cor('superficie'),
        borda: { DEFAULT: cor('borda'), forte: cor('borda-forte') },
        texto: cor('texto'),
        'texto-suave': cor('texto-suave'),
        primaria: {
          DEFAULT: cor('primaria'),
          forte: cor('primaria-forte'),
          suave: cor('primaria-suave'),
          contraste: cor('primaria-contraste'),
        },
        acento: {
          DEFAULT: cor('acento'),
          forte: cor('acento-forte'),
          suave: cor('acento-suave'),
        },
        sucesso: { DEFAULT: cor('sucesso'), suave: cor('sucesso-suave') },
        alerta: {
          DEFAULT: cor('alerta'),
          preenchimento: cor('alerta-preenchimento'),
          suave: cor('alerta-suave'),
        },
        perigo: { DEFAULT: cor('perigo'), suave: cor('perigo-suave') },
        info: cor('info'),
        neutro: cor('neutro'),
        papel: {
          monitor: cor('papel-monitor'),
          'monitor-suave': cor('papel-monitor-suave'),
          monitorado: cor('papel-monitorado'),
          'monitorado-preenchimento': cor('papel-monitorado-preenchimento'),
          'monitorado-suave': cor('papel-monitorado-suave'),
          professor: cor('papel-professor'),
          'professor-suave': cor('papel-professor-suave'),
        },
        disciplina: Object.fromEntries(
          [0, 1, 2, 3, 4, 5, 6, 7].map((indice) => [indice, cor(`disciplina-${indice}`)]),
        ),
      },
      fontFamily: {
        // As variaveis vem do next/font em app/layout.tsx.
        sans: ['var(--fonte-texto)', 'system-ui', 'sans-serif'],
        titulo: ['var(--fonte-titulo)', 'var(--fonte-texto)', 'system-ui', 'sans-serif'],
      },
      /**
       * Escala tipografica.
       *
       * `xs`/`sm`/`base` foram reajustados para a Source Sans 3, que tem altura-x
       * menor que a Inter: nos mesmos 14px ela parece um corpo menor. Ajustar a
       * escala aqui evita reescrever `text-sm` em cada componente.
       *
       * Os nomes semanticos (`titulo-pagina`, `titulo-secao`…) sao a escala
       * aplicada nos componentes de layout; as telas nao escolhem tamanho de
       * titulo a olho.
       */
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.125rem' }], // 13px — legenda
        sm: ['0.9375rem', { lineHeight: '1.375rem' }], // 15px — corpo
        base: ['1rem', { lineHeight: '1.5rem' }],
        legenda: ['0.8125rem', { lineHeight: '1.125rem' }],
        'titulo-cartao': ['1rem', { lineHeight: '1.375rem', fontWeight: '600' }],
        'titulo-secao': ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        'titulo-pagina': [
          '1.625rem',
          { lineHeight: '2rem', fontWeight: '650', letterSpacing: '-0.015em' },
        ],
        destaque: ['2rem', { lineHeight: '2.25rem', fontWeight: '600', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        card: '0.625rem',
      },
      boxShadow: {
        // Sombra so para o que flutua (dialogo, menu). Cartao nao flutua.
        flutuante: '0 12px 32px -8px rgb(33 29 24 / 0.18), 0 2px 6px rgb(33 29 24 / 0.06)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'zoom-in': {
          from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.97)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        'surgir-baixo': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'zoom-in': 'zoom-in 180ms cubic-bezier(0.2, 0.9, 0.3, 1)',
        'surgir-baixo': 'surgir-baixo 180ms ease-out',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
};

export default config;
