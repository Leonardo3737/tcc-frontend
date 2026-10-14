'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { CalendarPlus, Clock, Info } from 'lucide-react';

import { SemAcesso } from '@/components/autorizacao/sem-acesso';
import { Button } from '@/components/ui/button';
import { Card, CardCabecalho, CardConteudo } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/campo';
import { Alert } from '@/components/ui/alert';
import { Carregando } from '@/components/ui/estados';
import { toast } from '@/components/ui/toast';
import { agendarAtendimento } from '../api/atendimentos.service';
import { listarParticipantes } from '@/features/monitorias/api/monitorias.service';
import { listarDisponibilidades } from '@/features/disponibilidades/api/disponibilidades.service';
import { useContextoMonitoria } from '@/providers/monitoria-provider';
import { useSessao } from '@/providers/sessao-provider';
import { aplicarErroDeFormulario } from '@/lib/api/formulario';
import { chaves } from '@/lib/query/chaves';
import { rotas } from '@/config/rotas';
import {
  formatarDataHoraExtensa,
  formatarHoraSimples,
  instanteDeDataHoraLocal,
  nomeDoDiaSemana,
} from '@/lib/datas/fuso';
import {
  ModalidadeAtendimento,
  PapelMonitoria,
  StatusMonitoria,
  StatusParticipacao,
} from '@/types/dominio';

const CAMPOS = [
  'monitorParticipanteId',
  'inicio',
  'fim',
  'assunto',
  'modalidade',
  'local',
  'vagas',
] as const;

/**
 * Agendamento de atendimento.
 *
 * Duas variantes do mesmo formulario, decididas pelo PAPEL de quem agenda:
 *
 *  - MONITOR abre uma sessao: escolhe `vagas`, e o monitor da sessao e ele mesmo
 *    (o backend ignora `monitorParticipanteId` nesse caso — um monitor nunca
 *    ocupa a agenda de um colega);
 *  - MONITORADO solicita: precisa escolher o monitor, e ja entra inscrito.
 *
 * O professor responsavel nao aparece aqui: ele administra a monitoria, mas nao
 * tem vinculo que ocupe agenda (professorResponsavel: 'NEGADO' no backend).
 */
export function FormularioAgendamento() {
  const { monitoria, contexto, capacidades } = useContextoMonitoria();

  /**
   * A rota pode ser aberta pela URL; sem esta guarda, o professor (NEGADO no
   * backend) ou alguem numa monitoria nao ATIVA preencheria o formulario
   * inteiro para receber 403/409 no envio. A regra e a mesma do botao
   * "Agendar" (`capacidades.agendarAtendimento`).
   */
  if (!capacidades.agendarAtendimento) {
    return (
      <SemAcesso
        titulo="Você não pode agendar nesta monitoria"
        descricao={
          contexto.souResponsavel && !contexto.meuPapel
            ? 'O professor responsável administra a monitoria, mas não tem agenda: atendimentos são abertos por monitores e solicitados por monitorados.'
            : monitoria.status === StatusMonitoria.ATIVA
              ? 'Só monitores e monitorados desta monitoria agendam atendimentos.'
              : 'Atendimentos só podem ser agendados enquanto a monitoria está ativa.'
        }
      />
    );
  }

  return <ConteudoFormularioAgendamento />;
}

