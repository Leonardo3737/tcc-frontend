'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/campo';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/components/ui/toast';
import {
  atualizarDadosAluno,
  atualizarDadosProfessor,
  atualizarNome,
} from '../api/usuarios.service';
import { useSessao } from '@/providers/sessao-provider';
import { ApiError } from '@/lib/api/erros';

/**
 * Espelha os tres DTOs de atualizacao do backend:
 * `atualizar-usuario` (nome), `atualizar-aluno` (curso) e
 * `atualizar-professor` (departamento).
 *
 * E-mail e matricula/identificacao funcional NAO estao aqui porque o backend
 * nao os aceita: e-mail e credencial de login (trocar exigiria confirmacao) e os
 * identificadores institucionais sao a identidade da pessoa na instituicao.
 */
const esquema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, 'O nome deve ter ao menos 3 caracteres')
    .max(150, 'O nome deve ter no máximo 150 caracteres'),
  curso: z.string().trim().max(120, 'O curso deve ter no máximo 120 caracteres').optional(),
  departamento: z
    .string()
    .trim()
    .max(120, 'O departamento deve ter no máximo 120 caracteres')
    .optional(),
});

type DadosPerfil = z.infer<typeof esquema>;

export function FormularioPerfil() {
  const router = useRouter();
  const { usuario, ehAluno, ehProfessor } = useSessao();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<DadosPerfil>({
    resolver: zodResolver(esquema),
    mode: 'onBlur',
    defaultValues: {
      nome: usuario.nome,
      curso: usuario.aluno?.curso ?? '',
      departamento: usuario.professor?.departamento ?? '',
    },
  });

  const mutacao = useMutation({
    /**
     * O backend separa o perfil em tres recursos (`/usuarios/eu`, `/alunos/eu`,
     * `/professores/eu`) porque cada um pertence a uma tabela diferente. Aqui
     * eles aparecem como um formulario so, e enviamos apenas o que mudou —
     * poupando requisicoes e evitando reescrever valores que o usuario nao tocou.
     */
    mutationFn: async (dados: DadosPerfil) => {
      if (dirtyFields.nome) {
        await atualizarNome(dados.nome);
      }

      if (ehAluno && dirtyFields.curso) {
        await atualizarDadosAluno(dados.curso?.trim() ? dados.curso : null);
      }

      if (ehProfessor && dirtyFields.departamento) {
        await atualizarDadosProfessor(dados.departamento?.trim() ? dados.departamento : null);
      }
    },

    onSuccess: () => {
      toast.sucesso('Dados atualizados');

      // A sessao e resolvida em Server Components: sem o refresh, o nome no
      // cabecalho continuaria mostrando o valor antigo ate a proxima navegacao.
      router.refresh();
    },

    onError: (erro: unknown) => {
      setError('root', {
        type: 'server',
        message: erro instanceof ApiError ? erro.message : 'Não foi possível salvar as alterações.',
      });
    },
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
        autoComplete="name"
        obrigatorio
        erro={errors.nome?.message}
        {...register('nome')}
      />

      <Input
        label="E-mail"
        value={usuario.email}
        disabled
        readOnly
        ajuda="O e-mail é a sua credencial de acesso e não pode ser alterado por aqui."
      />

      {ehAluno && (
        <>
          <Input
            label="Matrícula"
            value={usuario.aluno?.matricula ?? ''}
            disabled
            readOnly
            ajuda="Dado de identidade institucional."
          />

          <Input label="Curso" erro={errors.curso?.message} {...register('curso')} />
        </>
      )}

      {ehProfessor && (
        <>
          <Input
            label="Identificação funcional"
            value={usuario.professor?.identificacaoFuncional ?? '—'}
            disabled
            readOnly
            ajuda="Dado de identidade institucional."
          />

          <Input
            label="Departamento"
            erro={errors.departamento?.message}
            {...register('departamento')}
          />
        </>
      )}

      <Button
        type="submit"
        carregando={enviando}
        iconeEsquerda={<Save className="h-4 w-4" aria-hidden />}
      >
        {enviando ? 'Salvando…' : 'Salvar alterações'}
      </Button>
    </form>
  );
}
