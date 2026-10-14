'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  MapPin,
  Star,
  UserMinus,
  UserPlus,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { DialogoConfirmacao } from '@/components/comum/confirmacao';
import { Alert } from '@/components/ui/alert';
import { Badge, BadgeStatusAtendimento } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardCabecalho, CardConteudo } from '@/components/ui/card';
import { EstadoErro } from '@/components/ui/estados';
import { SkeletonCard } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { rotas } from '@/config/rotas';
import { DialogoAvaliacao } from '@/features/avaliacoes/components/dialogo-avaliacao';
import { detalharMonitoria } from '@/features/monitorias/api/monitorias.service';
import { mensagemDeErro } from '@/lib/api/erros';
import {
  contextoDaMonitoria,
  podeDesistirDaInscricao,
  podeGerirAtendimento,
  podeRegistrarRealizacao,
  podeSeInscreverEmAtendimento,
} from '@/lib/autorizacao/capacidades';
import { formatarDataHoraExtensa, formatarIntervalo } from '@/lib/datas/fuso';
import { chaves } from '@/lib/query/chaves';
import { useSessao } from '@/providers/sessao-provider';
import {
  ModalidadeAtendimento,
  OrigemAtendimento,
  PapelMonitoria,
  StatusAtendimento,
} from '@/types/dominio';
import {
  cancelarInscricao,
  detalharAtendimento,
  inscreverEmAtendimento,
} from '../api/atendimentos.service';
import { DialogoCancelar, DialogoReagendar, DialogoRealizar } from './dialogos-atendimento';
import { Avaliacoes, HistoricoAtendimento, ListaInscricoes } from './secoes-atendimento';

/**
 * Detalhe do atendimento e as acoes possiveis sobre ele.
 *
 * Quem pode o que vem do PROPRIO RECURSO, nao de um estado local:
 *  - `aceitaInscricao` (calculado no servidor) habilita a inscricao;
 *  - `inscricoes[].souEu` identifica a minha inscricao;
 *  - `inscricoes[].podeAvaliar` decide o botao de avaliar (RN05/RN06).
 *
 * Realizar, cancelar e reagendar pertencem ao monitor DAQUELA sessao ou ao
 * professor responsavel; inscrever-se e desistir, ao monitorado. Esta tela fica
 * fora do layout da monitoria, entao o papel vem de `GET /monitorias/:id`
 * (`meuPapel`, `souResponsavel`, `meuParticipanteId`), e cada botao consulta a
 * regra em `capacidades.ts`. Enquanto o contexto nao chega, as acoes que
 * dependem dele ficam ocultas: mostrar e depois esconder seria pior.
 */