function ConteudoFormularioAgendamento() {
  const { monitoria, contexto } = useContextoMonitoria();
  const { fuso, configuracao } = useSessao();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);

  const souMonitor = contexto.meuPapel === PapelMonitoria.MONITOR;
  const limites = configuracao.agendamento;

  /**
   * Os limites vem de GET /configuracao — nao sao hardcoded. Se a instituicao
   * mudar a duracao maxima, o formulario acompanha sem alteracao de codigo.
   */
  const esquema = useMemo(
    () =>
      z
        .object({
          monitorParticipanteId: z.string(),
          data: z.string().min(1, 'Escolha a data'),
          horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido'),
          horaFim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido'),
          assunto: z
            .string()
            .trim()
            .min(3, 'O assunto deve ter ao menos 3 caracteres')
            .max(200, 'O assunto deve ter no máximo 200 caracteres'),
          modalidade: z.nativeEnum(ModalidadeAtendimento),
          local: z.string().trim().max(150, 'Máximo de 150 caracteres').optional(),
          vagas: z.coerce.number().int().min(1, 'Mínimo de 1 vaga').max(50, 'Máximo de 50 vagas'),
        })
        .refine((dados) => souMonitor || dados.monitorParticipanteId.length > 0, {
          path: ['monitorParticipanteId'],
          message: 'Escolha o monitor que vai atender',
        })
        .refine((dados) => dados.horaFim > dados.horaInicio, {
          path: ['horaFim'],
          message: 'O fim deve ser depois do início',
        })
        .refine(
          (dados) => {
            const minutos = diferencaEmMinutos(dados.horaInicio, dados.horaFim);
            return minutos >= limites.duracaoMinimaMinutos;
          },
          {
            path: ['horaFim'],
            message: `A duração mínima é de ${limites.duracaoMinimaMinutos} minutos`,
          },
        )
        .refine(
          (dados) =>
            diferencaEmMinutos(dados.horaInicio, dados.horaFim) <= limites.duracaoMaximaMinutos,
          {
            path: ['horaFim'],
            message: `A duração máxima é de ${limites.duracaoMaximaMinutos} minutos`,
          },
        ),
    [souMonitor, limites],
  );

  type DadosAgendamentoForm = z.infer<typeof esquema>;

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosAgendamentoForm>({
    resolver: zodResolver(esquema),
    mode: 'onBlur',
    defaultValues: {
      monitorParticipanteId: souMonitor ? (contexto.meuParticipanteId ?? '') : '',
      data: '',
      horaInicio: '',
      horaFim: '',
      assunto: '',
      modalidade: ModalidadeAtendimento.PRESENCIAL,
      local: '',
      vagas: 1,
    },
  });

  const valores = useWatch({ control });

  /** Monitores ATIVOS: são eles que podem conduzir a sessão (RN01/RN04). */
  const monitores = useQuery({
    queryKey: chaves.monitorias.participantes(monitoria.id, { papel: 'MONITOR', status: 'ATIVO' }),
    enabled: !souMonitor,
    queryFn: () =>
      listarParticipantes(monitoria.id, {
        papel: PapelMonitoria.MONITOR,
        status: StatusParticipacao.ATIVO,
        limite: 100,
      }),
  });

  const monitorEscolhido: string | undefined = souMonitor
    ? (contexto.meuParticipanteId ?? undefined)
    : valores.monitorParticipanteId || undefined;

  /**
   * Vitrine de horários do monitor escolhido.
   *
   * Não é decoração: o backend recusa qualquer agendamento fora de uma faixa
   * ativa. Sem mostrar as faixas, o usuário só descobriria isso pelo erro.
   */
  const disponibilidades = useQuery({
    queryKey: chaves.monitorias.disponibilidades(monitoria.id, {
      participanteId: monitorEscolhido,
    }),
    enabled: Boolean(monitorEscolhido),
    queryFn: () =>
      listarDisponibilidades(monitoria.id, { participanteId: monitorEscolhido, ativa: true }),
  });

  const mutacao = useMutation({
    mutationFn: (dados: DadosAgendamentoForm) => {
      /**
       * O instante é montado no fuso da INSTITUIÇÃO, nunca no do navegador.
       * O backend valida a janela com AT TIME ZONE nesse mesmo fuso; usar o fuso
       * local produziria "horário fora da disponibilidade" sem explicação para
       * quem estivesse em outro fuso.
       */
      const inicio = instanteDeDataHoraLocal(dados.data, dados.horaInicio, fuso);
      const fim = instanteDeDataHoraLocal(dados.data, dados.horaFim, fuso);

      if (!inicio || !fim) {
        throw new Error('Data ou horário inválidos.');
      }

      return agendarAtendimento(monitoria.id, {
        ...(souMonitor ? {} : { monitorParticipanteId: dados.monitorParticipanteId }),
        inicio,
        fim,
        assunto: dados.assunto,
        modalidade: dados.modalidade,
        ...(dados.local ? { local: dados.local } : {}),
        // Só o monitor define capacidade; a solicitação do aluno é individual.
        ...(souMonitor ? { vagas: dados.vagas } : {}),
      });
    },

    onSuccess: (atendimento) => {
      void queryClient.invalidateQueries({ queryKey: chaves.atendimentos.raiz });
      void queryClient.invalidateQueries({ queryKey: chaves.monitorias.escopo(monitoria.id) });

      toast.sucesso(
        souMonitor ? 'Sessão aberta' : 'Atendimento solicitado',
        souMonitor
          ? 'Os monitorados já podem se inscrever.'
          : 'Você já está inscrito neste atendimento.',
      );

      router.replace(rotas.atendimento(atendimento.id));
    },

    onError: (erro) => {
      setConfirmando(false);
      /**
       * Os 409 possíveis aqui, todos vindos de constraint ou de regra do service:
       *  - conflito de agenda do monitor ou do aluno (RN03, EXCLUDE);
       *  - horário fora da disponibilidade declarada;
       *  - monitoria não está ATIVA.
       * As mensagens do backend já são de domínio; exibimos como vieram.
       */
      aplicarErroDeFormulario(erro, setError, CAMPOS);
    },
  });

  const enviando = isSubmitting || mutacao.isPending;

  const podeResumir =
    Boolean(valores.data) &&
    Boolean(valores.horaInicio) &&
    Boolean(valores.horaFim) &&
    Boolean(valores.assunto) &&
    (souMonitor || Boolean(valores.monitorParticipanteId));

  const instantePrevisto =
    valores.data && valores.horaInicio
      ? instanteDeDataHoraLocal(valores.data, valores.horaInicio, fuso)
      : null;

  if (!souMonitor && monitores.isPending) {
    return <Carregando rotulo="Carregando monitores…" />;
  }

  if (!souMonitor && monitores.isSuccess && monitores.data.dados.length === 0) {
    return (
      <Alert tom="alerta" titulo="Nenhum monitor habilitado">
        Esta monitoria ainda não tem monitores ativos, então não há a quem solicitar atendimento. O
        professor responsável é quem habilita monitores.
      </Alert>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardCabecalho
          titulo={souMonitor ? 'Abrir sessão de atendimento' : 'Solicitar atendimento'}
          descricao={
            souMonitor
              ? 'Você conduzirá esta sessão. Defina a capacidade para receber vários monitorados.'
              : 'Escolha o monitor e um horário dentro da disponibilidade dele.'
          }
        />

        <CardConteudo>
          <form
            onSubmit={handleSubmit((dados) => {
              if (!confirmando) {
                setConfirmando(true);
                return;
              }
              mutacao.mutate(dados);
            })}
            className="space-y-4"
            noValidate
          >
            {errors.root && (
              <Alert tom="erro" titulo="Não foi possível agendar">
                {errors.root.message}
              </Alert>
            )}

            {!souMonitor && (
              <Select
                label="Monitor"
                obrigatorio
                placeholder="Selecione o monitor"
                erro={errors.monitorParticipanteId?.message}
                opcoes={(monitores.data?.dados ?? []).map((participante) => ({
                  // O valor é o id do VÍNCULO — é o que o backend espera.
                  valor: participante.id,
                  rotulo: participante.nomeAluno ?? 'Monitor',
                }))}
                {...register('monitorParticipanteId')}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Data"
                type="date"
                obrigatorio
                erro={errors.data?.message}
                {...register('data')}
              />
              <Input
                label="Início"
                type="time"
                obrigatorio
                erro={errors.horaInicio?.message}
                {...register('horaInicio')}
              />
              <Input
                label="Término"
                type="time"
                obrigatorio
                erro={errors.horaFim?.message}
                {...register('horaFim')}
              />
            </div>

            <p className="text-xs text-texto-suave">
              Horários no fuso da instituição ({fuso}). Duração entre {limites.duracaoMinimaMinutos}{' '}
              e {limites.duracaoMaximaMinutos} minutos.
            </p>

            <Textarea
              label="Assunto"
              rows={3}
              obrigatorio
              placeholder="Ex.: dúvidas sobre limites e continuidade"
              erro={errors.assunto?.message}
              {...register('assunto')}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Modalidade"
                obrigatorio
                erro={errors.modalidade?.message}
                opcoes={[
                  { valor: ModalidadeAtendimento.PRESENCIAL, rotulo: 'Presencial' },
                  { valor: ModalidadeAtendimento.REMOTO, rotulo: 'Remoto' },
                ]}
                {...register('modalidade')}
              />

              <Input
                label={valores.modalidade === ModalidadeAtendimento.REMOTO ? 'Link' : 'Local'}
                placeholder={
                  valores.modalidade === ModalidadeAtendimento.REMOTO
                    ? 'https://meet.exemplo/abc'
                    : 'Sala 203'
                }
                ajuda="Opcional."
                erro={errors.local?.message}
                {...register('local')}
              />
            </div>

            {souMonitor && (
              <Input
                label="Vagas"
                type="number"
                min={1}
                max={50}
                obrigatorio
                ajuda="1 = atendimento individual. Acima disso, a sessão aceita inscrições."
                erro={errors.vagas?.message}
                {...register('vagas')}
              />
            )}

            {/* Resumo antes de confirmar: o passo que evita o agendamento no dia errado. */}
            {confirmando && podeResumir && instantePrevisto && (
              <Alert tom="info" titulo="Confirme o agendamento">
                <ul className="mt-1 space-y-0.5 text-sm">
                  <li>
                    <strong>{formatarDataHoraExtensa(instantePrevisto, fuso)}</strong> às{' '}
                    {valores.horaFim}
                  </li>
                  <li>{valores.assunto}</li>
                  <li>
                    {valores.modalidade === ModalidadeAtendimento.REMOTO ? 'Remoto' : 'Presencial'}
                    {valores.local ? ` · ${valores.local}` : ''}
                  </li>
                  {souMonitor && (
                    <li>
                      {Number(valores.vagas) > 1
                        ? `Sessão em grupo · ${valores.vagas} vagas`
                        : 'Atendimento individual'}
                    </li>
                  )}
                </ul>
              </Alert>
            )}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              {confirmando && (
                <Button
                  variante="secundaria"
                  onClick={() => setConfirmando(false)}
                  disabled={enviando}
                >
                  Revisar
                </Button>
              )}

              <Button
                type="submit"
                carregando={enviando}
                iconeEsquerda={<CalendarPlus className="h-4 w-4" aria-hidden />}
              >
                {enviando
                  ? 'Agendando…'
                  : confirmando
                    ? 'Confirmar agendamento'
                    : souMonitor
                      ? 'Revisar sessão'
                      : 'Revisar solicitação'}
              </Button>
            </div>
          </form>
        </CardConteudo>
      </Card>

      <Card className="h-fit">
        <CardCabecalho titulo="Disponibilidade do monitor" />
        <CardConteudo>
          {!monitorEscolhido && (
            <p className="text-sm text-texto-suave">
              Selecione um monitor para ver os horários em que ele atende.
            </p>
          )}

          {monitorEscolhido && disponibilidades.isPending && (
            <Carregando rotulo="Carregando horários…" />
          )}

          {disponibilidades.isSuccess && disponibilidades.data.length === 0 && (
            <Alert tom="alerta">
              Este monitor ainda não declarou horários. Sem uma faixa ativa, o backend recusa o
              agendamento.
            </Alert>
          )}

          {disponibilidades.isSuccess && disponibilidades.data.length > 0 && (
            <>
              <ul className="space-y-2">
                {disponibilidades.data.map((faixa) => (
                  <li
                    key={faixa.id}
                    className="flex items-center gap-2 rounded-lg border border-borda px-3 py-2 text-sm"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-texto-suave" aria-hidden />
                    <span className="capitalize text-texto">
                      {nomeDoDiaSemana(faixa.diaSemana)}
                    </span>
                    <span className="ml-auto font-mono text-xs text-texto-suave">
                      {formatarHoraSimples(faixa.horaInicio)}–{formatarHoraSimples(faixa.horaFim)}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-3 flex gap-2 text-xs text-texto-suave">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />O atendimento precisa caber
                inteiro dentro de uma dessas faixas, no mesmo dia.
              </p>
            </>
          )}
        </CardConteudo>
      </Card>
    </div>
  );
}

function diferencaEmMinutos(inicio: string, fim: string): number {
  const [hi, mi] = inicio.split(':').map(Number);
  const [hf, mf] = fim.split(':').map(Number);

  if (hi === undefined || mi === undefined || hf === undefined || mf === undefined) return 0;

  return hf * 60 + mf - (hi * 60 + mi);
}
