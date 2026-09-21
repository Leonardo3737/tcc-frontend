'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, RotateCw } from 'lucide-react';

import { Button } from './button';
import { cn } from '@/lib/utils';
import { ApiError, mensagemDeErro } from '@/lib/api/erros';

/**
 * Estado vazio.
 *
 * Sempre acionavel quando ha uma acao possivel: "Nenhum monitor habilitado" +
 * botao "Habilitar monitor" ensina o proximo passo, enquanto uma tabela vazia
 * so informa que nada aconteceu.
 */
export function EstadoVazio({
  titulo,
  descricao,
  icone,
  acao,
  className,
}: {
  titulo: string;
  descricao?: string;
  icone?: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-borda bg-superficie/60 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="text-texto-suave" aria-hidden>
        {icone ?? <Inbox className="h-8 w-8" />}
      </div>

      <div className="space-y-1">
        <p className="font-medium text-texto">{titulo}</p>
        {descricao && <p className="mx-auto max-w-sm text-sm text-texto-suave">{descricao}</p>}
      </div>

      {acao && <div className="mt-1">{acao}</div>}
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
        'flex flex-col items-center justify-center gap-3 rounded-card border border-perigo/30 bg-perigo/5 px-6 py-10 text-center',
        className,
      )}
    >
      <AlertTriangle className="h-7 w-7 text-perigo" aria-hidden />

      <div className="space-y-1">
        <p className="font-medium text-texto">
          {ehProibido ? 'Você não tem acesso a este conteúdo' : 'Não foi possível carregar'}
        </p>
        <p className="mx-auto max-w-md text-sm text-texto-suave">{mensagemDeErro(erro)}</p>
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
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-texto-suave" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {rotulo}
    </div>
  );
}
