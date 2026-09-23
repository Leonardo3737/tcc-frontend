import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Source_Sans_3 } from 'next/font/google';

import './globals.css';
import { QueryProvider } from '@/providers/query-provider';
import { ToastProvider } from '@/components/ui/toast';

/**
 * Tipografia (AD-F12).
 *
 * Titulos em Bricolage Grotesque: grotesca com desenho proprio (terminais
 * irregulares, eixo de tamanho optico), que da identidade sem cair no
 * decorativo. Corpo em Source Sans 3: humanista, desenhada para interface,
 * com algarismos tabulares — horarios e vagas alinham em coluna. A Inter foi
 * descartada justamente por ser o padrao de quase todo template.
 */
const fonteTitulo = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--fonte-titulo',
});

const fonteTexto = Source_Sans_3({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--fonte-texto',
});

export const metadata: Metadata = {
  title: {
    default: 'Plataforma de Monitoria',
    template: '%s · Plataforma de Monitoria',
  },
  description: 'Plataforma digital para apoio à monitoria no ensino superior.',
  // A aplicacao e inteiramente autenticada: nao ha nada aqui para indexar.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Sem maximumScale: impedir o zoom quebra a acessibilidade de quem precisa
  // ampliar a tela para ler.
  themeColor: '#0f5e63',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fonteTitulo.variable} ${fonteTexto.variable}`}>
      <body>
        <QueryProvider>
          {children}
          <ToastProvider />
        </QueryProvider>
      </body>
    </html>
  );
}
