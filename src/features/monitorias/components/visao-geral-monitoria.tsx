'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, FolderOpen, LogOut, Pencil, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { DialogoConfirmacao } from '@/components/comum/confirmacao';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/campo';
import { Card, CardCabecalho, CardConteudo } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { rotas } from '@/config/rotas';
import { mensagemDeErro } from '@/lib/api/erros';
import { aplicarErroDeFormulario } from '@/lib/api/formulario';
import { podeParticiparDaMonitoria } from '@/lib/autorizacao/capacidades';
import { chaves } from '@/lib/query/chaves';
import { useContextoMonitoria } from '@/providers/monitoria-provider';
import { useSessao } from '@/providers/sessao-provider';
import { PapelMonitoria, StatusMonitoria } from '@/types/dominio';
import {
  atualizarMonitoria,
  encerrarParticipacao,
  participarDaMonitoria,
} from '../api/monitorias.service';

export function VisaoGeralMonitoria() {
  const { monitoria, contexto, capacidades } = useContextoMonitoria();
  const [editando, setEditando] = useState(false);

  const encerrada =
    monitoria.status === StatusMonitoria.ENCERRADA ||
    monitoria.status === StatusMonitoria.CANCELADA;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardCabecalho
            titulo="Sobre a monitoria"
            acao={
              capacidades.administrarMonitoria &&
              !encerrada && (
                <Button
                  variante="secundaria"
                  tamanho="sm"
                  onClick={() => setEditando((atual) => !atual)}
                  iconeEsquerda={<Pencil className="h-3.5 w-3.5" aria-hidden />}
                >
                  {editando ? 'Cancelar' : 'Editar'}
                </Button>
              )
            }
          />

          <CardConteudo>
            {editando ? (
              <FormularioEdicao aoConcluir={() => setEditando(false)} />
            ) : monitoria.descricao ? (
              <p className="whitespace-pre-wrap text-sm text-texto">{monitoria.descricao}</p>
            ) : (
              <p className="text-sm text-texto-suave">Nenhuma descrição informada.</p>
            )}
          </CardConteudo>
        </Card>

        <CartaoParticipacao />
      </div>

      <div className="space-y-4">
        <Card>
          <CardCabecalho titulo="Atalhos" />
          <CardConteudo className="space-y-2">
            <Atalho
              href={rotas.monitoriaAtendimentos(monitoria.id)}
              icone={<CalendarDays className="h-4 w-4" aria-hidden />}
              rotulo="Atendimentos"
              descricao="Agenda, histórico e presenças"
            />
            <Atalho
              href={rotas.monitoriaParticipantes(monitoria.id)}
              icone={<Users className="h-4 w-4" aria-hidden />}
              rotulo="Participantes"
              descricao="Monitores e monitorados"
            />
            <Atalho
              href={rotas.monitoriaMateriais(monitoria.id)}
              icone={<FolderOpen className="h-4 w-4" aria-hidden />}
              rotulo="Materiais"
              descricao="Acervo da monitoria"
            />
          </CardConteudo>
        </Card>

        {contexto.meuPapel === PapelMonitoria.MONITOR && (
          <Alert tom="info" titulo="Você é monitor aqui">
            Declare sua <strong>disponibilidade semanal</strong> para que os monitorados possam
            solicitar atendimento nos seus horários.
          </Alert>
        )}
      </div>
    </div>
  );
}

function Atalho({
  href,
  icone,
  rotulo,
  descricao,
}: {
  href: string;
  icone: React.ReactNode;
  rotulo: string;
  descricao: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-borda p-3 transition-colors hover:bg-fundo"
    >
      <span className="text-primaria">{icone}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-texto">{rotulo}</span>
        <span className="block text-xs text-texto-suave">{descricao}</span>
      </span>
    </Link>
  );
}

