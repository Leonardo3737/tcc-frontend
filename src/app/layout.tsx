import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';
import { QueryProvider } from '@/providers/query-provider';
import { ToastProvider } from '@/components/ui/toast';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--fonte-inter',
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
  themeColor: '#1d4ed8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className={inter.className}>
        <QueryProvider>
          {children}
          <ToastProvider />
        </QueryProvider>
      </body>
    </html>
  );
}