export function DetalheAtendimento({ atendimentoId }: { atendimentoId: string }) {
  const { fuso } = useSessao();
  const queryClient = useQueryClient();

  const [dialogoCancelar, setDialogoCancelar] = useState(false);
  const [dialogoReagendar, setDialogoReagendar] = useState(false);
  const [dialogoRealizar, setDialogoRealizar] = useState(false);
  const [dialogoAvaliar, setDialogoAvaliar] = useState(false);
  const [confirmandoDesistencia, setConfirmandoDesistencia] = useState(false);

  const consulta = useQuery({
    queryKey: chaves.atendimentos.detalhe(atendimentoId),
    queryFn: () => detalharAtendimento(atendimentoId),
  });

  const monitoriaId = consulta.data?.monitoriaId;

  const contextoMonitoria = useQuery({
    queryKey: chaves.monitorias.detalhe(monitoriaId ?? ''),
    queryFn: () => detalharMonitoria(monitoriaId!),
    enabled: Boolean(monitoriaId),
  });

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: chaves.atendimentos.raiz });
    void queryClient.invalidateQueries({ queryKey: chaves.monitorias.raiz });
  };

  const inscrever = useMutation({
    mutationFn: () => inscreverEmAtendimento(atendimentoId),
    onSuccess: () => {
      invalidar();
      toast.sucesso('Inscrição confirmada');
    },
    // 409 = sem vagas, sessão já iniciada, ou conflito de horário (RN03).
    onError: (erro) => toast.erro('Não foi possível inscrever', mensagemDeErro(erro)),
  });

  const desistir = useMutation({
    mutationFn: () => cancelarInscricao(atendimentoId),
    onSuccess: (atendimento) => {
      invalidar();
      setConfirmandoDesistencia(false);
      toast.sucesso(
        'Inscrição cancelada',
        atendimento.status === StatusAtendimento.CANCELADO
          ? 'Como você era o solicitante e ninguém mais restou, a sessão foi cancelada.'
          : undefined,
      );
    },
    onError: (erro) => toast.erro('Não foi possível desistir', mensagemDeErro(erro)),
  });

  if (consulta.isPending) return <SkeletonCard className="h-64" />;

  if (consulta.isError) {
    return <EstadoErro erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />;
  }

  const atendimento = consulta.data;
  const minhaInscricao = atendimento.inscricoes?.find((inscricao) => inscricao.souEu);
  const remoto = atendimento.modalidade === ModalidadeAtendimento.REMOTO;
  const agendado = atendimento.status === StatusAtendimento.AGENDADO;
  const jaComecou = new Date(atendimento.inicio).getTime() <= Date.now();

  const contexto = contextoMonitoria.data ? contextoDaMonitoria(contextoMonitoria.data) : null;
  const podeInscrever = contexto ? podeSeInscreverEmAtendimento(atendimento, contexto) : false;
  const podeDesistir = podeDesistirDaInscricao(atendimento);
  const podeGerir = contexto ? podeGerirAtendimento(atendimento, contexto) : false;
  const podeRealizar = contexto ? podeRegistrarRealizacao(atendimento, contexto) : false;
  const souSolicitante =
    atendimento.origem === OrigemAtendimento.SOLICITACAO_ALUNO && Boolean(minhaInscricao);
  const algumaAcao =
    podeInscrever || podeDesistir || podeGerir || Boolean(minhaInscricao?.podeAvaliar);

  /**
   * Se ele é o único inscrito de uma sessão que ele mesmo solicitou, desistir
   * cancela o atendimento inteiro. Avisar antes evita a surpresa.
   */
  const desistirCancelaSessao =
    atendimento.origem === OrigemAtendimento.SOLICITACAO_ALUNO && atendimento.vagasOcupadas <= 1;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardConteudo className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  {atendimento.monitoria && (
                    <Link
                      href={rotas.monitoria(atendimento.monitoriaId)}
                      className="font-mono text-xs text-primaria hover:underline"
                    >
                      {atendimento.monitoria.codigoDisciplina} —{' '}
                      {atendimento.monitoria.nomeDisciplina}
                    </Link>
                  )}

                  <h1 className="text-lg font-semibold text-texto sm:text-xl">
                    {atendimento.assunto}
                  </h1>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <BadgeStatusAtendimento status={atendimento.status} />
                  {atendimento.aceitaInscricao && <Badge tom="info">Aceita inscrição</Badge>}
                </div>
              </div>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-texto-suave">Quando</dt>
                  <dd className="text-texto">
                    {formatarDataHoraExtensa(atendimento.inicio, fuso)}
                    <span className="block text-texto-suave">
                      {formatarIntervalo(atendimento.inicio, atendimento.fim, fuso)} ({fuso})
                    </span>
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-texto-suave">
                    {remoto ? 'Link' : 'Local'} · modalidade
                  </dt>
                  <dd className="flex items-center gap-1.5 text-texto">
                    {remoto ? (
                      <Video className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {atendimento.local ?? (remoto ? 'Remoto' : 'Presencial')}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-texto-suave">Monitor</dt>
                  <dd className="text-texto">{atendimento.nomeMonitor ?? '—'}</dd>
                </div>

                <div>
                  <dt className="text-xs text-texto-suave">Capacidade</dt>
                  <dd className="text-texto">
                    {atendimento.vagas > 1
                      ? `${atendimento.vagasOcupadas} de ${atendimento.vagas} vagas ocupadas`
                      : 'Atendimento individual'}
                  </dd>
                </div>
              </dl>

              {atendimento.origem === OrigemAtendimento.SOLICITACAO_ALUNO && (
                <p className="text-xs text-texto-suave">
                  Esta sessão nasceu de uma solicitação de aluno.
                </p>
              )}

              {atendimento.motivoCancelamento && (
                <Alert tom="erro" titulo="Atendimento cancelado">
                  {atendimento.motivoCancelamento}
                </Alert>
              )}
            </CardConteudo>
          </Card>

          <ListaInscricoes atendimento={atendimento} fuso={fuso} />

          <Avaliacoes atendimentoId={atendimentoId} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardCabecalho titulo="Ações" />
            <CardConteudo className="space-y-2">
              {contextoMonitoria.isPending && agendado && (
                <p className="text-sm text-texto-suave" role="status">
                  Verificando o que você pode fazer aqui…
                </p>
              )}

              {/* --- Monitorado --- */}
              {podeInscrever && (
                <Button
                  className="w-full"
                  carregando={inscrever.isPending}
                  onClick={() => inscrever.mutate()}
                  iconeEsquerda={<UserPlus className="h-4 w-4" aria-hidden />}
                >
                  {minhaInscricao ? 'Inscrever-se de novo' : 'Inscrever-se'}
                </Button>
              )}

              {podeDesistir && (
                <>
                  <Button
                    variante="secundaria"
                    className="w-full"
                    onClick={() => setConfirmandoDesistencia(true)}
                    iconeEsquerda={<UserMinus className="h-4 w-4" aria-hidden />}
                  >
                    {souSolicitante && desistirCancelaSessao
                      ? 'Desistir e cancelar o pedido'
                      : 'Desistir da inscrição'}
                  </Button>

                  {/*
                    O solicitante nao cancela nem reagenda (so o monitor ou o
                    professor). Dizer isso evita a busca por um botao que nao
                    existe para ele.
                  */}
                  {souSolicitante && (
                    <p className="text-xs text-texto-suave">
                      Precisa de outro horário? Cancele e faça um novo pedido, ou combine com o
                      monitor: só ele ou o professor responsável podem reagendar.
                    </p>
                  )}
                </>
              )}

              {minhaInscricao?.podeAvaliar && (
                <Button
                  className="w-full"
                  onClick={() => setDialogoAvaliar(true)}
                  iconeEsquerda={<Star className="h-4 w-4" aria-hidden />}
                >
                  Avaliar atendimento
                </Button>
              )}

              {minhaInscricao?.jaAvaliei && (
                <p className="rounded-lg bg-sucesso/5 px-3 py-2 text-xs text-sucesso">
                  Você já avaliou este atendimento.
                </p>
              )}

              {/* --- Monitor DESTA sessão ou professor responsável --- */}
              {podeGerir && (
                <>
                  {podeRealizar ? (
                    <Button
                      variante="secundaria"
                      className="w-full"
                      onClick={() => setDialogoRealizar(true)}
                      iconeEsquerda={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                    >
                      Registrar realização
                    </Button>
                  ) : (
                    !jaComecou && (
                      <p className="text-xs text-texto-suave">
                        A presença pode ser registrada a partir do horário de início.
                      </p>
                    )
                  )}

                  <Button
                    variante="secundaria"
                    className="w-full"
                    onClick={() => setDialogoReagendar(true)}
                    iconeEsquerda={<CalendarClock className="h-4 w-4" aria-hidden />}
                  >
                    Reagendar
                  </Button>

                  <Button
                    variante="secundaria"
                    className="w-full"
                    onClick={() => setDialogoCancelar(true)}
                    iconeEsquerda={<Ban className="h-4 w-4" aria-hidden />}
                  >
                    Cancelar atendimento
                  </Button>
                </>
              )}

              {!agendado && !minhaInscricao?.podeAvaliar && (
                <p className="text-sm text-texto-suave">
                  Este atendimento está {atendimento.status.toLowerCase()} e não aceita mais
                  alterações.
                </p>
              )}

              {agendado && contexto && !algumaAcao && (
                <p className="text-sm text-texto-suave">
                  {contexto.meuPapel === PapelMonitoria.MONITORADO
                    ? 'As inscrições desta sessão estão fechadas: ela está lotada ou já começou.'
                    : `Não há ações para você neste atendimento. Ele é conduzido por ${
                        atendimento.nomeMonitor ?? 'outro monitor'
                      }.`}
                </p>
              )}
            </CardConteudo>
          </Card>

          <HistoricoAtendimento atendimento={atendimento} fuso={fuso} />
        </div>
      </div>

      <DialogoConfirmacao
        aberto={confirmandoDesistencia}
        aoFechar={() => setConfirmandoDesistencia(false)}
        aoConfirmar={() => desistir.mutate()}
        carregando={desistir.isPending}
        titulo="Desistir da inscrição"
        descricao="Sua vaga será liberada para outro monitorado."
        rotuloConfirmar="Desistir"
        aviso={
          desistirCancelaSessao
            ? 'Esta sessão foi criada a seu pedido e você é o único inscrito: ao desistir, o atendimento inteiro será cancelado.'
            : undefined
        }
      />

      <DialogoCancelar
        aberto={dialogoCancelar}
        aoFechar={() => setDialogoCancelar(false)}
        aoConcluir={invalidar}
        atendimentoId={atendimentoId}
      />

      <DialogoReagendar
        aberto={dialogoReagendar}
        aoFechar={() => setDialogoReagendar(false)}
        aoConcluir={invalidar}
        atendimento={atendimento}
        fuso={fuso}
      />

      <DialogoRealizar
        aberto={dialogoRealizar}
        aoFechar={() => setDialogoRealizar(false)}
        aoConcluir={invalidar}
        atendimento={atendimento}
      />

      <DialogoAvaliacao
        aberto={dialogoAvaliar}
        aoFechar={() => setDialogoAvaliar(false)}
        atendimentoId={atendimentoId}
        nomeMonitor={atendimento.nomeMonitor}
      />
    </div>
  );
}
