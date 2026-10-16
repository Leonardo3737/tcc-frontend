'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarX2, Clock } from 'lucide-react';
import { useId, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatarHora } from '@/lib/datas/fuso';
import { agruparPorDia, rotuloDia } from '@/lib/datas/relativa';
import { chaves } from '@/lib/query/chaves';
import { cn } from '@/lib/utils';
import { useSessao } from '@/providers/sessao-provider';
import type { HorarioLivre } from '@/types/dominio';
import { listarHorariosLivres } from '../api/atendimentos.service';

/** Janela inicial e passo de "ver mais", em dias. O backend recusa acima de 60. */
const JANELA_DIAS = 21;
const JANELA_MAXIMA = 60;

/**
 * Durações oferecidas em botão. A lista é filtrada pelos limites da instituição
 * e a duração padrão sempre entra, mesmo que não esteja aqui.
 */
const DURACOES_SUGERIDAS = [30, 45, 60, 90, 120] as const;

/** Ultimo recurso, se nenhuma sugestao couber nos limites e a padrao for invalida. */
const DURACAO_DE_EMERGENCIA = 60;

export function duracoesDisponiveis(limites: {
  duracaoMinimaMinutos: number;
  duracaoPadraoMinutos: number;
  duracaoMaximaMinutos: number;
}): number[] {
  const dentroDosLimites = DURACOES_SUGERIDAS.filter(
    (minutos) =>
      minutos >= limites.duracaoMinimaMinutos && minutos <= limites.duracaoMaximaMinutos,
  );

  /**
   * O filtro de finitude nao e defensividade decorativa.
   *
   * `limites` vem de GET /configuracao, e ali o tipo `number` e suposicao: uma
   * resposta sem `duracaoPadraoMinutos` (backend mais antigo, ou cache de fetch
   * com a forma anterior) o traz `undefined`, e ele viraria um botao escrito
   * "NaN h NaN" — porque `Math.floor(undefined / 60)` propaga NaN em silencio
   * em vez de estourar. Aconteceu em uso real.
   *
   * `normalizarConfiguracao` ja preenche o campo na fronteira, mas esta funcao
   * e exportada e testavel por si, entao nao depende de quem a chama.
   */
  const todas = new Set<number>(
    [...dentroDosLimites, limites.duracaoPadraoMinutos].filter(
      (minutos): minutos is number => typeof minutos === 'number' && Number.isFinite(minutos),
    ),
  );

  // Limites incoerentes poderiam esvaziar a lista; sem opcao nao ha o que clicar.
  if (todas.size === 0) todas.add(DURACAO_DE_EMERGENCIA);

  return [...todas].sort((a, b) => a - b);
}

