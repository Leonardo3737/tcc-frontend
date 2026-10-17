'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, FileText, Paperclip, Send, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Alert } from '@/components/ui/alert';
import { Button, classesBotao } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/campo';
import { Card, CardCabecalho, CardConteudo } from '@/components/ui/card';
import { rotas } from '@/config/rotas';
import { listarCursos } from '@/features/cursos/api/cursos.service';
import { listarDisciplinas } from '@/features/disciplinas/api/disciplinas.service';
import { listarProfessoresPublicos } from '@/features/usuarios/api/professores.service';
import { aplicarErroDeFormulario } from '@/lib/api/formulario';
import { chaves } from '@/lib/query/chaves';
import { cn } from '@/lib/utils';
import { Turno, type EditalPublico, type InscricaoConfirmacao } from '@/types/dominio';
import { inscreverEmEdital } from '../api/inscricoes.service';
import {
  CAMPOS_INSCRICAO,
  esquemaInscricao,
  formatarTamanho,
  problemaNoBoletim,
  type DadosFormularioInscricao,
} from '../schemas/inscricao.schema';
import { formatarDataDeCalendario } from '../situacao';

const ROTULO_TURNO: Record<Turno, string> = {
  [Turno.MATUTINO]: 'Matutino',
  [Turno.VESPERTINO]: 'Vespertino',
  [Turno.NOTURNO]: 'Noturno',
};

/** Teto do PaginacaoDto do backend. */
const LIMITE = 100;

/**
 * Inscricao do candidato em um edital. Tela PUBLICA.
 *
 * Nada aqui pressupoe conta: cursos, disciplinas e professores vem das
 * projecoes publicas que o backend expoe exatamente para este formulario
 * (`GET /cursos`, `GET /disciplinas`, `GET /professores/publicos`).
 *
 * Tambem nao ha consulta por matricula para pre-preencher dados de aluno ja
 * cadastrado — o backend nao oferece rota anonima para isso, e inventar uma
 * seria transformar o formulario em um oraculo de matriculas validas. Quem ja
 * tem conta preenche os mesmos campos; o vinculo e feito pelo professor
 * depois, com `alunoCadastrado` que a API resolve na consulta administrativa.
 */
export function FormularioInscricao({ editais }: { editais: EditalPublico[] }) {
  const [confirmacao, setConfirmacao] = useState<InscricaoConfirmacao | null>(null);

  if (confirmacao) {
    return <Confirmacao confirmacao={confirmacao} />;
  }

  return <Conteudo editais={editais} aoConfirmar={setConfirmacao} />;
}

