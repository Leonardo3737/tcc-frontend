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
export function NavegacaoPrincipal({
  aoNavegar,
  sobreEscuro = false,
}: {
  aoNavegar?: () => void;
  sobreEscuro?: boolean;
}) {
  const caminho = usePathname();
  const { usuario } = useSessao();

  const itens = itensVisiveis(usuario.perfis);

  return (
    <nav aria-label="Navegação principal" className="space-y-0.5">
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
              'alvo-toque relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-150',
              sobreEscuro
                ? ativo
                  ? 'bg-white/[0.12] text-white'
                  : 'text-white/80 hover:bg-white/[0.07] hover:text-white'
                : ativo
                  ? 'bg-primaria-suave text-primaria'
                  : 'text-texto-suave hover:bg-fundo-suave hover:text-texto',
              // Marca do item atual em acento: a posicao e legivel sem depender
              // so do fundo levemente mais claro.
              ativo &&
                "before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-acento before:content-['']",
              sobreEscuro && 'focus-visible:ring-white focus-visible:ring-offset-primaria-forte',
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
