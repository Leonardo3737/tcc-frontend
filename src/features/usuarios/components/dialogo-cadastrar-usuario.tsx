'use client';

import { useState } from 'react';
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';

import { Dialog, DialogConteudo } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/campo';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/components/ui/toast';
import { SeletorDeCurso } from '@/features/cursos/components/seletor-de-cursos';
import { cadastrarAluno } from '../api/alunos.service';
import { cadastrarProfessor } from '../api/professores.service';
import {
  CAMPOS_CADASTRO_ALUNO,
  CAMPOS_CADASTRO_PROFESSOR,
  campoDoConflito,
  esquemaCadastroAluno,
  esquemaCadastroProfessor,
  type DadosCadastroAluno,
  type DadosCadastroProfessor,
} from '../schemas/cadastro-pelo-professor.schema';
import { ApiError } from '@/lib/api/erros';
import { aplicarErroDeFormulario } from '@/lib/api/formulario';
import { chaves } from '@/lib/query/chaves';
import type { Usuario } from '@/types/dominio';

export type TipoCadastro = 'aluno' | 'professor';

/** Ajuda do campo de e-mail: e por ele que a senha chega, entao vale conferir. */
const AJUDA_EMAIL =
  'A senha de acesso será enviada para este endereço. Confira antes de cadastrar.';

/**
 * Cadastro de aluno ou professor, feito por um professor.
 *
 * NAO HA SENHA NO FORMULARIO: o servidor gera uma aleatoria e a envia direto ao
 * e-mail informado. Quem cria a conta nunca ve a credencial — e por isso a
 * confirmacao mostra PARA ONDE a senha foi, e nao a senha.
 *
 * Se o e-mail nao puder ser entregue, o backend desfaz a criacao e responde
 * 503: uma conta cuja senha nao chegou a ninguem seria inutilizavel.
 *
 * `aoCadastrar` permite que outro fluxo continue a partir da conta criada (ex.:
 * inscrever o aluno recem-criado numa monitoria).
 *
 * `valoresIniciais` permite ENTRAR neste fluxo com campos pre-preenchidos —
 * hoje, a partir de uma candidatura aprovada em edital. E pre-preenchimento,
 * nao automacao: o formulario continua sendo o mesmo, a pessoa revisa tudo e a
 * conta so nasce quando ela confirma. Nenhum caminho alternativo de criacao de
 * usuario foi aberto.
 */
export interface ValoresIniciaisAluno {
  nome?: string;
  email?: string;
  matricula?: string;
  cursoId?: string;
}

export function DialogoCadastrarUsuario({
  tipo,
  aberto,
  aoFechar,
  aoCadastrar,
  valoresIniciais,
}: {
  tipo: TipoCadastro;
  aberto: boolean;
  aoFechar: () => void;
  aoCadastrar?: (usuario: Usuario) => void;
  /** Só se aplica ao cadastro de ALUNO. */
  valoresIniciais?: ValoresIniciaisAluno;
}) {
  const [criado, setCriado] = useState<Usuario | null>(null);
  // Remonta o formulario ao "cadastrar outro", limpando valores e erros.
  const [geracao, setGeracao] = useState(0);

  const fechar = () => {
    setCriado(null);
    aoFechar();
  };

  const aoCriar = (usuario: Usuario) => {
    setCriado(usuario);
    aoCadastrar?.(usuario);
  };

  const rotulo = tipo === 'aluno' ? 'aluno' : 'professor';

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && fechar()}>
      {aberto && (
        <DialogConteudo
          titulo={criado ? 'Conta criada' : `Cadastrar ${rotulo}`}
          descricao={
            criado
              ? 'A pessoa já pode entrar na plataforma com a senha enviada por e-mail.'
              : tipo === 'aluno'
                ? 'O aluno recebe por e-mail uma senha gerada pela plataforma. Você não precisa definir nem repassar senha.'
                : 'O novo professor poderá criar monitorias, habilitar monitores e cadastrar outras pessoas. A senha chega no e-mail dele.'
          }
        >
          {criado ? (
            <ConfirmacaoConta
              usuario={criado}
              aoCadastrarOutro={() => {
                setCriado(null);
                setGeracao((atual) => atual + 1);
              }}
              aoConcluir={fechar}
              rotuloOutro={`Cadastrar outro ${rotulo}`}
            />
          ) : tipo === 'aluno' ? (
            <FormularioAluno
              key={geracao}
              aoCancelar={fechar}
              aoCriar={aoCriar}
              valoresIniciais={valoresIniciais}
            />
          ) : (
            <FormularioProfessor key={geracao} aoCancelar={fechar} aoCriar={aoCriar} />
          )}
        </DialogConteudo>
      )}
    </Dialog>
  );
}