/**
 * Participacao do usuario nesta monitoria.
 *
 * Tres situacoes possiveis, e as tres precisam ser explicadas — porque a
 * pergunta "o que eu sou aqui?" e o eixo de tudo que a pessoa pode fazer:
 *  1. participa (MONITOR ou MONITORADO);
 *  2. e o professor responsavel;
 *  3. nao participa — e, sendo ALUNO, pode se inscrever.
 */
function CartaoParticipacao() {
  const { monitoria, contexto, capacidades } = useContextoMonitoria();
  const { usuario } = useSessao();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const atualizar = () => {
    void queryClient.invalidateQueries({ queryKey: chaves.monitorias.raiz });
    router.refresh();
  };

  const participar = useMutation({
    mutationFn: () => participarDaMonitoria(monitoria.id),
    onSuccess: () => {
      toast.sucesso('Você agora participa desta monitoria', 'Seu papel aqui é MONITORADO.');
      atualizar();
    },
    // 409 = RN09: já existe vínculo ativo (possivelmente como MONITOR).
    onError: (erro) => toast.erro('Não foi possível participar', mensagemDeErro(erro)),
  });

  const sair = useMutation({
    mutationFn: () => encerrarParticipacao(monitoria.id, contexto.meuParticipanteId!),
    onSuccess: () => {
      toast.sucesso('Participação encerrada', 'Seu histórico foi preservado.');
      setConfirmandoSaida(false);
      atualizar();
    },
    /**
     * 409 = ainda há atendimentos ou inscrições ativas. Sair deixaria
     * compromissos órfãos, então o backend exige o cancelamento antes.
     */
    onError: (erro) => toast.erro('Não foi possível sair', mensagemDeErro(erro)),
  });

  const encerrada =
    monitoria.status === StatusMonitoria.ENCERRADA ||
    monitoria.status === StatusMonitoria.CANCELADA;

  if (contexto.souResponsavel && !contexto.meuPapel) {
    return (
      <Card>
        <CardCabecalho titulo="Sua participação" />
        <CardConteudo>
          <p className="text-sm text-texto">
            Você é o <strong>professor responsável</strong> por esta monitoria: administra a oferta,
            habilita monitores e acompanha os indicadores.
          </p>
          <p className="mt-2 text-sm text-texto-suave">
            Professores não declaram disponibilidade nem agendam atendimentos — essas ações
            pertencem a quem tem vínculo de monitor ou monitorado.
          </p>
        </CardConteudo>
      </Card>
    );
  }

  if (contexto.meuPapel) {
    const ehMonitor = contexto.meuPapel === PapelMonitoria.MONITOR;

    return (
      <Card>
        <CardCabecalho titulo="Sua participação" />
        <CardConteudo className="space-y-3">
          <p className="text-sm text-texto">
            Nesta monitoria você é <strong>{ehMonitor ? 'MONITOR' : 'MONITORADO'}</strong>.{' '}
            {ehMonitor
              ? 'Você declara horários de atendimento, conduz as sessões e publica materiais.'
              : 'Você pode solicitar atendimento aos monitores, inscrever-se em sessões abertas e avaliar os atendimentos de que participar.'}
          </p>

          <p className="text-xs text-texto-suave">
            Este papel vale <strong>apenas aqui</strong>. Em outra monitoria você pode ter um papel
            diferente.
          </p>

          {capacidades.sairDaMonitoria && !encerrada && (
            <>
              <Button
                variante="secundaria"
                tamanho="sm"
                onClick={() => setConfirmandoSaida(true)}
                iconeEsquerda={<LogOut className="h-3.5 w-3.5" aria-hidden />}
              >
                Sair da monitoria
              </Button>

              <DialogoConfirmacao
                aberto={confirmandoSaida}
                aoFechar={() => setConfirmandoSaida(false)}
                aoConfirmar={() => sair.mutate()}
                carregando={sair.isPending}
                titulo="Sair da monitoria"
                descricao="Você perderá o acesso aos atendimentos, materiais e participantes desta monitoria."
                rotuloConfirmar="Sair"
                aviso="Seu histórico é preservado (RN10). Se você tiver atendimentos agendados ou inscrições ativas, cancele-os antes — o sistema recusará a saída."
              />
            </>
          )}
        </CardConteudo>
      </Card>
    );
  }

  return (
    <Card>
      <CardCabecalho titulo="Sua participação" />
      <CardConteudo className="space-y-3">
        <p className="text-sm text-texto-suave">Você ainda não participa desta monitoria.</p>

        {podeParticiparDaMonitoria(usuario, contexto) ? (
          <>
            <Button
              carregando={participar.isPending}
              onClick={() => participar.mutate()}
              iconeEsquerda={<UserPlus className="h-4 w-4" aria-hidden />}
            >
              Participar como monitorado
            </Button>

            <p className="text-xs text-texto-suave">
              Um aluno não acumula os dois papéis na mesma monitoria: para ser monitor aqui, é o
              professor responsável quem habilita.
            </p>
          </>
        ) : (
          <p className="text-sm text-texto-suave">
            {encerrada
              ? 'Esta monitoria está encerrada e não aceita novos participantes.'
              : 'Apenas alunos podem se inscrever como monitorados.'}
          </p>
        )}
      </CardConteudo>
    </Card>
  );
}

