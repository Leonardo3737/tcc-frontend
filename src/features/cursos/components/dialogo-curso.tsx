'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/campo';
import { Dialog, DialogConteudo } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { aplicarErroDeFormulario } from '@/lib/api/formulario';
import { chaves } from '@/lib/query/chaves';
import type { Curso } from '@/types/dominio';
import { atualizarCurso, criarCurso } from '../api/cursos.service';
import {
  CAMPOS_CURSO,
  esquemaCriarCurso,
  esquemaEditarCurso,
  type DadosCriarCurso,
  type DadosEditarCurso,
} from '../schemas/curso.schema';

/**
 * Criacao e edicao no mesmo dialogo, como em disciplinas.
 *
 * O que muda entre os dois nao e o layout, e sim o CONJUNTO DE CAMPOS: na
 * criacao so ha o nome (o `codigo` e gerado pelo servidor); na edicao o codigo
 * aparece como leitura e surge o controle de ativacao.
 */
export function DialogoCurso({
  aberto,
  aoFechar,
  curso,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Ausente = criacao. */
  curso?: Curso;
}) {
  const queryClient = useQueryClient();
  const editando = Boolean(curso);

  /**
   * Invalida tambem disciplinas e usuarios: os dois EXIBEM o nome do curso
   * (`disciplina.cursos[]`, `aluno.curso`). Sem isto, renomear um curso deixaria
   * o nome antigo nas duas telas ate o cache expirar.
   */
  const concluir = () => {
    void queryClient.invalidateQueries({ queryKey: chaves.cursos.raiz });
    void queryClient.invalidateQueries({ queryKey: chaves.disciplinas.raiz });
    void queryClient.invalidateQueries({ queryKey: chaves.alunos.raiz });
    aoFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && aoFechar()}>
      {aberto && (
        <DialogConteudo
          titulo={editando ? 'Editar curso' : 'Novo curso'}
          descricao={
            editando
              ? 'O código não pode ser alterado: alunos e disciplinas já o referenciam.'
              : 'Informe o nome. O código é gerado automaticamente a partir dele (ex.: ENG001).'
          }
        >
          {editando ? (
            <FormularioEdicao curso={curso!} aoConcluir={concluir} aoCancelar={aoFechar} />
          ) : (
            <FormularioCriacao aoConcluir={concluir} aoCancelar={aoFechar} />
          )}
        </DialogConteudo>
      )}
    </Dialog>
  );
}

function FormularioCriacao({
  aoConcluir,
  aoCancelar,
}: {
  aoConcluir: () => void;
  aoCancelar: () => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DadosCriarCurso>({
    resolver: zodResolver(esquemaCriarCurso),
    mode: 'onBlur',
    defaultValues: { nome: '' },
  });

  const mutacao = useMutation({
    mutationFn: criarCurso,
    onSuccess: (curso) => {
      // O codigo so existe depois de criar: o toast e onde a pessoa o ve pela
      // primeira vez.
      toast.sucesso('Curso cadastrado', `Código gerado: ${curso.codigo} — ${curso.nome}`);
      aoConcluir();
    },
    onError: (erro) => aplicarErroDeFormulario(erro, setError, CAMPOS_CURSO),
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
        label="Nome"
        placeholder="Engenharia de Software"
        autoFocus
        obrigatorio
        ajuda="O código (ex.: ENG001) é gerado a partir do nome e não muda depois, mesmo se você renomear."
        erro={errors.nome?.message}
        {...register('nome')}
      />

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variante="secundaria" onClick={aoCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" carregando={enviando}>
          {enviando ? 'Cadastrando…' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  );
}

function FormularioEdicao({
  curso,
  aoConcluir,
  aoCancelar,
}: {
  curso: Curso;
  aoConcluir: () => void;
  aoCancelar: () => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DadosEditarCurso>({
    resolver: zodResolver(esquemaEditarCurso),
    mode: 'onBlur',
    defaultValues: { nome: curso.nome, ativo: curso.ativo },
  });

  // O dialogo e reaproveitado entre itens da lista; sem isto, abrir o segundo
  // curso mostraria os valores do primeiro.
  useEffect(() => {
    reset({ nome: curso.nome, ativo: curso.ativo });
  }, [curso, reset]);

  const mutacao = useMutation({
    mutationFn: (dados: DadosEditarCurso) => atualizarCurso(curso.id, dados),
    onSuccess: () => {
      toast.sucesso('Curso atualizado');
      aoConcluir();
    },
    onError: (erro) => aplicarErroDeFormulario(erro, setError, CAMPOS_CURSO),
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
        label="Código"
        value={curso.codigo}
        disabled
        readOnly
        ajuda="Identidade estável do curso."
      />

      <Input label="Nome" obrigatorio autoFocus erro={errors.nome?.message} {...register('nome')} />

      <label className="flex items-start gap-3 rounded-lg border border-borda p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-borda text-primaria"
          {...register('ativo')}
        />
        <span className="text-sm">
          <span className="font-medium text-texto">Curso ativo</span>
          <span className="mt-0.5 block text-xs text-texto-suave">
            Desativar tira o curso das novas escolhas — de aluno e de disciplina — mas preserva
            todo o histórico. Quem já pertence a ele continua como está; nada é apagado.
          </span>
        </span>
      </label>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variante="secundaria" onClick={aoCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" carregando={enviando}>
          {enviando ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