/**
 * Erro da API de volta ao formulario, no campo onde a pessoa precisa corrigir:
 *  - 409: o campo que colidiu (e-mail, matricula ou identificacao funcional);
 *  - 503: o e-mail — a senha nao pode ser entregue nele e a conta NAO foi
 *    criada. A mensagem do backend ja diz isso; `mensagemDeErro` a trocaria
 *    pelo texto generico de 5xx, por isso ela e usada direto aqui.
 * Os demais seguem o padrao de `aplicarErroDeFormulario`.
 */
function aplicarErro<T extends FieldValues>(
  erro: unknown,
  setError: UseFormSetError<T>,
  campos: readonly string[],
) {
  if (erro instanceof ApiError && erro.ehConflito) {
    const campo = campoDoConflito(erro.message);
    if (campo && campos.includes(campo)) {
      setError(campo as Path<T>, { type: 'server', message: erro.message });
      return;
    }
  }

  if (erro instanceof ApiError && erro.statusCode === 503) {
    setError('email' as Path<T>, { type: 'server', message: erro.message });
    return;
  }

  aplicarErroDeFormulario(erro, setError, campos);
}

function FormularioAluno({
  aoCancelar,
  aoCriar,
  valoresIniciais,
}: {
  aoCancelar: () => void;
  aoCriar: (usuario: Usuario) => void;
  valoresIniciais?: ValoresIniciaisAluno;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DadosCadastroAluno>({
    resolver: zodResolver(esquemaCadastroAluno),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      nome: valoresIniciais?.nome ?? '',
      email: valoresIniciais?.email ?? '',
      matricula: valoresIniciais?.matricula ?? '',
      cursoId: valoresIniciais?.cursoId ?? '',
    },
  });

  const mutacao = useMutation({
    mutationFn: cadastrarAluno,
    onSuccess: (usuario) => {
      void queryClient.invalidateQueries({ queryKey: chaves.alunos.raiz });
      toast.sucesso('Aluno cadastrado', `Senha enviada para ${usuario.email}.`);
      aoCriar(usuario);
    },
    onError: (erro) => aplicarErro(erro, setError, CAMPOS_CADASTRO_ALUNO),
  });

  const enviando = isSubmitting || mutacao.isPending;

  return (
    <form
      onSubmit={handleSubmit((dados) => mutacao.mutate(dados))}
      className="space-y-4"
      noValidate
    >
      {errors.root && <Alert tom="erro">{errors.root.message}</Alert>}

      <Input
        label="Nome completo"
        autoComplete="off"
        autoFocus
        obrigatorio
        erro={errors.nome?.message}
        {...register('nome')}
      />

      <Input
        label="E-mail institucional"
        type="email"
        inputMode="email"
        autoComplete="off"
        placeholder="nome@instituicao.edu.br"
        obrigatorio
        ajuda={AJUDA_EMAIL}
        erro={errors.email?.message}
        {...register('email')}
      />

      <Input
        label="Matrícula"
        autoComplete="off"
        obrigatorio
        ajuda="Letras, números, ponto, hífen ou _."
        erro={errors.matricula?.message}
        {...register('matricula')}
      />

      {/*
        Escolha, não texto livre: o curso virou relação e é ele que decide de
        quais monitorias o aluno poderá participar. Digitado à mão, "Eng. de
        Software" e "Engenharia de Software" viravam cursos diferentes.
      */}
      <SeletorDeCurso
        obrigatorio
        valor={watch('cursoId')}
        aoMudar={(cursoId) => setValue('cursoId', cursoId, { shouldValidate: true })}
        erro={errors.cursoId?.message}
        ajuda="Define de quais monitorias o aluno poderá participar."
      />

      <RodapeFormulario enviando={enviando} aoCancelar={aoCancelar} rotulo="Cadastrar aluno" />
    </form>
  );
}

