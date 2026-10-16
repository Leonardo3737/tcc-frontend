'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarPlus, Check, Clock, Info, Pencil, Repeat, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { SemAcesso } from '@/components/autorizacao/sem-acesso';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/campo';
import { Card, CardCabecalho, CardConteudo } from '@/components/ui/card';
import { Carregando } from '@/components/ui/estados';
import { toast } from '@/components/ui/toast';
import { rotas } from '@/config/rotas';
import { listarDisponibilidades } from '@/features/disponibilidades/api/disponibilidades.service';
import { listarParticipantes } from '@/features/monitorias/api/monitorias.service';
import { aplicarErroDeFormulario } from '@/lib/api/formulario';
import {
  formatarDataHoraExtensa,
  formatarHoraSimples,
  instanteDeDataHoraLocal,
  noFuso,
  nomeDoDiaSemana,
} from '@/lib/datas/fuso';
import { ocorrenciasSemanais } from '@/lib/datas/recorrencia';
import { descreverDataRelativa } from '@/lib/datas/relativa';
import { chaves } from '@/lib/query/chaves';
import { useContextoMonitoria } from '@/providers/monitoria-provider';
import { useSessao } from '@/providers/sessao-provider';
import {
  ModalidadeAtendimento,
  PapelMonitoria,
  StatusMonitoria,
  StatusParticipacao,
  type HorarioLivre,
  type LoteDeAtendimentos,
} from '@/types/dominio';
import { agendarAtendimento, agendarAtendimentosEmLote } from '../api/atendimentos.service';
import { HorariosOcupados } from './horarios-ocupados';
import { SeletorDeDuracao, SeletorDeHorario, duracoesDisponiveis } from './seletor-de-horario';

const CAMPOS = [
  'monitorParticipanteId',
  'inicio',
  'fim',
  'assunto',
  'modalidade',
  'local',
  'vagas',
] as const;

