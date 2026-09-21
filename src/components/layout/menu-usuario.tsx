'use client';

import Link from 'next/link';
import { ChevronDown, UserRound } from 'lucide-react';

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
import { iniciais } from '@/lib/utils';
import { rotas } from '@/config/rotas';

export function MenuUsuario() {
  const { usuario } = useSessao();

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          className="alvo-toque flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-fundo"
          aria-label={`Menu da conta de ${usuario.nome}`}
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primaria-suave text-xs font-semibold text-primaria"
          >
            {iniciais(usuario.nome)}
          </span>

          {/* O nome some no mobile; as iniciais bastam e liberam espaco. */}
          <span className="hidden max-w-36 truncate font-medium text-texto sm:block">
            {usuario.nome}
          </span>

          <ChevronDown className="hidden h-4 w-4 text-texto-suave sm:block" aria-hidden />
        </button>
      </DropdownTrigger>

      <DropdownConteudo>
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
            <Badge key={perfil} tom={perfil === 'PROFESSOR' ? 'primaria' : 'neutro'}>
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
