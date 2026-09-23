'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react';

import { Button } from './button';
import { Ilustracao, type NomeIlustracao } from './ilustracoes';
import { cn } from '@/lib/utils';
import { ApiError, mensagemDeErro } from '@/lib/api/erros';

/**
 * Estado vazio.
 *
 * Sempre acionavel quando ha uma acao possivel: "Nenhum monitor habilitado" +
 * botao "Habilitar monitor" ensina o proximo passo, enquanto uma tabela vazia
 * so informa que nada aconteceu. Se nao ha acao possivel, a descricao diz por
 * que — e o que vai fazer o espaco deixar de estar vazio.
 *
 * Alinhado a esquerda, com a ilustracao ao lado: um bloco centralizado com
 * muito ar em volta parece pagina de erro, e este e um estado normal da tela.
 */
export function EstadoVazio({
  titulo,
  descricao,
  icone,
  ilustracao = 'tarefas',
  acao,
  compacto = false,
  className,
}: {
  titulo: string;
  descricao?: ReactNode;
  /** Icone no lugar da ilustracao, para espacos pequenos. */
  icone?: ReactNode;
  ilustracao?: NomeIlustracao;
  acao?: ReactNode;
  compacto?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-card border border-dashed border-borda-forte bg-superficie/60 sm:flex-row sm:items-center',
        compacto ? 'px-4 py-4' : 'px-5 py-6 sm:px-6',
        className,
      )}
    >
      <div className="shrink-0 text-texto-suave" aria-hidden>
        {icone ?? <Ilustracao nome={ilustracao} className={compacto ? 'h-10 w-10' : undefined} />}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-titulo text-titulo-cartao text-texto">{titulo}</p>
        {descricao && <div className="max-w-prose text-sm text-texto-suave">{descricao}</div>}
      </div>

      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}

/**
 * Estado de erro dentro de uma area da tela.
 *
 * Preserva o resto da pagina utilizavel — se a aba de materiais falhou, nao ha
 * motivo para derrubar o cabecalho da monitoria junto.
 *
 * 403 recebe tratamento proprio: se ele apareceu, a UI ofereceu algo que o
 * backend nega, o que indica divergencia entre `capacidades.ts` e as regras do
 * servidor. Vale a mensagem especifica em vez do texto generico.
 */
export function EstadoErro({
  erro,
  aoTentarNovamente,
  className,
}: {
  erro: unknown;
  aoTentarNovamente?: () => void;
  className?: string;
}) {
  const ehProibido = erro instanceof ApiError && erro.ehProibido;

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col gap-3 rounded-card border border-perigo/25 bg-perigo-suave/50 px-5 py-5 sm:flex-row sm:items-center',
        className,
      )}
    >
      <AlertTriangle className="h-6 w-6 shrink-0 text-perigo" aria-hidden />

      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold text-texto">
          {ehProibido ? 'Você não tem acesso a este conteúdo' : 'Não foi possível carregar'}
        </p>
        <p className="max-w-prose text-sm text-texto-suave">{mensagemDeErro(erro)}</p>
      </div>

      {aoTentarNovamente && !ehProibido && (
        <Button
          variante="secundaria"
          tamanho="sm"
          onClick={aoTentarNovamente}
          iconeEsquerda={<RotateCw className="h-4 w-4" aria-hidden />}
        >
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

/** Spinner centralizado, para areas pequenas onde um esqueleto seria exagero. */
export function Carregando({ rotulo = 'Carregando…' }: { rotulo?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-10 text-sm text-texto-suave"
      role="status"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {rotulo}
    </div>
  );
}