function Conteudo({
  editais,
  aoConfirmar,
}: {
  editais: EditalPublico[];
  aoConfirmar: (confirmacao: InscricaoConfirmacao) => void;
}) {
  /**
   * Com varios editais abertos, o primeiro vem selecionado: o backend ordena
   * pelo que FECHA PRIMEIRO, entao o padrao e o mais urgente. A tela permite
   * trocar; nenhuma regra de prioridade foi inventada aqui.
   */
  const [editalId, setEditalId] = useState(editais[0]!.id);
  const edital = editais.find((item) => item.id === editalId) ?? editais[0]!;

  const [boletim, setBoletim] = useState<File | null>(null);
  const [erroBoletim, setErroBoletim] = useState<string | null>(null);
  const campoArquivo = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosFormularioInscricao>({
    resolver: zodResolver(esquemaInscricao),
    mode: 'onBlur',
    defaultValues: {
      nomeCompleto: '',
      matricula: '',
      email: '',
      cursoId: '',
      disciplinaId: '',
      professorId: '',
      turno: undefined,
      n1: undefined,
      n2: undefined,
    },
  });

  const valores = useWatch({ control });
  const cursoId = valores.cursoId ?? '';

  const cursos = useQuery({
    queryKey: chaves.cursos.lista({ ativo: true, limite: LIMITE }),
    queryFn: () => listarCursos({ ativo: true, limite: LIMITE }),
    staleTime: 5 * 60_000,
  });

  /**
   * Disciplinas DO CURSO escolhido — filtradas no servidor (`cursoId`), nunca
   * no cliente. Uma disciplina de outro curso seria recusada com 409 no envio:
   * oferecer a opcao e so adiar o erro.
   */
  const disciplinas = useQuery({
    queryKey: chaves.disciplinas.lista({ ativa: true, cursoId, limite: LIMITE }),
    enabled: Boolean(cursoId),
    queryFn: () => listarDisciplinas({ ativa: true, cursoId, limite: LIMITE }),
    staleTime: 5 * 60_000,
  });

  const professores = useQuery({
    queryKey: chaves.professoresPublicos,
    queryFn: () => listarProfessoresPublicos({ limite: LIMITE }),
    staleTime: 5 * 60_000,
  });

  /**
   * Trocar o curso limpa a disciplina.
   *
   * Sem isto, o id da disciplina anterior continuaria no formulario, invisivel,
   * e seria enviado junto com o curso novo — produzindo um 409 de
   * incompatibilidade que a pessoa nao teria como entender.
   */
  useEffect(() => {
    setValue('disciplinaId', '', { shouldValidate: false });
  }, [cursoId, setValue]);

  const escolherArquivo = (arquivo: File | null) => {
    setErroBoletim(arquivo ? problemaNoBoletim(arquivo) : null);
    setBoletim(arquivo);
  };

  const removerArquivo = () => {
    setBoletim(null);
    setErroBoletim(null);
    // Sem isto, reescolher o MESMO arquivo nao dispara `change`.
    if (campoArquivo.current) campoArquivo.current.value = '';
  };

  const mutacao = useMutation({
    mutationFn: (dados: DadosFormularioInscricao) =>
      inscreverEmEdital(edital.id, {
        ...dados,
        // Nota em branco sai do corpo: ausente nao e zero.
        ...(dados.n1 === undefined ? {} : { n1: dados.n1 }),
        ...(dados.n2 === undefined ? {} : { n2: dados.n2 }),
        boletim: boletim!,
      }),

    onSuccess: aoConfirmar,

    /**
     * Os erros possiveis sao de dominio e ja vem prontos para exibir:
     * 400 (dados ou arquivo invalido), 404 (curso/disciplina/professor
     * inexistente), 409 (fora do periodo, disciplina incompativel com o curso,
     * ou matricula/e-mail ja inscritos neste edital) e 413 (acima de 5 MB).
     */
    onError: (erro) => aplicarErroDeFormulario(erro, setError, CAMPOS_INSCRICAO),
  });

  const enviando = isSubmitting || mutacao.isPending;

  const enviar = handleSubmit((dados) => {
    const problema = problemaNoBoletim(boletim);

    if (problema) {
      setErroBoletim(problema);
      return;
    }

    mutacao.mutate(dados);
  });

  return (
    <div className="w-full max-w-3xl space-y-4">
      <CartaoDoEdital
        edital={edital}
        editais={editais}
        aoTrocar={(novo) => {
          setEditalId(novo);
          // O 409 de duplicidade é por edital; limpar o erro evita confusão.
          mutacao.reset();
        }}
      />

      <Card>
        <CardCabecalho
          titulo="Formulário de inscrição"
          descricao="Você não precisa ter conta na plataforma para se candidatar."
        />

        <CardConteudo>
          <form onSubmit={enviar} className="space-y-5" noValidate>
            {errors.root && (
              <Alert tom="erro" titulo="Não foi possível concluir a inscrição">
                {errors.root.message}
              </Alert>
            )}

            <Input
              label="Nome completo"
              autoComplete="name"
              obrigatorio
              erro={errors.nomeCompleto?.message}
              {...register('nomeCompleto')}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Matrícula"
                autoComplete="off"
                obrigatorio
                erro={errors.matricula?.message}
                {...register('matricula')}
              />

              <Input
                label="E-mail"
                type="email"
                inputMode="email"
                autoComplete="email"
                obrigatorio
                ajuda="A confirmação é enviada para este endereço."
                erro={errors.email?.message}
                {...register('email')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Curso"
                obrigatorio
                placeholder={cursos.isPending ? 'Carregando…' : 'Selecione o curso'}
                disabled={cursos.isPending}
                erro={errors.cursoId?.message}
                opcoes={(cursos.data?.dados ?? []).map((curso) => ({
                  valor: curso.id,
                  rotulo: curso.nome,
                }))}
                {...register('cursoId')}
              />

              <Select
                label="Disciplina"
                obrigatorio
                disabled={!cursoId || disciplinas.isPending}
                placeholder={
                  !cursoId
                    ? 'Escolha o curso primeiro'
                    : disciplinas.isPending
                      ? 'Carregando…'
                      : 'Selecione a disciplina'
                }
                ajuda={
                  cursoId && disciplinas.isSuccess && disciplinas.data.dados.length === 0
                    ? 'Nenhuma disciplina ativa neste curso.'
                    : undefined
                }
                erro={errors.disciplinaId?.message}
                opcoes={(disciplinas.data?.dados ?? []).map((disciplina) => ({
                  valor: disciplina.id,
                  rotulo: `${disciplina.codigo} — ${disciplina.nome}`,
                }))}
                {...register('disciplinaId')}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Professor responsável"
                obrigatorio
                disabled={professores.isPending}
                placeholder={professores.isPending ? 'Carregando…' : 'Selecione o professor'}
                erro={errors.professorId?.message}
                opcoes={(professores.data?.dados ?? []).map((professor) => ({
                  valor: professor.usuarioId,
                  rotulo: professor.departamento
                    ? `${professor.nome} · ${professor.departamento}`
                    : professor.nome,
                }))}
                {...register('professorId')}
              />

              <Select
                label="Turno"
                obrigatorio
                placeholder="Selecione o turno"
                ajuda="Em que turno você pretende atuar."
                erro={errors.turno?.message}
                opcoes={Object.values(Turno).map((turno) => ({
                  valor: turno,
                  rotulo: ROTULO_TURNO[turno],
                }))}
                {...register('turno')}
              />
            </div>

            <fieldset className="space-y-3 rounded-lg border border-borda p-3">
              <legend className="px-1 text-sm font-semibold text-texto">Notas</legend>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Nota N1"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  max={10}
                  erro={errors.n1?.message}
                  {...register('n1')}
                />

                <Input
                  label="Nota N2"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  max={10}
                  erro={errors.n2?.message}
                  {...register('n2')}
                />
              </div>

              {/*
                A média NÃO é exibida nem enviada: ela é calculada pelo banco a
                partir de n1 e n2, e mostrar uma conta do navegador como se
                fosse o número oficial criaria uma segunda fonte de verdade.
              */}
              <p className="text-xs text-texto-suave">
                Deixe em branco a nota que ainda não existe — o campo vazio{' '}
                <strong>não vira zero</strong>. A média é calculada pela plataforma.
              </p>
            </fieldset>

            <CampoBoletim
              arquivo={boletim}
              erro={erroBoletim}
              referencia={campoArquivo}
              aoEscolher={escolherArquivo}
              aoRemover={removerArquivo}
            />

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Link href={rotas.login} className={classesBotao('secundaria')}>
                Voltar ao login
              </Link>

              {/* `disabled` durante o envio é o que impede o duplo clique. */}
              <Button
                type="submit"
                carregando={enviando}
                disabled={enviando}
                iconeEsquerda={<Send className="h-4 w-4" aria-hidden />}
              >
                {enviando ? 'Enviando inscrição…' : 'Enviar inscrição'}
              </Button>
            </div>
          </form>
        </CardConteudo>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CartaoDoEdital({
  edital,
  editais,
  aoTrocar,
}: {
  edital: EditalPublico;
  editais: EditalPublico[];
  aoTrocar: (id: string) => void;
}) {
  return (
    <Card>
      <CardConteudo className="space-y-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-acento-forte">
              Inscrições abertas
            </p>
            <h2 className="font-titulo text-titulo-cartao text-texto">
              Monitoria {edital.ano}/{edital.semestre}
            </h2>
          </div>

          <a
            href={edital.link}
            target="_blank"
            rel="noopener noreferrer"
            className={classesBotao('secundaria', 'sm')}
          >
            <FileText className="mr-2 h-4 w-4" aria-hidden />
            Ler o edital
          </a>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-texto-suave">Início das inscrições</dt>
            <dd className="font-medium text-texto">
              {formatarDataDeCalendario(edital.inicioInscricoes)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-texto-suave">Encerramento</dt>
            <dd className="font-medium text-texto">
              {formatarDataDeCalendario(edital.fimInscricoes)}
            </dd>
          </div>
        </dl>

        {/* Só aparece quando há de fato o que escolher. */}
        {editais.length > 1 && (
          <Select
            label="Edital"
            ajuda="Há mais de um edital com inscrições abertas."
            value={edital.id}
            onChange={(evento) => aoTrocar(evento.target.value)}
            opcoes={editais.map((item) => ({
              valor: item.id,
              rotulo: `Monitoria ${item.ano}/${item.semestre} — até ${formatarDataDeCalendario(item.fimInscricoes)}`,
            }))}
          />
        )}
      </CardConteudo>
    </Card>
  );
}

function CampoBoletim({
  arquivo,
  erro,
  referencia,
  aoEscolher,
  aoRemover,
}: {
  arquivo: File | null;
  erro: string | null;
  referencia: React.RefObject<HTMLInputElement | null>;
  aoEscolher: (arquivo: File | null) => void;
  aoRemover: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="boletim" className="block text-sm font-semibold text-texto">
        Boletim de notas (PDF)
        <span className="ml-0.5 text-perigo" aria-hidden>
          *
        </span>
      </label>

      <input
        ref={referencia}
        id="boletim"
        type="file"
        accept="application/pdf,.pdf"
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? 'boletim-erro' : 'boletim-ajuda'}
        className={cn(
          'block w-full cursor-pointer rounded-md border bg-superficie text-sm text-texto',
          'file:mr-3 file:cursor-pointer file:border-0 file:bg-fundo-suave file:px-3 file:py-2',
          'file:text-sm file:font-semibold file:text-texto',
          erro ? 'border-perigo' : 'border-borda-forte',
        )}
        onChange={(evento) => aoEscolher(evento.target.files?.[0] ?? null)}
      />

      {/* O arquivo escolhido fica visível, com tamanho e opção de remover. */}
      {arquivo && !erro && (
        <p className="flex items-center gap-2 rounded-md bg-fundo-suave px-3 py-2 text-sm">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-texto-suave" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-texto">{arquivo.name}</span>
          <span className="shrink-0 text-xs text-texto-suave">
            {formatarTamanho(arquivo.size)}
          </span>
          <button
            type="button"
            onClick={aoRemover}
            className="shrink-0 rounded p-0.5 text-texto-suave hover:text-perigo"
            aria-label={`Remover ${arquivo.name}`}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </p>
      )}

      {erro ? (
        <p id="boletim-erro" role="alert" className="text-xs text-perigo">
          {erro}
        </p>
      ) : (
        <p id="boletim-ajuda" className="text-xs text-texto-suave">
          Apenas PDF, até 5 MB.
        </p>
      )}
    </div>
  );
}

/**
 * Confirmacao. Substitui o formulario — e assim que o reenvio acidental e
 * evitado: o formulario deixa de existir na tela depois do sucesso.
 */
function Confirmacao({ confirmacao }: { confirmacao: InscricaoConfirmacao }) {
  return (
    <Card className="w-full max-w-xl">
      <CardConteudo className="space-y-4 py-8 text-center">
        <span
          aria-hidden
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sucesso-suave text-sucesso"
        >
          <CheckCircle2 className="h-7 w-7" />
        </span>

        <div className="space-y-1">
          <h2 className="font-titulo text-titulo-cartao text-texto">Inscrição registrada</h2>
          <p className="text-sm text-texto-suave">
            {confirmacao.nomeCompleto}, sua candidatura foi recebida.
          </p>
        </div>

        <div className="rounded-lg border border-borda bg-fundo-suave px-4 py-3 text-left">
          <p className="text-xs text-texto-suave">Número da inscrição</p>
          <p className="break-all font-mono text-sm text-texto">{confirmacao.id}</p>
        </div>

        {/*
          A honestidade aqui importa: a inscrição está gravada nos dois casos.
          `emailConfirmacaoEnviado: false` significa só que o aviso não saiu —
          e dizer "confira sua caixa de entrada" nesse caso seria mentira.
        */}
        {confirmacao.emailConfirmacaoEnviado ? (
          <Alert tom="sucesso">
            Enviamos uma confirmação para o seu e-mail. Se não encontrar, confira a caixa de spam.
          </Alert>
        ) : (
          <Alert tom="alerta" titulo="Não conseguimos enviar o e-mail de confirmação">
            Sua inscrição <strong>está registrada</strong> — apenas o aviso por e-mail não saiu.
            Guarde o número acima.
          </Alert>
        )}

        <Link href={rotas.login} className={classesBotao('secundaria')}>
          Voltar ao login
        </Link>
      </CardConteudo>
    </Card>
  );
}
