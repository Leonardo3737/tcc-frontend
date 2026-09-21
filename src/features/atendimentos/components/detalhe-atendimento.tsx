'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
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

import { Button } from '@/components/ui/button';
import { Card, CardCabecalho, CardConteudo } from '@/components/ui/card';
import { Badge, BadgeStatusAtendimento } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { EstadoErro } from '@/components/ui/estados';
import { SkeletonCard } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { DialogoConfirmacao } from '@/components/comum/confirmacao';
import { DialogoAvaliacao } from '@/features/avaliacoes/components/dialogo-avaliacao';
import { DialogoCancelar, DialogoReagendar, DialogoRealizar } from './dialogos-atendimento';
import { Avaliacoes, HistoricoAtendimento, ListaInscricoes } from './secoes-atendimento';
import {
  cancelarInscricao,
  detalharAtendimento,
  inscreverEmAtendimento,
} from '../api/atendimentos.service';
import { useSessao } from '@/providers/sessao-provider';
import { mensagemDeErro } from '@/lib/api/erros';
import { chaves } from '@/lib/query/chaves';
import { rotas } from '@/config/rotas';
import { formatarDataHoraExtensa, formatarIntervalo } from '@/lib/datas/fuso';
import {
  ModalidadeAtendimento,
  OrigemAtendimento,
  StatusAtendimento,
  StatusInscricao,
} from '@/types/dominio';

/**
 * Detalhe do atendimento e as acoes possiveis sobre ele.
 *
 * Quem pode o que vem do PROPRIO RECURSO, nao de um estado local:
 *  - `aceitaInscricao` (calculado no servidor) habilita a inscricao;
 *  - `inscricoes[].souEu` identifica a minha inscricao;
 *  - `inscricoes[].podeAvaliar` decide o botao de avaliar (RN05/RN06).
 *
 * Realizar, cancelar e reagendar pertencem ao monitor da sessao ou ao professor
 * responsavel. Como a monitoria nao esta na URL, essa checagem acontece no
 * backend — aqui um 403 seria sintoma de divergencia, nao fluxo esperado.
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
              {/* --- Monitorado --- */}
              {atendimento.aceitaInscricao && !minhaInscricao && (
                <Button
                  className="w-full"
                  carregando={inscrever.isPending}
                  onClick={() => inscrever.mutate()}
                  iconeEsquerda={<UserPlus className="h-4 w-4" aria-hidden />}
                >
                  Inscrever-se
                </Button>
              )}

              {minhaInscricao?.status === StatusInscricao.INSCRITO && agendado && (
                <Button
                  variante="secundaria"
                  className="w-full"
                  onClick={() => setConfirmandoDesistencia(true)}
                  iconeEsquerda={<UserMinus className="h-4 w-4" aria-hidden />}
                >
                  Desistir da inscrição
                </Button>
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

              {/* --- Monitor da sessão / professor responsável --- */}
              {agendado && (
                <>
                  <Button
                    variante="secundaria"
                    className="w-full"
                    disabled={!jaComecou}
                    onClick={() => setDialogoRealizar(true)}
                    iconeEsquerda={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                  >
                    Registrar realização
                  </Button>

                  {!jaComecou && (
                    <p className="text-xs text-texto-suave">
                      A realização só pode ser registrada depois do horário de início.
                    </p>
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

                  <p className="pt-1 text-xs text-texto-suave">
                    Realizar, reagendar e cancelar são ações do monitor desta sessão ou do
                    professor responsável.
                  </p>
                </>
              )}

              {!agendado && !minhaInscricao?.podeAvaliar && (
                <p className="text-sm text-texto-suave">
                  Este atendimento está {atendimento.status.toLowerCase()} e não aceita mais
                  alterações.
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
