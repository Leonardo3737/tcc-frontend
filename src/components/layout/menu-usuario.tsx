'use client';

import Link from 'next/link';
import { ChevronDown, ChevronsUpDown, UserRound } from 'lucide-react';

import {
  Dropdown,
  DropdownConteudo,
  DropdownItem,
  DropdownRotulo,
  DropdownSeparador,
  DropdownTrigger,
} from '@/components/ui/dropdown';
import { Badge } from '@/components/ui/badge';
import { BotaoSair } from '@/features/auth/components/botao-sair';
import { useSessao } from '@/providers/sessao-provider';
import { cn, iniciais } from '@/lib/utils';
import { rotas } from '@/config/rotas';

/**
 * Menu da conta.
 *
 * `lateral`: bloco no rodape da sidebar (desktop), com nome e perfil a vista —
 * a pessoa sabe com que conta esta sem abrir nada. `cabecalho`: so o avatar,
 * na barra do celular, onde o espaco e curto.
 */
export function MenuUsuario({ variante = 'cabecalho' }: { variante?: 'cabecalho' | 'lateral' }) {
  const { usuario } = useSessao();
  const lateral = variante === 'lateral';

  const perfis = usuario.perfis
    .map((perfil) => (perfil === 'PROFESSOR' ? 'Professor' : 'Aluno'))
    .join(' e ');

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        {lateral ? (
          <button
            type="button"
            className="alvo-toque flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-white/[0.07] focus-visible:ring-white focus-visible:ring-offset-primaria-forte"
            aria-label={`Menu da conta de ${usuario.nome}`}
          >
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white"
            >
              {iniciais(usuario.nome)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">
                {usuario.nome}
              </span>
              <span className="block truncate text-xs text-white/70">{perfis}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className="alvo-toque flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-fundo-suave"
            aria-label={`Menu da conta de ${usuario.nome}`}
          >
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primaria text-xs font-semibold text-primaria-contraste"
            >
              {iniciais(usuario.nome)}
            </span>

            {/* O nome some no mobile; as iniciais bastam e liberam espaco. */}
            <span className="hidden max-w-36 truncate font-medium text-texto sm:block">
              {usuario.nome}
            </span>

            <ChevronDown className="hidden h-4 w-4 text-texto-suave sm:block" aria-hidden />
          </button>
        )}
      </DropdownTrigger>

      <DropdownConteudo
        side={lateral ? 'top' : 'bottom'}
        align={lateral ? 'start' : 'end'}
        className={cn(lateral && 'w-[14.5rem]')}
      >
        <DropdownRotulo>
          <span className="block truncate font-normal text-texto">{usuario.nome}</span>
          <span className="block truncate text-texto-suave">{usuario.email}</span>
        </DropdownRotulo>

        {/*
          Os perfis sao mostrados porque um mesmo usuario pode ser ALUNO e
          PROFESSOR — e o menu dele passa a ser a uniao das duas secoes. Sem essa
          indicacao, a mistura pareceria inconsistencia da aplicacao.

          MONITOR/MONITORADO nunca aparecem aqui: sao papeis por monitoria, nao
          atributos da pessoa.
        */}
        <div className="flex flex-wrap gap-1 px-2.5 pb-2">
          {usuario.perfis.map((perfil) => (
            <Badge key={perfil} tom="neutro">
              {perfil === 'PROFESSOR' ? 'Professor' : 'Aluno'}
            </Badge>
          ))}
        </div>

        <DropdownSeparador />

        <DropdownItem asChild>
          <Link href={rotas.conta}>
            <UserRound className="h-4 w-4" aria-hidden />
            Minha conta
          </Link>
        </DropdownItem>

        <DropdownSeparador />

        <BotaoSair />
      </DropdownConteudo>
    </Dropdown>
  );
}
