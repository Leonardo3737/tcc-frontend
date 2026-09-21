import type { Config } from 'tailwindcss';

/**
 * As cores sao declaradas como variaveis CSS (globals.css) e referenciadas aqui
 * com <alpha-value>. Isso permite que `bg-superficie/50` funcione e que o tema
 * mude trocando as variaveis, sem recompilar utilitarios.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fundo: 'rgb(var(--cor-fundo) / <alpha-value>)',
        superficie: 'rgb(var(--cor-superficie) / <alpha-value>)',
        borda: 'rgb(var(--cor-borda) / <alpha-value>)',
        texto: 'rgb(var(--cor-texto) / <alpha-value>)',
        'texto-suave': 'rgb(var(--cor-texto-suave) / <alpha-value>)',
        primaria: {
          DEFAULT: 'rgb(var(--cor-primaria) / <alpha-value>)',
          suave: 'rgb(var(--cor-primaria-suave) / <alpha-value>)',
          contraste: 'rgb(var(--cor-primaria-contraste) / <alpha-value>)',
        },
        sucesso: 'rgb(var(--cor-sucesso) / <alpha-value>)',
        alerta: 'rgb(var(--cor-alerta) / <alpha-value>)',
        perigo: 'rgb(var(--cor-perigo) / <alpha-value>)',
        info: 'rgb(var(--cor-info) / <alpha-value>)',
      },
      borderRadius: {
        card: '0.75rem',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'zoom-in': {
          from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.97)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'zoom-in': 'zoom-in 150ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
