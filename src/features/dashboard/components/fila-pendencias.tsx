'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Star } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardCabecalho, CardConteudo } from '@/components/ui/card';
import { SkeletonLista } from '@/components/ui/skeleton';
import { rotas } from '@/config/rotas';
import { listarMeusAtendimentos } from '@/features/atendimentos/api/atendimentos.service';
import { DialogoRealizar } from '@/features/atendimentos/components/dialogos-atendimento';
import { DialogoAvaliacao } from '@/features/avaliacoes/components/dialogo-avaliacao';
import { descreverDataRelativa } from '@/lib/datas/relativa';
import { chaves } from '@/lib/query/chaves';
import { useSessao } from '@/providers/sessao-provider';
import type { Atendimento } from '@/types/dominio';

/** Quantas pendências de cada tipo trazer. Acima disso vira lista, não fila. */
const LIMITE = 5;

/**
 * "O que precisa de você".
 *
 * Reúne as duas pendências que travam cadeias inteiras do domínio e que, antes
 * dos filtros A4, dependiam da memória do usuário:
 *
 *  - REGISTRAR PRESENÇA: sem REALIZADO + PRESENTE, o monitorado não pode
 *    avaliar (RN06) e ninguém pontua. Não havia nenhuma tela que cobrasse isso.
 *  - AVALIAR: antes era aproximado no cliente, filtrando os 20 realizados mais
 *    recentes — quem tinha histórico maior simplesmente não via parte das
 *    pendências, e o contador saía errado.
 *
 * Os dois recortes vêm do servidor (`aguardandoRegistro`, `pendentesDeAvaliacao`
 * em `/atendimentos/meus`), com o mesmo critério que o backend usa para decidir
 * `podeAvaliar` — lista e botão nunca discordam.
 *
 * Cada item resolve-se AQUI, sem navegar: o diálogo é o mesmo da tela de
 * detalhe, então não há segunda implementação da regra.
 */
export function FilaDePendencias() {
  const { fuso } = useSessao();
  const queryClient = useQueryClient();

  const [registrando, setRegistrando] = useState<Atendimento | null>(null);
  const [avaliando, setAvaliando] = useState<Atendimento | null>(null);

  const filtroRegistro = { aguardandoRegistro: true, direcao: 'desc' as const, limite: LIMITE };
  const filtroAvaliacao = {
    pendentesDeAvaliacao: true,
    direcao: 'desc' as const,
    limite: LIMITE,
  };

  const aRegistrar = useQuery({
    queryKey: chaves.atendimentos.meus(filtroRegistro),
    queryFn: () => listarMeusAtendimentos(filtroRegistro),
  });

  const aAvaliar = useQuery({
    queryKey: chaves.atendimentos.meus(filtroAvaliacao),
    queryFn: () => listarMeusAtendimentos(filtroAvaliacao),
  });

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: chaves.atendimentos.raiz });
    void queryClient.invalidateQueries({ queryKey: chaves.gamificacao.raiz });
  };

  if (aRegistrar.isPending || aAvaliar.isPending) {
    return <SkeletonLista itens={2} />;
  }

  const itensRegistro = aRegistrar.data?.dados ?? [];
  const itensAvaliacao = aAvaliar.data?.dados ?? [];
  const total = (aRegistrar.data?.meta.total ?? 0) + (aAvaliar.data?.meta.total ?? 0);

  // Nada pendente não merece um cartão vazio ocupando o topo do painel.
  if (total === 0) return null;

  const agora = new Date();

  return (
    <>
      <Card className="border-alerta/40">
        <CardCabecalho
          titulo="O que precisa de você"
          descricao={
            total === 1 ? '1 pendência' : `${total} pendências`
          }
        />

        <CardConteudo>
          <ul className="divide-y divide-borda">
            {itensRegistro.map((atendimento) => (
              <LinhaPendencia
                key={`registro-${atendimento.id}`}
                atendimento={atendimento}
                agora={agora}
                fuso={fuso}
                icone={<ClipboardCheck className="h-4 w-4 text-acento-forte" aria-hidden />}
                explicacao="Já aconteceu — registre a presença para liberar a avaliação."
                rotuloAcao="Registrar presença"
                aoAgir={() => setRegistrando(atendimento)}
              />
            ))}

            {itensAvaliacao.map((atendimento) => (
              <LinhaPendencia
                key={`avaliacao-${atendimento.id}`}
                atendimento={atendimento}
                agora={agora}
                fuso={fuso}
                icone={<Star className="h-4 w-4 text-alerta" aria-hidden />}
                explicacao="Você participou e ainda não avaliou."
                rotuloAcao="Avaliar"
                aoAgir={() => setAvaliando(atendimento)}
              />
            ))}
          </ul>

          {total > itensRegistro.length + itensAvaliacao.length && (
            <p className="pt-3 text-xs text-texto-suave">
              Mostrando as mais recentes.{' '}
              <Link href={rotas.atendimentos} className="font-semibold text-primaria hover:underline">
                Ver agenda completa
              </Link>
            </p>
          )}
        </CardConteudo>
      </Card>

      {/*
        Os diálogos são os MESMOS da tela de detalhe. Reimplementá-los aqui
        duplicaria a regra de presença e a de avaliação em dois lugares que
        divergiriam no primeiro ajuste.
      */}
      {registrando && (
        <DialogoRealizar
          aberto
          atendimento={registrando}
          aoFechar={() => setRegistrando(null)}
          aoConcluir={invalidar}
        />
      )}

      {avaliando && (
        <DialogoAvaliacao
          aberto
          atendimentoId={avaliando.id}
          nomeMonitor={avaliando.nomeMonitor}
          aoFechar={() => setAvaliando(null)}
        />
      )}
    </>
  );
}

function LinhaPendencia({
  atendimento,
  agora,
  fuso,
  icone,
  explicacao,
  rotuloAcao,
  aoAgir,
}: {
  atendimento: Atendimento;
  agora: Date;
  fuso: string;
  icone: React.ReactNode;
  explicacao: string;
  rotuloAcao: string;
  aoAgir: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-fundo-suave">
        {icone}
      </span>

      <div className="min-w-0 flex-1">
        <Link
          href={rotas.atendimento(atendimento.id)}
          className="block truncate text-sm font-medium text-texto hover:underline"
        >
          {atendimento.assunto}
        </Link>
        <p className="truncate text-xs text-texto-suave">
          {atendimento.monitoria?.nomeDisciplina ?? 'Monitoria'} ·{' '}
          {descreverDataRelativa(atendimento.inicio, agora, fuso)}
        </p>
        <p className="mt-0.5 text-xs text-texto-suave">{explicacao}</p>
      </div>

      <Button variante="secundaria" tamanho="sm" className="shrink-0" onClick={aoAgir}>
        {rotuloAcao}
      </Button>
    </li>
  );
}
