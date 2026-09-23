import { Marca } from '@/components/layout/marca';
import { rotas } from '@/config/rotas';

/**
 * Layout das telas publicas (login e cadastro).
 *
 * Deliberadamente sem navegacao: quem nao autenticou nao tem para onde ir dentro
 * do sistema, e um menu com links que redirecionam para o login so gera atrito.
 */
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <header className="flex h-16 items-center px-4 sm:px-6">
        <Marca href={rotas.login} />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="px-4 py-6 text-center text-xs text-texto-suave">
        Plataforma Digital para Apoio à Monitoria no Ensino Superior
      </footer>
    </div>
  );
}