export function rotuloDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto}`;
}

/**
 * Escolha de horário por clique, em vez de data/início/término digitados.
 *
 * Os slots vêm de `GET /monitorias/:id/atendimentos/horarios-livres` (A1) e NÃO
 * são calculados aqui — essa conta depende de três coisas que o cliente não
 * tem: a validação de janela em SQL com `AT TIME ZONE`, a agenda do próprio
 * solicitante em monitorias que ele não pode ler, e o relógio do servidor.
 * Refazê-la aqui ofereceria horários que o agendamento recusa, que é pior do
 * que não oferecer nada.
 *
 * É SUGESTÃO, não reserva: entre a listagem e o envio outra pessoa pode ocupar
 * o mesmo slot, e o 409 que vier daí está correto. Por isso o formulário mantém
 * o caminho manual como alternativa.
 */
export function SeletorDeHorario({
  monitoriaId,
  monitorParticipanteId,
  duracaoMinutos,
  valor,
  aoEscolher,
  mostrarMonitor = false,
}: {
  monitoriaId: string;
  /** Omitido, o servidor considera todos os monitores ativos da monitoria. */
  monitorParticipanteId?: string;
  duracaoMinutos: number;
  valor: HorarioLivre | null;
  aoEscolher: (horario: HorarioLivre) => void;
  /** Mostra de quem é cada slot — só faz sentido sem monitor fixo. */
  mostrarMonitor?: boolean;
}) {
  const { fuso } = useSessao();
  const [dias, setDias] = useState(JANELA_DIAS);

  /**
   * O início da janela é fixado uma vez. Recalculado a cada render, `de` mudaria
   * a todo instante e com ele a chave de cache, refazendo a consulta sem fim —
   * mesma armadilha já resolvida em `HorariosOcupados`.
   */
  const [de] = useState(() => {
    const agora = new Date();
    agora.setSeconds(0, 0);
    return agora.toISOString();
  });

  const ate = new Date(new Date(de).getTime() + dias * 86_400_000).toISOString();

  const filtro = { de, ate, duracaoMinutos, monitorParticipanteId };

  const consulta = useQuery({
    queryKey: chaves.monitorias.horariosLivres(monitoriaId, filtro),
    queryFn: () => listarHorariosLivres(monitoriaId, filtro),
  });

  if (consulta.isPending) {
    return <EsqueletoSlots />;
  }

  if (consulta.isError) {
    return (
      <Alert tom="alerta" titulo="Não foi possível carregar os horários">
        Você ainda pode informar data e horário manualmente.{' '}
        <button
          type="button"
          onClick={() => void consulta.refetch()}
          className="rounded font-semibold text-primaria hover:underline"
        >
          Tentar de novo
        </button>
      </Alert>
    );
  }

  const { horarios, truncado } = consulta.data;

  if (horarios.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-borda-forte px-4 py-6 text-center">
        <CalendarX2 className="mx-auto h-7 w-7 text-texto-suave" aria-hidden />
        <p className="mt-2 text-sm font-semibold text-texto">
          Nenhum horário livre nos próximos {dias} dias
        </p>
        <p className="mt-1 text-xs text-texto-suave">
          Tente uma duração menor, amplie o período, ou informe um horário manualmente.
        </p>

        {dias < JANELA_MAXIMA && (
          <Button
            variante="secundaria"
            tamanho="sm"
            className="mt-3"
            carregando={consulta.isFetching}
            onClick={() => setDias((atual) => Math.min(atual + JANELA_DIAS, JANELA_MAXIMA))}
          >
            Ver mais {JANELA_DIAS} dias
          </Button>
        )}
      </div>
    );
  }

  const grupos = agruparPorDia(horarios, fuso);
  const agora = new Date();

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'max-h-80 space-y-4 overflow-y-auto pr-1',
          consulta.isFetching && 'opacity-60',
        )}
      >
        {grupos.map(({ chave, itens }) => (
          <section key={chave}>
            <h3 className="sticky top-0 bg-superficie py-1 text-xs font-semibold text-texto-suave">
              {rotuloDia(itens[0]!.inicio, agora, fuso)}
            </h3>

            <ul className="mt-1 flex flex-wrap gap-2">
              {itens.map((horario) => (
                <li key={`${horario.inicio}-${horario.monitorParticipanteId}`}>
                  <BotaoSlot
                    horario={horario}
                    fuso={fuso}
                    selecionado={
                      valor?.inicio === horario.inicio &&
                      valor?.monitorParticipanteId === horario.monitorParticipanteId
                    }
                    mostrarMonitor={mostrarMonitor}
                    aoEscolher={() => aoEscolher(horario)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {dias < JANELA_MAXIMA && (
          <Button
            variante="link"
            tamanho="sm"
            className="h-auto px-0"
            carregando={consulta.isFetching}
            onClick={() => setDias((atual) => Math.min(atual + JANELA_DIAS, JANELA_MAXIMA))}
          >
            Ver mais {JANELA_DIAS} dias
          </Button>
        )}

        {truncado && (
          <p className="text-xs text-texto-suave">
            Muitos horários para mostrar. Reduza o período ou escolha um monitor.
          </p>
        )}
      </div>
    </div>
  );
}

function BotaoSlot({
  horario,
  fuso,
  selecionado,
  mostrarMonitor,
  aoEscolher,
}: {
  horario: HorarioLivre;
  fuso: string;
  selecionado: boolean;
  mostrarMonitor: boolean;
  aoEscolher: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoEscolher}
      aria-pressed={selecionado}
      className={cn(
        'alvo-toque rounded-lg border px-3 py-1.5 text-left text-sm tabular-nums transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primaria',
        selecionado
          ? 'border-primaria bg-primaria text-white'
          : 'border-borda-forte bg-superficie text-texto hover:border-primaria hover:bg-primaria-suave',
      )}
    >
      <span className="block font-semibold">
        {formatarHora(horario.inicio, fuso)}–{formatarHora(horario.fim, fuso)}
      </span>

      {mostrarMonitor && (
        <span
          className={cn(
            'block truncate text-xs font-normal',
            selecionado ? 'text-white/80' : 'text-texto-suave',
          )}
        >
          {horario.nomeMonitor}
        </span>
      )}
    </button>
  );
}

/** Botões de duração. Muda o tamanho do slot pedido ao servidor. */
export function SeletorDeDuracao({
  valor,
  opcoes,
  aoEscolher,
  desabilitado,
}: {
  valor: number;
  opcoes: number[];
  aoEscolher: (minutos: number) => void;
  desabilitado?: boolean;
}) {
  const idGrupo = useId();

  return (
    <div role="group" aria-labelledby={idGrupo}>
      <span id={idGrupo} className="block text-sm font-semibold text-texto">
        Duração
      </span>

      <div className="mt-1.5 flex flex-wrap gap-2">
        {opcoes.map((minutos) => (
/*           isNaN(minutos) ? <></> : */
            <button
              key={minutos}
              type="button"
              disabled={desabilitado}
              onClick={() => aoEscolher(minutos)}
              aria-pressed={valor === minutos}
              className={cn(
                'alvo-toque rounded-lg border px-3 py-1.5 text-sm tabular-nums transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primaria',
                'disabled:cursor-not-allowed disabled:opacity-60',
                valor === minutos
                  ? 'border-primaria bg-primaria text-white'
                  : 'border-borda-forte bg-superficie text-texto hover:border-primaria hover:bg-primaria-suave',
              )}
            >
              {rotuloDuracao(minutos)}
            </button>
        ))}
      </div>
    </div>
  );
}

/** Mesma forma da lista: rótulo do dia e uma fileira de pastilhas. */
function EsqueletoSlots() {
  return (
    <div role="status" aria-busy aria-label="Carregando horários livres" className="space-y-4">
      {[0, 1].map((grupo) => (
        <div key={grupo} className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Um ícone + o horário escolhido, para o resumo de confirmação. */
export function ResumoDoHorario({ horario, fuso }: { horario: HorarioLivre; fuso: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {formatarHora(horario.inicio, fuso)}–{formatarHora(horario.fim, fuso)}
    </span>
  );
}
