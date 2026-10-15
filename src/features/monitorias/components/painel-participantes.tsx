'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpCircle, LogOut, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';

import { DialogoConfirmacao, useConfirmacao } from '@/components/comum/confirmacao';
import { Paginacao } from '@/components/comum/paginacao';
import { Alert } from '@/components/ui/alert';
import { BadgePapel, BadgeStatusParticipacao } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/campo';
import { Card, CardConteudo } from '@/components/ui/card';
import { EstadoErro, EstadoVazio } from '@/components/ui/estados';
import { SkeletonLista } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useFiltrosUrl } from '@/hooks/use-filtros-url';
import { mensagemDeErro } from '@/lib/api/erros';
import { chaves } from '@/lib/query/chaves';
import { iniciais } from '@/lib/utils';
import { useContextoMonitoria } from '@/providers/monitoria-provider';
import { PapelMonitoria, StatusParticipacao, type Participante } from '@/types/dominio';
import {
  encerrarParticipacao,
  listarParticipantes,
  promoverAMonitor,
} from '../api/monitorias.service';
import { DialogoAdicionarParticipante } from './dialogo-adicionar-participante';

/**
 * Participantes da monitoria.
 *
 * O filtro de status existe por causa da RN10: vinculos encerrados NAO somem do
 * sistema, eles ficam consultaveis como historico. O padrao do backend e ATIVO;
 * o historico e um pedido explicito.
 */
