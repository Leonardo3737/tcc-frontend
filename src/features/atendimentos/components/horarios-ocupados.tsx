'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { listarAtendimentosDaMonitoria } from '../api/atendimentos.service';
import { useSessao } from '@/providers/sessao-provider';
import { chaves } from '@/lib/query/chaves';
import { rotas } from '@/config/rotas';
import { formatarIntervalo } from '@/lib/datas/fuso';
import { agruparPorDia, rotuloDia } from '@/lib/datas/relativa';
import { cn } from '@/lib/utils';
import { StatusAtendimento, type Atendimento } from '@/types/dominio';

/** Janela inicial e passo de "ver mais", em dias. */
const JANELA_DIAS = 14;
/** Teto do PaginacaoDto do backend. */
const LIMITE = 100;

/**
 * Horarios que o monitor ja tem ocupados, para quem esta agendando.
 *
 * RECOLHIDO por padrao, e a consulta so dispara ao abrir (`enabled`): a maioria
 * das pessoas agenda olhando so as faixas de disponibilidade, e buscar a agenda
 * do monitor em toda visita a esta tela gastaria requisicao (e rate limit) sem
 * necessidade. Aberto uma vez, o resultado fica no cache do TanStack Query.
 *
 * Usa `GET /monitorias/:id/atendimentos` com `status=AGENDADO`,
 * `monitorParticipanteId` e `de`/`ate` — tudo filtrado no servidor, aberto a
 * qualquer participante da monitoria.
 *
 * E uma ajuda para escolher, nao a validacao: o conflito de horario (RN03) e
 * conferido pelo backend ao confirmar, inclusive contra compromissos que esta
 * lista nao mostra.
 */
