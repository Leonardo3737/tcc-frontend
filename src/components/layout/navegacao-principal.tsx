'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { estaAtivo, itensVisiveis } from '@/config/navegacao';
import { useSessao } from '@/providers/sessao-provider';

/**
 * Lista de links do menu, compartilhada entre a sidebar (desktop) e a gaveta
 * (mobile). Um componente so evita que os dois menus divirjam com o tempo.
 */
export function NavegacaoPrincipal({ aoNavegar }: { aoNavegar?: () => void }) {
  const caminho = usePathname();
  const { usuario } = useSessao();

  const itens = itensVisiveis(usuario.perfis);

  return (
    <nav aria-label="Navegação principal" className="space-y-1">
      {itens.map((item) => {
        const ativo = estaAtivo(item, caminho);
        const Icone = item.icone;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={aoNavegar}
            // aria-current e o que permite ao leitor de tela saber onde o
            // usuario esta; a cor sozinha nao comunica isso.
            aria-current={ativo ? 'page' : undefined}
            className={cn(
              'alvo-toque flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              ativo
                ? 'bg-primaria-suave text-primaria'
                : 'text-texto-suave hover:bg-fundo hover:text-texto',
            )}
          >
            <Icone className="h-4 w-4 shrink-0" aria-hidden />
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