function FormularioProfessor({
  aoCancelar,
  aoCriar,
}: {
  aoCancelar: () => void;
  aoCriar: (usuario: Usuario) => void;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosCadastroProfessor>({
    resolver: zodResolver(esquemaCadastroProfessor),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { nome: '', email: '', identificacaoFuncional: '', departamento: '' },
  });

  const mutacao = useMutation({
    mutationFn: cadastrarProfessor,
    onSuccess: (usuario) => {
      void queryClient.invalidateQueries({ queryKey: chaves.professores.raiz });
      toast.sucesso('Professor cadastrado', `Senha enviada para ${usuario.email}.`);
      aoCriar(usuario);
    },
    onError: (erro) => aplicarErro(erro, setError, CAMPOS_CADASTRO_PROFESSOR),
  });

  const enviando = isSubmitting || mutacao.isPending;

  return (
    <form
      onSubmit={handleSubmit((dados) => mutacao.mutate(dados))}
      className="space-y-4"
      noValidate
    >
      {errors.root && <Alert tom="erro">{errors.root.message}</Alert>}

      <Input
        label="Nome completo"
        autoComplete="off"
        autoFocus
        obrigatorio
        erro={errors.nome?.message}
        {...register('nome')}
      />

      <Input
        label="E-mail institucional"
        type="email"
        inputMode="email"
        autoComplete="off"
        placeholder="nome@instituicao.edu.br"
        obrigatorio
        ajuda={AJUDA_EMAIL}
        erro={errors.email?.message}
        {...register('email')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Identificação funcional"
          autoComplete="off"
          ajuda="SIAPE ou matrícula funcional."
          erro={errors.identificacaoFuncional?.message}
          {...register('identificacaoFuncional')}
        />

        <Input
          label="Departamento"
          autoComplete="off"
          erro={errors.departamento?.message}
          {...register('departamento')}
        />
      </div>

      <RodapeFormulario enviando={enviando} aoCancelar={aoCancelar} rotulo="Cadastrar professor" />
    </form>
  );
}

function RodapeFormulario({
  enviando,
  aoCancelar,
  rotulo,
}: {
  enviando: boolean;
  aoCancelar: () => void;
  rotulo: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:justify-end">
      <Button variante="secundaria" onClick={aoCancelar} disabled={enviando}>
        Cancelar
      </Button>
      {/* O envio inclui mandar o e-mail: pode levar alguns segundos. */}
      <Button type="submit" carregando={enviando}>
        {enviando ? 'Cadastrando e enviando a senha…' : rotulo}
      </Button>
    </div>
  );
}

/**
 * Confirmacao: diz PARA ONDE a senha foi e o que fazer se ela nao chegar. O
 * caminho de reserva e a recuperacao de senha do login, que gera um codigo para
 * o mesmo e-mail — o professor nao precisa (nem pode) reenviar a senha.
 */
function ConfirmacaoConta({
  usuario,
  aoCadastrarOutro,
  aoConcluir,
  rotuloOutro,
}: {
  usuario: Usuario;
  aoCadastrarOutro: () => void;
  aoConcluir: () => void;
  rotuloOutro: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-md bg-sucesso-suave/70 px-3 py-3 text-sm text-texto">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-sucesso" aria-hidden />
        <p>
          Enviamos a senha de acesso para{' '}
          <strong className="break-all font-semibold">{usuario.email}</strong>. Ela não aparece
          aqui: só {usuario.nome.split(' ')[0]} a recebe.
        </p>
      </div>

      <ul className="space-y-1.5 text-sm text-texto-suave">
        <li>
          Se o e-mail não chegar, peça para conferir a caixa de spam ou usar{' '}
          <strong className="font-semibold text-texto">Esqueceu a senha?</strong> na tela de login.
        </li>
        <li>A senha pode ser trocada a qualquer momento, em Minha conta.</li>
      </ul>

      <div className="flex flex-col-reverse gap-2 border-t border-borda pt-4 sm:flex-row sm:justify-end">
        <Button variante="secundaria" onClick={aoCadastrarOutro}>
          {rotuloOutro}
        </Button>
        <Button onClick={aoConcluir}>Concluir</Button>
      </div>
    </div>
  );
}