/** Teto do backend para uma série (`@ArrayMaxSize(30)`). */
const MAX_OCORRENCIAS = 30;

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
  /** Slot vindo de A1. Null quando o horário foi digitado à mão. */
  const [horarioEscolhido, setHorarioEscolhido] = useState<HorarioLivre | null>(null);
  const [modoManual, setModoManual] = useState(false);
  const [repeticoes, setRepeticoes] = useState(1);
  const [relatorio, setRelatorio] = useState<LoteDeAtendimentos | null>(null);

  const souMonitor = contexto.meuPapel === PapelMonitoria.MONITOR;
  const limites = configuracao.agendamento;

  const opcoesDeDuracao = useMemo(() => duracoesDisponiveis(limites), [limites]);

  /**
   * A duração inicial sai da LISTA, não direto da configuração: assim o botão
   * marcado é sempre um dos que existem. Pegar `duracaoPadraoMinutos` direto
   * deixaria a seleção fora da lista se o campo viesse ausente da API.
   */
  const [duracao, setDuracao] = useState(
    () => opcoesDeDuracao.find((minutos) => minutos === limites.duracaoPadraoMinutos)
      ?? opcoesDeDuracao[0]!,
  );

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
    setValue,
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

  const campoMonitor = register('monitorParticipanteId');
  const listaDeMonitores = monitores.data?.dados ?? [];
  const monitorUnico =
    !souMonitor && listaDeMonitores.length === 1 ? (listaDeMonitores[0] ?? null) : null;

  /**
   * Monitor único entra pré-selecionado: um `<select>` de uma opção só não é
   * escolha, é atrito. Feito por `setValue` e não por `value` controlado — o
   * campo é do React Hook Form, e misturar os dois modelos faz o formulário
   * enviar um valor diferente do que está na tela.
   */
  useEffect(() => {
    if (monitorUnico && !valores.monitorParticipanteId) {
      setValue('monitorParticipanteId', monitorUnico.id, { shouldValidate: true });
    }
  }, [monitorUnico, valores.monitorParticipanteId, setValue]);

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

  /**
   * Preenche os três campos de horário a partir do slot clicado.
   *
   * O seletor é um MÉTODO DE ENTRADA desses campos, não um caminho paralelo:
   * validação, resumo de confirmação e envio continuam lendo `data`,
   * `horaInicio` e `horaFim`. Dois caminhos divergiriam no primeiro ajuste.
   */
  const escolherHorario = (horario: HorarioLivre) => {
    const inicioLocal = noFuso(horario.inicio, fuso);
    const fimLocal = noFuso(horario.fim, fuso);

    setHorarioEscolhido(horario);
    setValue('data', format(inicioLocal, 'yyyy-MM-dd'), { shouldValidate: true });
    setValue('horaInicio', format(inicioLocal, 'HH:mm'), { shouldValidate: true });
    setValue('horaFim', format(fimLocal, 'HH:mm'), { shouldValidate: true });

    // Sem monitor fixo, o slot também decide quem atende.
    if (!souMonitor) {
      setValue('monitorParticipanteId', horario.monitorParticipanteId, { shouldValidate: true });
    }

    setConfirmando(false);
  };

  const trocarDuracao = (minutos: number) => {
    setDuracao(minutos);
    // O slot anterior tinha outra duração; mantê-lo marcado seria mentira.
    setHorarioEscolhido(null);
  };

  const montarInstantes = (dados: DadosAgendamentoForm) => {
    /**
     * O instante é montado no fuso da INSTITUIÇÃO, nunca no do navegador.
     * O backend valida a janela com AT TIME ZONE nesse mesmo fuso; usar o fuso
     * local produziria "horário fora da disponibilidade" sem explicação para
     * quem estivesse em outro fuso.
     */
    const inicio = instanteDeDataHoraLocal(dados.data, dados.horaInicio, fuso);
    const fim = instanteDeDataHoraLocal(dados.data, dados.horaFim, fuso);

    if (!inicio || !fim) throw new Error('Data ou horário inválidos.');

    return { inicio, fim };
  };

  const mutacao = useMutation({
    mutationFn: (dados: DadosAgendamentoForm) => {
      const { inicio, fim } = montarInstantes(dados);

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
      invalidar();

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
      // O slot pode ter sido tomado entre a listagem e o envio: recarrega.
      void queryClient.invalidateQueries({ queryKey: chaves.monitorias.escopo(monitoria.id) });
    },
  });

  /**
   * A2 — série recorrente.
   *
   * Separada da mutação avulsa de propósito: o lote tem SUCESSO PARCIAL, então
   * "não lançou exceção" não significa "deu tudo certo". Tratar as duas no mesmo
   * `onSuccess` esconderia as recusas atrás de um toast verde.
   */
  const mutacaoLote = useMutation({
    mutationFn: (dados: DadosAgendamentoForm) => {
      const { inicio, fim } = montarInstantes(dados);
      const ocorrencias = ocorrenciasSemanais(inicio, fim, repeticoes, fuso);

      return agendarAtendimentosEmLote(monitoria.id, {
        ...(souMonitor ? {} : { monitorParticipanteId: dados.monitorParticipanteId }),
        assunto: dados.assunto,
        modalidade: dados.modalidade,
        ...(dados.local ? { local: dados.local } : {}),
        ...(souMonitor ? { vagas: dados.vagas } : {}),
        ocorrencias,
      });
    },

    onSuccess: (resultado) => {
      invalidar();
      setConfirmando(false);

      // Série inteira criada: não há nada a revisar, segue para a agenda.
      if (resultado.recusados === 0) {
        toast.sucesso(
          `${resultado.criados} sessões abertas`,
          'Os monitorados receberam um único aviso, com todas as datas.',
        );
        router.replace(rotas.monitoriaAtendimentos(monitoria.id));
        return;
      }

      // Com recusas, a pessoa precisa VER quais datas ficaram de fora.
      setRelatorio(resultado);
    },

    onError: (erro) => {
      setConfirmando(false);
      aplicarErroDeFormulario(erro, setError, CAMPOS);
    },
  });

  function invalidar() {
    void queryClient.invalidateQueries({ queryKey: chaves.atendimentos.raiz });
    void queryClient.invalidateQueries({ queryKey: chaves.monitorias.escopo(monitoria.id) });
  }

  const enviando = isSubmitting || mutacao.isPending || mutacaoLote.isPending;
  const emSerie = souMonitor && repeticoes > 1;

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

  const erroDeHorario = errors.data?.message ?? errors.horaInicio?.message ?? errors.horaFim?.message;

  if (!souMonitor && monitores.isPending) {
    return <Carregando rotulo="Carregando monitores…" />;
  }

  if (!souMonitor && monitores.isSuccess && listaDeMonitores.length === 0) {
    return (
      <Alert tom="alerta" titulo="Nenhum monitor habilitado">
        Esta monitoria ainda não tem monitores ativos, então não há a quem solicitar atendimento. O
        professor responsável é quem habilita monitores.
      </Alert>
    );
  }

  // Série parcialmente criada: o relatório substitui o formulário.
  if (relatorio) {
    return (
      <RelatorioDoLote
        relatorio={relatorio}
        fuso={fuso}
        aoVerAgenda={() => router.replace(rotas.monitoriaAtendimentos(monitoria.id))}
        aoTentarDeNovo={() => {
          setRelatorio(null);
          setHorarioEscolhido(null);
        }}
      />
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
              : 'Escolha um horário livre do monitor — a lista já desconta a sua agenda.'
          }
        />

        <CardConteudo>
          <form
            onSubmit={handleSubmit((dados) => {
              if (!confirmando) {
                setConfirmando(true);
                return;
              }
              (emSerie ? mutacaoLote : mutacao).mutate(dados);
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
                placeholder={monitorUnico ? undefined : 'Selecione o monitor'}
                ajuda={
                  monitorUnico
                    ? 'Único monitor ativo nesta monitoria.'
                    : 'Define os horários abaixo.'
                }
                erro={errors.monitorParticipanteId?.message}
                opcoes={listaDeMonitores.map((participante) => ({
                  // O valor é o id do VÍNCULO — é o que o backend espera.
                  valor: participante.id,
                  rotulo: participante.nomeAluno ?? 'Monitor',
                }))}
                {...campoMonitor}
                onChange={(evento) => {
                  void campoMonitor.onChange(evento);
                  // Os slots listados pertenciam ao monitor anterior.
                  setHorarioEscolhido(null);
                }}
              />
            )}

            {/* ------------------------------------------------- horário */}

            <div className="space-y-3 rounded-lg border border-borda bg-fundo-suave/40 p-3">
              <SeletorDeDuracao
                valor={duracao}
                opcoes={opcoesDeDuracao}
                aoEscolher={trocarDuracao}
                desabilitado={modoManual}
              />

              {!modoManual && monitorEscolhido && (
                <SeletorDeHorario
                  key={`${monitorEscolhido}-${duracao}`}
                  monitoriaId={monitoria.id}
                  monitorParticipanteId={monitorEscolhido}
                  duracaoMinutos={duracao}
                  valor={horarioEscolhido}
                  aoEscolher={escolherHorario}
                />
              )}

              {!modoManual && !monitorEscolhido && (
                <p className="text-sm text-texto-suave">
                  Selecione um monitor para ver os horários livres.
                </p>
              )}

              {/*
                Os três campos existem SEMPRE no formulário — o seletor acima
                apenas os preenche. Aqui eles ficam visíveis para quem precisa de
                um horário que a lista não oferece: duração fora das sugeridas,
                ou data além da janela consultada.
              */}
              {modoManual && (
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
              )}

              {!modoManual && erroDeHorario && (
                <p role="alert" className="text-xs text-perigo">
                  {erroDeHorario}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  variante="link"
                  tamanho="sm"
                  className="h-auto px-0"
                  iconeEsquerda={
                    modoManual ? (
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    )
                  }
                  onClick={() => {
                    setModoManual((atual) => !atual);
                    setHorarioEscolhido(null);
                  }}
                >
                  {modoManual ? 'Escolher um horário livre' : 'Informar horário manualmente'}
                </Button>

                <p className="text-xs text-texto-suave">Fuso da instituição ({fuso}).</p>
              </div>
            </div>

            {/* ------------------------------------------------- repetição */}

            {souMonitor && (
              <SeletorDeRepeticao
                valor={repeticoes}
                aoMudar={setRepeticoes}
                dataBase={instantePrevisto}
                fuso={fuso}
              />
            )}

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
              <Alert tom="info" titulo={emSerie ? 'Confirme a série' : 'Confirme o agendamento'}>
                <ul className="mt-1 space-y-0.5 text-sm">
                  <li>
                    {/* "sábado, 17/10 às 09:00 às 10:00" lia mal: o intervalo vai junto. */}
                    <strong>
                      {formatarDataHoraExtensa(instantePrevisto, fuso)}–{valores.horaFim}
                    </strong>
                  </li>
                  {emSerie && (
                    <li>
                      Repete semanalmente — <strong>{repeticoes} sessões</strong>, até{' '}
                      {descreverDataRelativa(
                        ocorrenciasSemanais(
                          instantePrevisto,
                          instantePrevisto,
                          repeticoes,
                          fuso,
                        ).at(-1)!.inicio,
                        new Date(),
                        fuso,
                        { comHora: false },
                      )}
                    </li>
                  )}
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
                    ? emSerie
                      ? `Abrir ${repeticoes} sessões`
                      : 'Confirmar agendamento'
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
              Este monitor ainda não declarou horários. Sem uma faixa ativa, o sistema recusa o
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

              {/*
                Recolhido e carregado so ao abrir. A `key` reinicia o bloco ao
                trocar de monitor, para nao mostrar aberta a agenda de outro.
              */}
              <div className="mt-3">
                <HorariosOcupados
                  key={monitorEscolhido}
                  monitoriaId={monitoria.id}
                  monitorParticipanteId={monitorEscolhido!}
                  oferecerEntrar={!souMonitor}
                />
              </div>
            </>
          )}
        </CardConteudo>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Repeticao semanal (A2)
// ---------------------------------------------------------------------------

/**
 * Quantas semanas a sessao se repete.
 *
 * Oferecida so ao MONITOR: abrir uma serie e o fluxo de quem conduz. O backend
 * aceitaria o lote vindo de um monitorado, mas uma solicitacao recorrente
 * inscreveria a pessoa em quinze sessoes de uma vez — compromisso maior do que
 * a tela sugere estar assumindo.
 */
function SeletorDeRepeticao({
  valor,
  aoMudar,
  dataBase,
  fuso,
}: {
  valor: number;
  aoMudar: (repeticoes: number) => void;
  dataBase: string | null;
  fuso: string;
}) {
  const ativo = valor > 1;

  const ultima =
    ativo && dataBase ? ocorrenciasSemanais(dataBase, dataBase, valor, fuso).at(-1)?.inicio : null;

  return (
    <div className="rounded-lg border border-borda p-3">
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={ativo}
          onChange={(evento) => aoMudar(evento.target.checked ? 8 : 1)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-borda-forte text-primaria focus-visible:ring-primaria"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-texto">
            <Repeat className="h-3.5 w-3.5 shrink-0 text-texto-suave" aria-hidden />
            Repetir toda semana
          </span>
          <span className="block text-xs text-texto-suave">
            Abre a mesma sessão nas semanas seguintes, no mesmo horário.
          </span>
        </span>
      </label>

      {ativo && (
        <div className="mt-3 space-y-2 border-t border-borda pt-3">
          <Select
            label="Por quantas semanas"
            className="sm:w-56"
            value={String(valor)}
            onChange={(evento) => aoMudar(Number(evento.target.value))}
            opcoes={[4, 8, 12, 16, MAX_OCORRENCIAS].map((semanas) => ({
              valor: String(semanas),
              rotulo: `${semanas} semanas`,
            }))}
          />

          {ultima && (
            <p className="text-xs text-texto-suave">
              Última sessão em{' '}
              <strong>
                {descreverDataRelativa(ultima, new Date(), fuso, { comHora: false })}
              </strong>
              .
            </p>
          )}

          <p className="text-xs text-texto-suave">
            Datas que conflitarem são puladas — as demais são criadas normalmente, e você vê o
            relatório ao final. Os monitorados recebem um único aviso.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Relatorio da serie quando houve recusa.
 *
 * Existe porque o lote tem SUCESSO PARCIAL: "13 de 16 criadas" precisa dizer
 * QUAIS tres ficaram de fora e por que, senao a pessoa teria de conferir a
 * agenda inteira para descobrir. Com zero recusas este componente nem aparece —
 * nao ha nada a revisar.
 */
function RelatorioDoLote({
  relatorio,
  fuso,
  aoVerAgenda,
  aoTentarDeNovo,
}: {
  relatorio: LoteDeAtendimentos;
  fuso: string;
  aoVerAgenda: () => void;
  aoTentarDeNovo: () => void;
}) {
  const agora = new Date();

  return (
    <Card>
      <CardCabecalho
        titulo={`${relatorio.criados} de ${relatorio.criados + relatorio.recusados} sessões abertas`}
        descricao="As datas recusadas não foram criadas. Nada do que já existia foi alterado."
      />

      <CardConteudo className="space-y-4">
        <ul className="divide-y divide-borda rounded-lg border border-borda">
          {relatorio.resultados.map((resultado) => (
            <li
              key={`${resultado.inicio}-${String(resultado.criado)}`}
              className="flex items-start gap-2.5 px-3 py-2 text-sm"
            >
              {resultado.criado ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-sucesso" aria-hidden />
              ) : (
                <X className="mt-0.5 h-4 w-4 shrink-0 text-perigo" aria-hidden />
              )}

              <span className="min-w-0 flex-1">
                <span className="block text-texto">
                  {descreverDataRelativa(resultado.inicio, agora, fuso)}
                </span>
                {!resultado.criado && resultado.erro && (
                  <span className="block text-xs text-texto-suave">{resultado.erro}</span>
                )}
              </span>

              <span className="shrink-0 text-xs text-texto-suave">
                {resultado.criado ? 'criada' : 'recusada'}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variante="secundaria" onClick={aoTentarDeNovo}>
            Abrir outras sessões
          </Button>
          <Button onClick={aoVerAgenda}>Ver agenda da monitoria</Button>
        </div>
      </CardConteudo>
    </Card>
  );
}

function diferencaEmMinutos(inicio: string, fim: string): number {
  const [hi, mi] = inicio.split(':').map(Number);
  const [hf, mf] = fim.split(':').map(Number);

  if (hi === undefined || mi === undefined || hf === undefined || mf === undefined) return 0;

  return hf * 60 + mf - (hi * 60 + mi);
}