export function PainelParticipantes() {
  const { monitoria, capacidades, contexto } = useContextoMonitoria();
  const { obter, obterNumero, definir } = useFiltrosUrl();
  const queryClient = useQueryClient();
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const confirmacaoEncerrar = useConfirmacao<Participante>();
  const confirmacaoPromover = useConfirmacao<Participante>();

  const papel = obter('papel');
  const situacao = obter('situacao');
  const pagina = obterNumero('pagina', 1);

  const filtro = {
    papel: (papel || undefined) as PapelMonitoria | undefined,
    status: situacao === 'encerrados' ? StatusParticipacao.ENCERRADO : StatusParticipacao.ATIVO,
    pagina,
    limite: 20,
  };

  const consulta = useQuery({
    queryKey: chaves.monitorias.participantes(monitoria.id, filtro),
    queryFn: () => listarParticipantes(monitoria.id, filtro),
  });

  const encerrar = useMutation({
    mutationFn: (participanteId: string) => encerrarParticipacao(monitoria.id, participanteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: chaves.monitorias.escopo(monitoria.id),
      });
      toast.sucesso('Participação encerrada', 'O vínculo virou histórico — nada foi apagado.');
      confirmacaoEncerrar.fechar();
    },
    /**
     * 409 = o participante ainda tem atendimentos AGENDADOS ou inscrições
     * ativas. Encerrar deixaria compromissos órfãos, então o backend exige que
     * eles sejam resolvidos antes.
     */
    onError: (erro) => toast.erro('Não foi possível encerrar', mensagemDeErro(erro)),
  });

  /**
   * A3 — MONITORADO vira MONITOR em uma operação só.
   *
   * Antes eram duas chamadas manuais (encerrar + habilitar), e o professor
   * precisava conhecer a RN09 para descobrir que a primeira era necessária. Pior:
   * falhando a segunda, o aluno ficava sem vínculo nenhum.
   */
  const promover = useMutation({
    mutationFn: (participanteId: string) => promoverAMonitor(monitoria.id, participanteId),
    onSuccess: (participante) => {
      void queryClient.invalidateQueries({ queryKey: chaves.monitorias.escopo(monitoria.id) });
      void queryClient.invalidateQueries({ queryKey: chaves.atendimentos.raiz });
      toast.sucesso(
        'Promovido a monitor',
        `${participante.nomeAluno ?? 'O aluno'} agora conduz atendimentos nesta monitoria.`,
      );
      confirmacaoPromover.fechar();
    },
    onError: (erro) => toast.erro('Não foi possível promover', mensagemDeErro(erro)),
  });

  const vendoHistorico = situacao === 'encerrados';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          label="Papel"
          className="sm:w-44 [&>label]:sr-only"
          value={papel}
          onChange={(evento) => definir({ papel: evento.target.value })}
          opcoes={[
            { valor: '', rotulo: 'Todos os papéis' },
            { valor: PapelMonitoria.MONITOR, rotulo: 'Monitores' },
            { valor: PapelMonitoria.MONITORADO, rotulo: 'Monitorados' },
          ]}
        />

        <Select
          label="Situação"
          className="sm:w-48 [&>label]:sr-only"
          value={situacao}
          onChange={(evento) => definir({ situacao: evento.target.value })}
          opcoes={[
            { valor: '', rotulo: 'Vínculos ativos' },
            { valor: 'encerrados', rotulo: 'Histórico (encerrados)' },
          ]}
        />

        <div className="sm:ml-auto">
          {capacidades.habilitarMonitor && (
            <Button
              onClick={() => setDialogoAberto(true)}
              iconeEsquerda={<UserPlus className="h-4 w-4" aria-hidden />}
            >
              Adicionar participante
            </Button>
          )}
        </div>
      </div>

      {vendoHistorico && (
        <Alert tom="info">
          Vínculos encerrados são preservados (RN10): eles continuam sendo o sujeito dos
          atendimentos já registrados.
        </Alert>
      )}

      {consulta.isPending && <SkeletonLista itens={3} />}

      {consulta.isError && (
        <EstadoErro erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      )}

      {consulta.isSuccess && consulta.data.dados.length === 0 && (
        <EstadoVazio
          icone={<Users className="h-8 w-8" aria-hidden />}
          titulo={vendoHistorico ? 'Nenhum vínculo encerrado' : 'Nenhum participante ainda'}
          descricao={
            vendoHistorico
              ? 'Quando alguém sair da monitoria, o vínculo aparecerá aqui.'
              : capacidades.habilitarMonitor
                ? 'Habilite um aluno como monitor ou inscreva monitorados para começar.'
                : 'Ainda não há participantes nesta monitoria.'
          }
          acao={
            capacidades.habilitarMonitor &&
            !vendoHistorico && (
              <Button
                onClick={() => setDialogoAberto(true)}
                iconeEsquerda={<UserPlus className="h-4 w-4" aria-hidden />}
              >
                Adicionar participante
              </Button>
            )
          }
        />
      )}

      {consulta.isSuccess && consulta.data.dados.length > 0 && (
        <Card>
          <ul className="divide-y divide-borda">
            {consulta.data.dados.map((participante) => (
              <LinhaParticipante
                key={participante.id}
                participante={participante}
                podeEncerrar={
                  participante.status === StatusParticipacao.ATIVO &&
                  // `participante.id` e `meuParticipanteId` são ambos ids de
                  // VÍNCULO. Comparar com `participante.alunoId` (id de usuário)
                  // seria a troca clássica deste contrato — e nunca casaria.
                  (capacidades.administrarMonitoria ||
                    participante.id === contexto.meuParticipanteId)
                }
                aoEncerrar={() => confirmacaoEncerrar.pedirConfirmacao(participante)}
                podePromover={
                  capacidades.habilitarMonitor &&
                  participante.status === StatusParticipacao.ATIVO &&
                  participante.papel === PapelMonitoria.MONITORADO
                }
                aoPromover={() => confirmacaoPromover.pedirConfirmacao(participante)}
              />
            ))}
          </ul>

          <CardConteudo className="pt-0">
            <Paginacao
              meta={consulta.data.meta}
              aoMudarPagina={(nova) => definir({ pagina: nova })}
              desabilitado={consulta.isFetching}
            />
          </CardConteudo>
        </Card>
      )}

      <DialogoConfirmacao
        aberto={confirmacaoEncerrar.aberto}
        aoFechar={confirmacaoEncerrar.fechar}
        aoConfirmar={() => encerrar.mutate(confirmacaoEncerrar.alvo!.id)}
        carregando={encerrar.isPending}
        titulo="Encerrar participação"
        descricao={`${confirmacaoEncerrar.alvo?.nomeAluno ?? 'O aluno'} perderá o acesso a esta monitoria.`}
        rotuloConfirmar="Encerrar vínculo"
        aviso="O vínculo não é apagado (RN10): ele vira histórico e continua sendo o sujeito dos atendimentos já registrados. Se houver atendimentos agendados ou inscrições ativas, o sistema recusará."
      />

      {/*
        O aviso de inscrições canceladas não é decoração: o backend cancela as
        inscrições ativas do aluno nesta monitoria dentro da mesma transação.
        Quem promove precisa saber disso ANTES, não descobrir pelo e-mail que o
        aluno recebeu.
      */}
      <DialogoConfirmacao
        aberto={confirmacaoPromover.aberto}
        aoFechar={confirmacaoPromover.fechar}
        aoConfirmar={() => promover.mutate(confirmacaoPromover.alvo!.id)}
        carregando={promover.isPending}
        titulo="Promover a monitor"
        descricao={`${confirmacaoPromover.alvo?.nomeAluno ?? 'O aluno'} passa a conduzir atendimentos nesta monitoria, em vez de recebê-los.`}
        rotuloConfirmar="Promover a monitor"
        aviso="O vínculo de monitorado é encerrado e vira histórico (RN10), e as inscrições ativas dele em atendimentos desta monitoria são canceladas — um aluno não acumula papéis (RN09). Ele é avisado por e-mail, com a explicação."
      />

      <DialogoAdicionarParticipante
        aberto={dialogoAberto}
        aoFechar={() => setDialogoAberto(false)}
        monitoriaId={monitoria.id}
      />
    </div>
  );
}

function LinhaParticipante({
  participante,
  podeEncerrar,
  aoEncerrar,
  podePromover,
  aoPromover,
}: {
  participante: Participante;
  podeEncerrar: boolean;
  aoEncerrar: () => void;
  podePromover: boolean;
  aoPromover: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primaria-suave text-xs font-semibold text-primaria"
        >
          {iniciais(participante.nomeAluno ?? '?')}
        </span>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-texto">
            {participante.nomeAluno ?? 'Aluno'}
          </p>
          <p className="truncate text-xs text-texto-suave">{participante.matricula}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <BadgePapel papel={participante.papel} />
        <BadgeStatusParticipacao status={participante.status} />

        {podePromover && (
          <Button
            variante="fantasma"
            tamanho="sm"
            onClick={aoPromover}
            iconeEsquerda={<ArrowUpCircle className="h-3.5 w-3.5" aria-hidden />}
          >
            Promover a monitor
          </Button>
        )}

        {podeEncerrar && (
          <Button
            variante="fantasma"
            tamanho="sm"
            onClick={aoEncerrar}
            iconeEsquerda={<LogOut className="h-3.5 w-3.5" aria-hidden />}
          >
            Encerrar
          </Button>
        )}
      </div>
    </li>
  );
}
