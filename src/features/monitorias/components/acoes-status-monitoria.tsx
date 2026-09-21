'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogConteudo } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/campo';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/components/ui/toast';
import { DialogoConfirmacao } from '@/components/comum/confirmacao';
import {
  ativarMonitoria,
  cancelarMonitoria,
  encerrarMonitoria,
} from '../api/monitorias.service';
import { useContextoMonitoria } from '@/providers/monitoria-provider';
import { ApiError, mensagemDeErro } from '@/lib/api/erros';
import { chaves } from '@/lib/query/chaves';
import { StatusMonitoria } from '@/types/dominio';

/**
 * Transicoes de estado da monitoria.
 *
 * Sao operacoes de dominio (`/ativar`, `/encerrar`, `/cancelar`), nao um PATCH
 * em `status`: cada uma tem pre-condicoes proprias, e cancelar exige motivo.
 * A maquina de estados do backend e PLANEJADA -> ATIVA -> ENCERRADA, com
 * CANCELADA acessivel enquanto nao encerrada.
 */
export function AcoesStatusMonitoria() {
  const { monitoria, capacidades } = useContextoMonitoria();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [dialogoCancelar, setDialogoCancelar] = useState(false);
  const [dialogoEncerrar, setDialogoEncerrar] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erroCancelamento, setErroCancelamento] = useState<string | null>(null);

  const atualizar = () => {
    void queryClient.invalidateQueries({ queryKey: chaves.monitorias.raiz });
    router.refresh();
  };

  const ativar = useMutation({
    mutationFn: () => ativarMonitoria(monitoria.id),
    onSuccess: () => {
      toast.sucesso('Monitoria ativada', 'Agora ela aceita agendamento de atendimentos.');
      atualizar();
    },
    onError: (erro) => toast.erro(mensagemDeErro(erro)),
  });

  const encerrar = useMutation({
    mutationFn: () => encerrarMonitoria(monitoria.id),
    onSuccess: () => {
      toast.sucesso('Monitoria encerrada', 'Os vínculos ativos foram encerrados. Nada foi apagado.');
      setDialogoEncerrar(false);
      atualizar();
    },
    /**
     * 409 aqui tem um significado só: existem atendimentos AGENDADOS. O backend
     * se recusa a cancelá-los em cascata — cancelar compromissos de outras
     * pessoas sem que ninguém decida isso seria destruir informação em silêncio.
     * A mensagem já diz quantos são.
     */
    onError: (erro) => {
      const conflito = erro instanceof ApiError && erro.ehConflito;
      toast.erro(
        conflito ? 'Ainda há atendimentos agendados' : 'Não foi possível encerrar',
        mensagemDeErro(erro),
      );
    },
  });

  const cancelar = useMutation({
    mutationFn: () => cancelarMonitoria(monitoria.id, motivo.trim()),
    onSuccess: () => {
      toast.sucesso('Monitoria cancelada', 'O motivo ficou registrado na descrição.');
      setDialogoCancelar(false);
      setMotivo('');
      atualizar();
    },
    onError: (erro) => setErroCancelamento(mensagemDeErro(erro)),
  });

  const ocupado = ativar.isPending || encerrar.isPending || cancelar.isPending;

  /**
   * As saídas antecipadas ficam DEPOIS de todos os hooks.
   *
   * `capacidades.administrarMonitoria` muda quando o contexto da monitoria é
   * revalidado; um `return null` antes dos `useMutation` alteraria a quantidade
   * de hooks entre renderizações — que é justamente o que quebra o React.
   */
  if (!capacidades.administrarMonitoria) return null;

  const podeAtivar = monitoria.status === StatusMonitoria.PLANEJADA;
  const podeEncerrar = monitoria.status === StatusMonitoria.ATIVA;
  const podeCancelar =
    monitoria.status === StatusMonitoria.PLANEJADA || monitoria.status === StatusMonitoria.ATIVA;

  // Estados terminais não têm transição de saída: some com a barra inteira.
  if (!podeAtivar && !podeEncerrar && !podeCancelar) return null;

  const motivoValido = motivo.trim().length >= 5 && motivo.trim().length <= 500;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {podeAtivar && (
          <Button
            tamanho="sm"
            carregando={ativar.isPending}
            disabled={ocupado}
            onClick={() => ativar.mutate()}
            iconeEsquerda={<Play className="h-4 w-4" aria-hidden />}
          >
            Ativar
          </Button>
        )}

        {podeEncerrar && (
          <Button
            variante="secundaria"
            tamanho="sm"
            disabled={ocupado}
            onClick={() => setDialogoEncerrar(true)}
            iconeEsquerda={<CheckCircle2 className="h-4 w-4" aria-hidden />}
          >
            Encerrar
          </Button>
        )}

        {podeCancelar && (
          <Button
            variante="secundaria"
            tamanho="sm"
            disabled={ocupado}
            onClick={() => {
              setErroCancelamento(null);
              setDialogoCancelar(true);
            }}
            iconeEsquerda={<Ban className="h-4 w-4" aria-hidden />}
          >
            Cancelar monitoria
          </Button>
        )}
      </div>

      <DialogoConfirmacao
        aberto={dialogoEncerrar}
        aoFechar={() => setDialogoEncerrar(false)}
        aoConfirmar={() => encerrar.mutate()}
        carregando={encerrar.isPending}
        destrutivo={false}
        titulo="Encerrar monitoria"
        descricao="Encerrar arquiva a oferta: todos os vínculos ativos passam a ENCERRADO."
        rotuloConfirmar="Encerrar"
        aviso="Nada é apagado (RN10) — participantes, atendimentos e materiais continuam consultáveis. Se houver atendimentos AGENDADOS, o backend recusará: cancele cada um antes, para que fiquem no histórico com motivo próprio."
      />

      <Dialog open={dialogoCancelar} onOpenChange={(aberto) => !aberto && setDialogoCancelar(false)}>
        {dialogoCancelar && (
          <DialogConteudo
            titulo="Cancelar monitoria"
            descricao="O registro é preservado: a monitoria continua consultável, com o motivo do cancelamento."
            rodape={
              <>
                <Button
                  variante="secundaria"
                  onClick={() => setDialogoCancelar(false)}
                  disabled={cancelar.isPending}
                >
                  Voltar
                </Button>
                <Button
                  variante="perigo"
                  carregando={cancelar.isPending}
                  disabled={!motivoValido}
                  onClick={() => cancelar.mutate()}
                >
                  Confirmar cancelamento
                </Button>
              </>
            }
          >
            <div className="space-y-3">
              {erroCancelamento && <Alert tom="erro">{erroCancelamento}</Alert>}

              <Textarea
                label="Motivo do cancelamento"
                obrigatorio
                autoFocus
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                ajuda="Entre 5 e 500 caracteres. Fica registrado permanentemente."
                erro={
                  motivo.length > 0 && !motivoValido
                    ? 'O motivo deve ter entre 5 e 500 caracteres'
                    : undefined
                }
                placeholder="Ex.: monitor desistiu e não houve substituto."
              />

              <Alert tom="alerta">
                Se houver atendimentos <strong>AGENDADOS</strong>, o cancelamento será recusado.
                Cancele cada atendimento antes — assim cada um fica no histórico com motivo próprio.
              </Alert>
            </div>
          </DialogConteudo>
        )}
      </Dialog>
    </>
  );
}
