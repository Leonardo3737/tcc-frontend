'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { GraduationCap, Menu, X } from 'lucide-react';

import { NavegacaoPrincipal } from './navegacao-principal';
import { MenuUsuario } from './menu-usuario';
import { Button } from '@/components/ui/button';
import { rotas } from '@/config/rotas';

/**
 * Casca da area autenticada.
 *
 * Sidebar fixa a partir de `lg`; abaixo disso vira gaveta lateral. A gaveta e
 * escrita a mao (e nao com Radix Dialog) porque aqui ela e navegacao, nao
 * dialogo modal: prender o foco dentro dela atrapalharia mais do que ajudaria.
 * O essencial de acessibilidade — Escape para fechar, `aria-expanded`,
 * `aria-controls` e travar o scroll do fundo — esta implementado.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const caminho = usePathname();

  // Navegar fecha a gaveta: sem isto, no celular a pessoa clica num link e
  // continua olhando para o menu, sem perceber que a pagina mudou atras.
  useEffect(() => {
    setGavetaAberta(false);
  }, [caminho]);

  useEffect(() => {
    if (!gavetaAberta) return;

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setGavetaAberta(false);
    };

    document.addEventListener('keydown', aoTeclar);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = '';
    };
  }, [gavetaAberta]);

  return (
    <div className="min-h-dvh bg-fundo">
      {/* Atalho para quem navega por teclado pular o menu repetido. */}
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primaria focus:px-4 focus:py-2 focus:text-primaria-contraste"
      >
        Pular para o conteúdo
      </a>

      {/* ---------------- Sidebar (lg+) ---------------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-borda bg-superficie lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-borda px-4">
          <Marca />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavegacaoPrincipal />
        </div>
      </aside>

      {/* ---------------- Gaveta (< lg) ---------------- */}
      {gavetaAberta && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-texto/40 animate-fade-in"
            onClick={() => setGavetaAberta(false)}
            aria-hidden
          />

          <div
            id="gaveta-navegacao"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-borda bg-superficie shadow-xl"
          >
            <div className="flex h-14 items-center justify-between border-b border-borda px-4">
              <Marca />
              <Button
                variante="fantasma"
                tamanho="icone"
                onClick={() => setGavetaAberta(false)}
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" aria-hidden />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <NavegacaoPrincipal aoNavegar={() => setGavetaAberta(false)} />
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Conteudo ---------------- */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-borda bg-superficie/95 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <Button
              variante="fantasma"
              tamanho="icone"
              className="lg:hidden"
              onClick={() => setGavetaAberta(true)}
              aria-label="Abrir menu"
              aria-expanded={gavetaAberta}
              aria-controls="gaveta-navegacao"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </Button>

            <span className="lg:hidden">
              <Marca compacta />
            </span>
          </div>

          <MenuUsuario />
        </header>

        <main id="conteudo-principal" className="mx-auto w-full max-w-6xl p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <Link href={rotas.inicio} className="flex items-center gap-2 font-semibold text-texto">
      <GraduationCap className="h-5 w-5 text-primaria" aria-hidden />
      {!compacta && <span className="text-sm">Monitoria</span>}
    </Link>
  );
}
