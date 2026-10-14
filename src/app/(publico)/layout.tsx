import { Marca } from '@/components/layout/marca';
import { rotas } from '@/config/rotas';

/**
 * Layout da tela publica (login). Nao ha auto-cadastro: contas sao criadas
 * por professores, dentro do sistema.
 *
 * Deliberadamente sem navegacao: quem nao autenticou nao tem para onde ir dentro
 * do sistema, e um menu com links que redirecionam para o login so gera atrito.
 *
 * A LARGURA e decidida pela pagina, nao aqui: o login usa duas colunas em
 * telas grandes (apresentacao + formulario).
 */
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <header className="flex h-16 shrink-0 items-center px-4 sm:px-6">
        <Marca href={rotas.login} />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-6 lg:py-8">{children}</main>

      <footer className="shrink-0 px-4 py-5 text-center text-xs text-texto-suave">
        Plataforma Digital para Apoio à Monitoria no Ensino Superior
      </footer>
    </div>
  );
}
