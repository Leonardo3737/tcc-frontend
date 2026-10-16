'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Dialog, DialogConteudo } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/campo';
import { Alert } from '@/components/ui/alert';
import { toast } from '@/components/ui/toast';
import { SeletorDeCursos } from '@/features/cursos/components/seletor-de-cursos';
import { atualizarDisciplina, criarDisciplina } from '../api/disciplinas.service';
import {
  CAMPOS_DISCIPLINA,
  esquemaCriarDisciplina,
  esquemaEditarDisciplina,
  type DadosCriarDisciplina,
  type DadosEditarDisciplina,
} from '../schemas/disciplina.schema';
import { aplicarErroDeFormulario } from '@/lib/api/formulario';
import { chaves } from '@/lib/query/chaves';
import type { Disciplina } from '@/types/dominio';

/**
 * Criacao e edicao no mesmo dialogo.
 *
 * O que muda entre os dois nao e o layout, e sim o CONJUNTO DE CAMPOS: na
 * criacao so ha o nome (o `codigo` e gerado pelo servidor); na edicao o codigo
 * aparece como leitura e surge o controle de ativacao.
 */
export function DialogoDisciplina({
  aberto,
  aoFechar,
  disciplina,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Ausente = criacao. */
  disciplina?: Disciplina;
}) {
  const queryClient = useQueryClient();
  const editando = Boolean(disciplina);

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && aoFechar()}>
      {aberto && (
        <DialogConteudo
          titulo={editando ? 'Editar disciplina' : 'Nova disciplina'}
          descricao={
            editando
              ? 'O código não pode ser alterado: monitorias já criadas o referenciam.'
              : 'Informe o nome. O código é gerado automaticamente a partir dele (ex.: CAL001).'
          }
        >
          {editando ? (
            <FormularioEdicao
              disciplina={disciplina!}
              aoConcluir={() => {
                void queryClient.invalidateQueries({ queryKey: chaves.disciplinas.raiz });
                aoFechar();
              }}
              aoCancelar={aoFechar}
            />
          ) : (
            <FormularioCriacao
              aoConcluir={() => {
                void queryClient.invalidateQueries({ queryKey: chaves.disciplinas.raiz });
                aoFechar();
              }}
              aoCancelar={aoFechar}
            />
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
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DadosCriarDisciplina>({
    resolver: zodResolver(esquemaCriarDisciplina),
    mode: 'onBlur',
    defaultValues: { nome: '', cursosIds: [] },
  });

  const mutacao = useMutation({
    mutationFn: criarDisciplina,
    onSuccess: (disciplina) => {
      // O codigo so existe depois de criar: o toast e onde a pessoa o ve pela
      // primeira vez.
      toast.sucesso(
        'Disciplina cadastrada',
        `Código gerado: ${disciplina.codigo} — ${disciplina.nome}`,
      );
      aoConcluir();
    },
    // Com o codigo gerado pelo servidor nao ha mais 409 de codigo repetido
    // vindo do formulario; se o servidor nao achar um codigo livre, a mensagem
    // dele (ja pronta para exibir) vai para o topo do formulario.
    onError: (erro) => aplicarErroDeFormulario(erro, setError, CAMPOS_DISCIPLINA),
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
        placeholder="Cálculo I"
        autoFocus
        obrigatorio
        ajuda="O código (ex.: CAL001) é gerado a partir do nome e não muda depois, mesmo se você renomear."
        erro={errors.nome?.message}
        {...register('nome')}
      />

      <SeletorDeCursos
        valor={watch('cursosIds')}
        aoMudar={(ids) => setValue('cursosIds', ids, { shouldValidate: true })}
        erro={errors.cursosIds?.message}
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
  disciplina,
  aoConcluir,
  aoCancelar,
}: {
  disciplina: Disciplina;
  aoConcluir: () => void;
  aoCancelar: () => void;
}) {
  const valoresIniciais = {
    nome: disciplina.nome,
    ativa: disciplina.ativa,
    cursosIds: disciplina.cursos.map((curso) => curso.id),
  };

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DadosEditarDisciplina>({
    resolver: zodResolver(esquemaEditarDisciplina),
    mode: 'onBlur',
    defaultValues: valoresIniciais,
  });

  // O dialogo e reaproveitado entre itens da lista; sem isto, abrir a segunda
  // disciplina mostraria os valores da primeira.
  useEffect(() => {
    reset({
      nome: disciplina.nome,
      ativa: disciplina.ativa,
      cursosIds: disciplina.cursos.map((curso) => curso.id),
    });
  }, [disciplina, reset]);

  const mutacao = useMutation({
    mutationFn: (dados: DadosEditarDisciplina) => atualizarDisciplina(disciplina.id, dados),
    onSuccess: () => {
      toast.sucesso('Disciplina atualizada');
      aoConcluir();
    },
    onError: (erro) => aplicarErroDeFormulario(erro, setError, CAMPOS_DISCIPLINA),
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
        value={disciplina.codigo}
        disabled
        readOnly
        ajuda="Identidade estável da disciplina."
      />

      <Input label="Nome" obrigatorio autoFocus erro={errors.nome?.message} {...register('nome')} />

      {/*
        `jaVinculados` mantém visível um curso que tenha sido desativado depois
        de vinculado. Sem isso ele sumiria da lista e, como `cursosIds`
        SUBSTITUI o conjunto, seria silenciosamente desvinculado ao salvar.
      */}
      <SeletorDeCursos
        valor={watch('cursosIds')}
        aoMudar={(ids) => setValue('cursosIds', ids, { shouldValidate: true })}
        erro={errors.cursosIds?.message}
        jaVinculados={disciplina.cursos}
      />

      <label className="flex items-start gap-3 rounded-lg border border-borda p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-borda text-primaria"
          {...register('ativa')}
        />
        <span className="text-sm">
          <span className="font-medium text-texto">Disciplina ativa</span>
          <span className="mt-0.5 block text-xs text-texto-suave">
            Desativar impede a criação de novas monitorias, mas preserva todo o histórico — nada é
            apagado.
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