export function HorariosOcupados({
  monitoriaId,
  monitorParticipanteId,
  oferecerEntrar,
}: {
  monitoriaId: string;
  monitorParticipanteId: string;
  /** So monitorado se inscreve: o monitor vendo a propria agenda nao ganha o link. */
  oferecerEntrar: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [dias, setDias] = useState(JANELA_DIAS);
  /**
   * O "agora" da janela e fixado na primeira abertura. Calculado a cada render,
   * o `de` mudaria a todo instante — e com ele a chave de cache, refazendo a
   * consulta sem fim.
   */
  const [inicioJanela, setInicioJanela] = useState<string | null>(null);
  const idConteudo = useId();

  const alternar = () => {
    if (!aberto && !inicioJanela) {
      const agora = new Date();
      agora.setSeconds(0, 0);
      setInicioJanela(agora.toISOString());
    }
    setAberto((atual) => !atual);
  };

  const fimJanela = inicioJanela
    ? new Date(new Date(inicioJanela).getTime() + dias * 86_400_000).toISOString()
    : null;

  const filtro = {
    status: StatusAtendimento.AGENDADO,
    monitorParticipanteId,
    de: inicioJanela ?? undefined,
    ate: fimJanela ?? undefined,
    ordenarPor: 'inicio' as const,
    direcao: 'asc' as const,
    limite: LIMITE,
  };

  const consulta = useQuery({
    queryKey: chaves.monitorias.atendimentos(monitoriaId, filtro),
    queryFn: () => listarAtendimentosDaMonitoria(monitoriaId, filtro),
    enabled: aberto && Boolean(inicioJanela),
  });

  return (
    <div className="border-t border-borda pt-3">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        aria-controls={idConteudo}
        className="alvo-toque -mx-1 flex w-[calc(100%+0.5rem)] items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left text-sm font-semibold text-texto transition-colors hover:bg-fundo-suave"
      >
        <span>
          Horários já ocupados
          <span className="block text-xs font-normal text-texto-suave">
            Atendimentos agendados deste monitor nesta monitoria
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-texto-suave transition-transform duration-150',
            aberto && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {aberto && (
        <div id={idConteudo} className="mt-2 animate-fade-in space-y-3">
          {consulta.isPending && <SkeletonOcupados />}

          {consulta.isError && (
            <p className="text-sm text-texto-suave" role="alert">
              Não foi possível carregar a agenda do monitor.{' '}
              <button
                type="button"
                onClick={() => void consulta.refetch()}
                className="rounded font-semibold text-primaria hover:underline"
              >
                Tentar de novo
              </button>
            </p>
          )}

          {consulta.isSuccess && (
            <ListaOcupados
              oferecerEntrar={oferecerEntrar}
              atendimentos={consulta.data.dados}
              dias={dias}
              truncado={consulta.data.meta.total > consulta.data.dados.length}
            />
          )}

          {consulta.isSuccess && (
            <Button
              variante="link"
              tamanho="sm"
              className="h-auto px-0"
              carregando={consulta.isFetching}
              onClick={() => setDias((atual) => atual + JANELA_DIAS)}
            >
              Ver mais {JANELA_DIAS} dias
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ListaOcupados({
  oferecerEntrar,
  atendimentos,
  dias,
  truncado,
}: {
  oferecerEntrar: boolean;
  atendimentos: Atendimento[];
  dias: number;
  truncado: boolean;
}) {
  const { fuso } = useSessao();

  if (atendimentos.length === 0) {
    return (
      <p className="text-sm text-texto-suave">
        Nenhum atendimento agendado nos próximos {dias} dias. Todas as faixas acima estão livres.
      </p>
    );
  }

  // Agrupado por dia de calendario no fuso da instituicao (AD-F04).
  const agora = new Date();
  const grupos = agruparPorDia(atendimentos, fuso);

  return (
    <div className="space-y-3">
      {grupos.map(({ chave, itens: doDia }) => (
        <section key={chave} aria-label={rotuloDia(doDia[0]!.inicio, agora, fuso)}>
          <h3 className="text-xs font-semibold text-texto-suave">
            {rotuloDia(doDia[0]!.inicio, agora, fuso)}
          </h3>
          <ul className="mt-1 space-y-1">
            {doDia.map((atendimento) => (
              <LinhaOcupado
                key={atendimento.id}
                atendimento={atendimento}
                oferecerEntrar={oferecerEntrar}
              />
            ))}
          </ul>
        </section>
      ))}

      {truncado && (
        <p className="text-xs text-texto-suave">
          Mostrando os primeiros {atendimentos.length}. Os demais aparecem na aba Atendimentos.
        </p>
      )}
    </div>
  );
}

function LinhaOcupado({
  atendimento,
  oferecerEntrar,
}: {
  atendimento: Atendimento;
  oferecerEntrar: boolean;
}) {
  const { fuso } = useSessao();
  const emGrupo = atendimento.vagas > 1;
  const livres = Math.max(atendimento.vagas - atendimento.vagasOcupadas, 0);

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md bg-fundo-suave/70 px-2.5 py-1.5 text-sm">
      <span className="font-semibold tabular-nums text-texto">
        {formatarIntervalo(atendimento.inicio, atendimento.fim, fuso)}
      </span>

      <span className="text-xs text-texto-suave">
        {emGrupo
          ? `sessão em grupo · ${atendimento.vagasOcupadas} de ${atendimento.vagas}`
          : 'individual'}
      </span>

      {/*
        Sessao em grupo com vaga: entrar nela pode resolver melhor do que pedir
        outro horario. `aceitaInscricao` vem do servidor; nao e recalculado aqui.
      */}
      {oferecerEntrar && atendimento.aceitaInscricao && livres > 0 && (
        <Link
          href={rotas.atendimento(atendimento.id)}
          className="ml-auto inline-flex items-center gap-1 rounded text-xs font-semibold text-acento-forte hover:underline"
        >
          <Users className="h-3.5 w-3.5" aria-hidden />
          {livres === 1 ? '1 vaga — entrar' : `${livres} vagas — entrar`}
        </Link>
      )}
    </li>
  );
}

/** Mesmo formato: rotulo do dia e duas linhas de horario. */
function SkeletonOcupados() {
  return (
    <div role="status" aria-busy aria-label="Carregando horários ocupados" className="space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
