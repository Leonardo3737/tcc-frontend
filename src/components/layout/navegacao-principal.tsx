'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { GRUPOS_NAVEGACAO, estaAtivo, itensVisiveis } from '@/config/navegacao';
import { useSessao } from '@/providers/sessao-provider';

/**
 * Lista de links do menu, compartilhada entre a sidebar (desktop) e a gaveta
 * (mobile). Um componente so evita que os dois menus divirjam com o tempo.
 *
 * Itens em grupos com rotulo discreto: com poucos itens, a lista solta parecia
 * perdida no alto da coluna; agrupada, ela le como indice do sistema.
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
    <nav aria-label="Navegação principal" className="space-y-5">
      {GRUPOS_NAVEGACAO.map((grupo) => {
        const doGrupo = itens.filter((item) => item.grupo === grupo.chave);
        if (doGrupo.length === 0) return null;

        const idRotulo = `grupo-nav-${grupo.chave}`;

        return (
          <div key={grupo.chave} className="space-y-1">
            {grupo.rotulo && (
              <p
                id={idRotulo}
                className={cn(
                  'px-3 pb-1 text-xs font-semibold uppercase tracking-[0.08em]',
                  sobreEscuro ? 'text-white/60' : 'text-texto-suave',
                )}
              >
                {grupo.rotulo}
              </p>
            )}

            <ul className="space-y-0.5" aria-labelledby={grupo.rotulo ? idRotulo : undefined}>
              {doGrupo.map((item) => {
                const ativo = estaAtivo(item, caminho);
                const Icone = item.icone;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={aoNavegar}
                      // aria-current e o que permite ao leitor de tela saber onde o
                      // usuario esta; a cor sozinha nao comunica isso.
                      aria-current={ativo ? 'page' : undefined}
                      className={cn(
                        'alvo-toque relative flex h-10 items-center gap-3 rounded-md px-3 text-[0.9375rem] font-semibold transition-colors duration-150',
                        sobreEscuro
                          ? ativo
                            ? 'bg-white/[0.12] text-white'
                            : 'text-white/80 hover:bg-white/[0.07] hover:text-white'
                          : ativo
                            ? 'bg-primaria-suave text-primaria'
                            : 'text-texto-suave hover:bg-fundo-suave hover:text-texto',
                        // Marca do item atual em acento: a posicao e legivel sem
                        // depender so do fundo levemente mais claro.
                        ativo &&
                          "before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-acento before:content-['']",
                        sobreEscuro &&
                          'focus-visible:ring-white focus-visible:ring-offset-primaria-forte',
                      )}
                    >
                      <Icone className="h-[1.125rem] w-[1.125rem] shrink-0" aria-hidden />
                      {item.rotulo}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
