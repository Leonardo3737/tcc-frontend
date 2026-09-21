'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/campo';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { EstadoErro, EstadoVazio } from '@/components/ui/estados';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogConteudo } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { DialogoConfirmacao, useConfirmacao } from '@/components/comum/confirmacao';
import {
  criarDisponibilidade,
  desativarDisponibilidade,
  listarDisponibilidades,
} from '../api/disponibilidades.service';
import { useContextoMonitoria } from '@/providers/monitoria-provider';
import { useSessao } from '@/providers/sessao-provider';
import { aplicarErroDeFormulario } from '@/lib/api/formulario';
import { mensagemDeErro } from '@/lib/api/erros';
import { chaves } from '@/lib/query/chaves';
import { formatarHoraSimples, nomeDoDiaSemana } from '@/lib/datas/fuso';
import type { Disponibilidade, DiaSemana } from '@/types/dominio';

const DIAS: DiaSemana[] = [0, 1, 2, 3, 4, 5, 6];

/**
 * Agenda semanal declarada.
 *
 * No desktop e uma grade de 7 colunas; no mobile vira lista agrupada por dia —
 * sete colunas em 375px sao ilegiveis.
 */
export function PainelDisponibilidades() {
  const { monitoria, capacidades, contexto } = useContextoMonitoria();
  const { fuso } = useSessao();
  const queryClient = useQueryClient();
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [incluirInativas, setIncluirInativas] = useState(false);
  const confirmacaoDesativar = useConfirmacao<Disponibilidade>();

  const filtro = { ativa: incluirInativas ? undefined : true };

  const consulta = useQuery({
    queryKey: chaves.monitorias.disponibilidades(monitoria.id, filtro),
    queryFn: () => listarDisponibilidades(monitoria.id, filtro),
  });

  const desativar = useMutation({
    mutationFn: (disponibilidadeId: string) =>
      desativarDisponibilidade(monitoria.id, disponibilidadeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: chaves.monitorias.escopo(monitoria.id),
      });
      toast.sucesso('Horário desativado', 'A faixa sai da vitrine, mas o histórico é preservado.');
      confirmacaoDesativar.fechar();
    },
    onError: (erro) => toast.erro('Não foi possível desativar', mensagemDeErro(erro)),
  });

  const porDia = useMemo(() => {
    const mapa = new Map<DiaSemana, Disponibilidade[]>();
    for (const dia of DIAS) mapa.set(dia, []);

    for (const faixa of consulta.data ?? []) {
      mapa.get(faixa.diaSemana)?.push(faixa);
    }

    return mapa;
  }, [consulta.data]);

  const total = consulta.data?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-texto-suave">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-borda text-primaria"
            checked={incluirInativas}
            onChange={(evento) => setIncluirInativas(evento.target.checked)}
          />
          Mostrar horários desativados
        </label>

        {capacidades.declararDisponibilidade && (
          <Button
            onClick={() => setDialogoAberto(true)}
            iconeEsquerda={<Plus className="h-4 w-4" aria-hidden />}
          >
            Adicionar horário
          </Button>
        )}
      </div>

      <Alert tom="info">
        Os horários são interpretados no fuso da instituição ({fuso}) e valem como
        recorrência semanal. Um atendimento só pode ser agendado dentro de uma faixa ativa.
      </Alert>

      {consulta.isPending && (
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
          {DIAS.map((dia) => (
            <Skeleton key={dia} className="h-32" />
          ))}
        </div>
      )}

      {consulta.isError && (
        <EstadoErro erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      )}

      {consulta.isSuccess && total === 0 && (
        <EstadoVazio
          icone={<CalendarClock className="h-8 w-8" aria-hidden />}
          titulo="Nenhum horário declarado"
          descricao={
            capacidades.declararDisponibilidade
              ? 'Declare suas faixas semanais para que os monitorados possam solicitar atendimento.'
              : contexto.souResponsavel
                ? 'Os monitores desta monitoria ainda não declararam horários.'
                : 'Os monitores ainda não declararam horários de atendimento.'
          }
          acao={
            capacidades.declararDisponibilidade && (
              <Button
                onClick={() => setDialogoAberto(true)}
                iconeEsquerda={<Plus className="h-4 w-4" aria-hidden />}
              >
                Adicionar horário
              </Button>
            )
          }
        />
      )}

      {consulta.isSuccess && total > 0 && (
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
          {DIAS.map((dia) => {
            const faixas = porDia.get(dia) ?? [];

            // No mobile, dias vazios só ocupariam espaço de rolagem.
            if (faixas.length === 0) {
              return (
                <Card key={dia} className="hidden lg:block">
                  <div className="border-b border-borda px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                      {nomeDoDiaSemana(dia).slice(0, 3)}
                    </p>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-texto-suave/70">—</p>
                  </div>
                </Card>
              );
            }

            return (
              <Card key={dia}>
                <div className="border-b border-borda px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                    <span className="lg:hidden">{nomeDoDiaSemana(dia)}</span>
                    <span className="hidden lg:inline">{nomeDoDiaSemana(dia).slice(0, 3)}</span>
                  </p>
                </div>

                <ul className="divide-y divide-borda">
                  {faixas.map((faixa) => {
                    const minha = faixa.participanteId === contexto.meuParticipanteId;

                    return (
                      <li key={faixa.id} className="space-y-1.5 p-3">
                        <p className="font-mono text-sm text-texto">
                          {formatarHoraSimples(faixa.horaInicio)}–
                          {formatarHoraSimples(faixa.horaFim)}
                        </p>

                        <p className="truncate text-xs text-texto-suave">
                          {faixa.nomeMonitor ?? 'Monitor'}
                        </p>

                        {!faixa.ativa && <Badge tom="neutro">Desativado</Badge>}

                        {/* Só o dono desativa a própria faixa. */}
                        {minha && faixa.ativa && capacidades.declararDisponibilidade && (
                          <Button
                            variante="fantasma"
                            tamanho="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => confirmacaoDesativar.pedirConfirmacao(faixa)}
                            iconeEsquerda={<Trash2 className="h-3 w-3" aria-hidden />}
                          >
                            Desativar
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <DialogoConfirmacao
        aberto={confirmacaoDesativar.aberto}
        aoFechar={confirmacaoDesativar.fechar}
        aoConfirmar={() => desativar.mutate(confirmacaoDesativar.alvo!.id)}
        carregando={desativar.isPending}
        titulo="Desativar horário"
        descricao={
          confirmacaoDesativar.alvo
            ? `${nomeDoDiaSemana(confirmacaoDesativar.alvo.diaSemana)}, ${formatarHoraSimples(confirmacaoDesativar.alvo.horaInicio)}–${formatarHoraSimples(confirmacaoDesativar.alvo.horaFim)} deixará de aceitar novos agendamentos.`
            : ''
        }
        rotuloConfirmar="Desativar"
        aviso="A faixa não é apagada: atendimentos já agendados foram validados contra ela, e o registro preserva essa justificativa (RN10)."
      />

      <DialogoNovaFaixa
        aberto={dialogoAberto}
        aoFechar={() => setDialogoAberto(false)}
        monitoriaId={monitoria.id}
      />
    </div>
  );
}

/**
 * Espelha criar-disponibilidade.dto.ts.
 *
 * `horaFim > horaInicio` e validado aqui e tambem no banco (CHECK). A
 * SOBREPOSICAO com outra faixa, porem, nao e checada no cliente de proposito:
 * ela depende do estado do servidor e e garantida por uma constraint EXCLUDE —
 * qualquer verificacao local seria uma segunda fonte de verdade, sujeita a ficar
 * desatualizada entre a leitura e o envio.
 */
const esquemaFaixa = z
  .object({
    diaSemana: z.coerce.number().int().min(0).max(6),
    horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido'),
    horaFim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido'),
  })
  .refine((dados) => dados.horaFim > dados.horaInicio, {
    path: ['horaFim'],
    message: 'O fim deve ser depois do início',
  });

type DadosFaixa = z.infer<typeof esquemaFaixa>;

function DialogoNovaFaixa({
  aberto,
  aoFechar,
  monitoriaId,
}: {
  aberto: boolean;
  aoFechar: () => void;
  monitoriaId: string;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosFaixa>({
    resolver: zodResolver(esquemaFaixa),
    mode: 'onBlur',
    defaultValues: { diaSemana: 1, horaInicio: '14:00', horaFim: '16:00' },
  });

  const mutacao = useMutation({
    mutationFn: (dados: DadosFaixa) =>
      criarDisponibilidade(monitoriaId, {
        diaSemana: dados.diaSemana as DiaSemana,
        horaInicio: dados.horaInicio,
        horaFim: dados.horaFim,
      }),

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: chaves.monitorias.escopo(monitoriaId),
      });
      toast.sucesso('Horário adicionado');
      reset();
      aoFechar();
    },

    // 409 = a faixa se sobrepõe a outra já cadastrada
    // (constraint ex_disponibilidade_sem_sobreposicao).
    onError: (erro) =>
      aplicarErroDeFormulario(erro, setError, ['diaSemana', 'horaInicio', 'horaFim']),
  });

  const enviando = isSubmitting || mutacao.isPending;

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && aoFechar()}>
      {aberto && (
        <DialogConteudo
          titulo="Adicionar horário"
          descricao="A faixa se repete toda semana neste dia."
        >
          <form
            onSubmit={handleSubmit((dados) => mutacao.mutate(dados))}
            className="space-y-4"
            noValidate
          >
            {errors.root && <Alert tom="erro">{errors.root.message}</Alert>}

            <Select
              label="Dia da semana"
              obrigatorio
              autoFocus
              erro={errors.diaSemana?.message}
              opcoes={DIAS.map((dia) => ({ valor: String(dia), rotulo: nomeDoDiaSemana(dia) }))}
              {...register('diaSemana')}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Início"
                type="time"
                obrigatorio
                erro={errors.horaInicio?.message}
                {...register('horaInicio')}
              />
              <Input
                label="Fim"
                type="time"
                obrigatorio
                erro={errors.horaFim?.message}
                {...register('horaFim')}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variante="secundaria" onClick={aoFechar} disabled={enviando}>
                Cancelar
              </Button>
              <Button type="submit" carregando={enviando}>
                {enviando ? 'Adicionando…' : 'Adicionar'}
              </Button>
            </div>
          </form>
        </DialogConteudo>
      )}
    </Dialog>
  );
}