/** Espelha atualizar-monitoria.dto.ts: só descrição e vigência são editáveis. */
const esquemaEdicao = z
  .object({
    descricao: z.string().trim().max(2000, 'Máximo de 2000 caracteres'),
    dataInicio: z.string(),
    dataFim: z.string(),
  })
  .refine((dados) => !dados.dataInicio || !dados.dataFim || dados.dataFim >= dados.dataInicio, {
    path: ['dataFim'],
    message: 'A data de término não pode ser anterior à de início',
  });

type DadosEdicao = z.infer<typeof esquemaEdicao>;

function FormularioEdicao({ aoConcluir }: { aoConcluir: () => void }) {
  const { monitoria } = useContextoMonitoria();
  const queryClient = useQueryClient();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosEdicao>({
    resolver: zodResolver(esquemaEdicao),
    mode: 'onBlur',
    defaultValues: {
      descricao: monitoria.descricao ?? '',
      dataInicio: monitoria.dataInicio ?? '',
      dataFim: monitoria.dataFim ?? '',
    },
  });

  const mutacao = useMutation({
    mutationFn: (dados: DadosEdicao) =>
      atualizarMonitoria(monitoria.id, {
        descricao: dados.descricao,
        ...(dados.dataInicio ? { dataInicio: dados.dataInicio } : {}),
        ...(dados.dataFim ? { dataFim: dados.dataFim } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaves.monitorias.raiz });
      toast.sucesso('Monitoria atualizada');
      router.refresh();
      aoConcluir();
    },
    onError: (erro) =>
      aplicarErroDeFormulario(erro, setError, ['descricao', 'dataInicio', 'dataFim']),
  });

  const enviando = isSubmitting || mutacao.isPending;

  return (
    <form
      onSubmit={handleSubmit((dados) => mutacao.mutate(dados))}
      className="space-y-4"
      noValidate
    >
      {errors.root && <Alert tom="erro">{errors.root.message}</Alert>}

      <Textarea
        label="Descrição"
        autoFocus
        erro={errors.descricao?.message}
        {...register('descricao')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Início da vigência"
          type="date"
          erro={errors.dataInicio?.message}
          {...register('dataInicio')}
        />
        <Input
          label="Fim da vigência"
          type="date"
          erro={errors.dataFim?.message}
          {...register('dataFim')}
        />
      </div>

      <p className="text-xs text-texto-suave">
        Disciplina e período não são editáveis: eles são a identidade da oferta. Para ofertar outra
        disciplina, crie outra monitoria.
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variante="secundaria" onClick={aoConcluir} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" carregando={enviando}>
          {enviando ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
